/**
 * Sprint 28 Card 1: Shared standardization pipeline.
 *
 * Extracted from the `standardizeItem` callable (2026-11-04) so both the
 * manual Generate path and the automatic path run the exact same code.
 * No duplication, no drift. (PC-106, 2026-11-26: the automatic path is
 * now a direct call from the client, not the deleted Firestore trigger;
 * the already-clean check moved in here from the trigger.)
 *
 * Pipeline:
 *   1. FLUX Kontext Dev via fal.ai → complete + standardize the garment
 *   2. Quality gates (Delta-E color + geometry) → retry up to 3x on failure
 *   3. SAM 3 cutout → transparent PNG (blends with the app's dark background)
 *   4. Upload to the user's Storage, swap photo types, mark ready
 *
 * Cost: $0.03/run (FLUX $0.025 + SAM $0.005). Each retry costs another run.
 *
 * The caller owns: auth, expense-warning, attempt-limit, and the
 * processing/failed status bookkeeping around this call. This function
 * throws on failure; the caller decides how to record it.
 */
const { runFluxStandardization, runQualityGates, isAlreadyClean } = require("./standardize");
const {
  createFalSegmentation,
  getFalSegmentation,
  fetchMaskBuffer,
} = require("./sam-fal");
const { maskToCutout } = require("./sam");
const crypto = require("crypto");

const MAX_GATE_RETRIES = 3;
// PC-97: the pipeline must finish inside the 300s function/client
// timeout, with room for the SAM step and the upload. No new FLUX
// attempt starts past this budget from pipeline entry.
const PIPELINE_DEADLINE_MS = 240 * 1000;

/**
 * Firebase download URL for a Storage path — the same mechanism the
 * client SDK's getDownloadURL uses. Reads the object's download
 * token metadata, creating one when the object has none.
 */
async function downloadUrlForPath(bucket, storagePath) {
  const file = bucket.file(storagePath);
  const [metadata] = await file.getMetadata();
  const custom = (metadata && metadata.metadata) || {};
  let token = custom.firebaseStorageDownloadTokens;
  if (!token) {
    token = crypto.randomUUID();
    await file.setMetadata({
      metadata: Object.assign({}, custom, { firebaseStorageDownloadTokens: token }),
    });
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

/**
 * Run the full standardization pipeline for one item.
 *
 * @param {object} opts
 * @param {object} opts.db - Firestore instance (Admin SDK)
 * @param {object} opts.bucket - GCS bucket (Admin SDK)
 * @param {string} opts.uid - Owner user id
 * @param {string} opts.itemId - Item document id
 * @param {object} opts.item - The Firestore item data (photos, ai, etc.)
 * @param {string} opts.falApiKey - fal.ai API key
 * @param {string} [opts.feedback] - Optional user feedback for the prompt
 * @param {boolean} [opts.force] - Manual Generate: skip the already-clean
 *   check and run FLUX even on a studio shot.
 * @returns {Promise<{ready: boolean, pendingReview: boolean, standardizedUrl: string, skipped?: boolean}>}
 *   ready is always false — the render waits in pending_review (#128).
 *   skipped is true when the source photo was already clean: no FLUX
 *   ran, the item is marked already_clean, standardizedUrl is null.
 * @throws on FLUX failure, gate failure after retries, or upload failure.
 */
/**
 * The failing gates as a signature ("color", "geometry", or
 * "color+geometry"). Two runs with the same signature failed the
 * same way — the ΔE value itself varies run to run, so it is not
 * part of the signature. Used by the PC-97 systematic-stop rule.
 */
function gateSignature(gates) {
  const results = (gates && gates.results) || {};
  return ["color", "geometry"]
    .filter((name) => results[name] && !results[name].pass)
    .join("+");
}

/**
 * Save a failed FLUX output as evidence instead of discarding it.
 * The render goes to a deterministic path (one file, overwritten on
 * each failure — no orphans) and the item records where it is and
 * why it failed, so the next retry — or a human — can look at what
 * the model actually produced. Best-effort: a save failure is
 * logged, never allowed to mask the real error.
 */
async function saveRejectedRender(bucket, db, itemRef, uid, itemId, fluxBuffer, reason) {
  if (!fluxBuffer) return;
  const rejectedPath = `users/${uid}/items/${itemId}/standardized-rejected.png`;
  try {
    await bucket.file(rejectedPath).save(fluxBuffer, { contentType: "image/png" });
    await itemRef.update({
      "standardization.lastRejectedStoragePath": rejectedPath,
      "standardization.lastRejectedReason": reason || null,
    });
    console.log(`[standardize-pipeline] rejected render saved at ${rejectedPath}`);
  } catch (e) {
    console.log(`[standardize-pipeline] rejected render save failed (non-fatal): ${e.message}`);
  }
}

async function runStandardizationPipeline({ db, bucket, uid, itemId, item, falApiKey, feedback = "", force = false, deadlineMs = PIPELINE_DEADLINE_MS }) {
  const photos = item.photos || [];
  if (!photos.length || !photos[0].url) {
    throw new Error("No photo URL on item");
  }
  if (!falApiKey) {
    throw new Error("FAL_API_KEY not configured");
  }
  // PC-94: standardize from the cutout, not the mirror photo. The
  // original photo of a worn garment includes the person, the room,
  // and the other pieces — FLUX renders from a scene, and the color
  // gate compares the scene median against the garment median, so it
  // can never pass (a perfect solid-burgundy render scored ΔE=49.9
  // against the founder's mirror photo). The cutout is garment-only:
  // FLUX sees the piece, and the gate measures the piece. Falls back
  // to the original photo when no passed render exists or its URL
  // cannot be minted (today's behavior).
  let imageUrl = photos[0].url;
  let inputKind = "original";
  const firstPhoto = photos[0];
  if (firstPhoto.renderStoragePath && firstPhoto.renderStatus === "passed") {
    try {
      imageUrl = await downloadUrlForPath(bucket, firstPhoto.renderStoragePath);
      inputKind = "cutout";
    } catch (e) {
      console.log(`[standardize-pipeline] cutout URL failed, using original: ${e.message}`);
    }
  }
  const itemRef = db.collection("users").doc(uid).collection("items").doc(itemId);
  const pipelineStartedAt = Date.now();

  // 1. FLUX standardization, with quality-gate retries.
  // Each attempt re-runs FLUX (fresh input, rebuilt prompt — no prior-render context).
  // The input is fetched once: the anchor and the gates both read it.
  const inputBuffer = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
  // PC-106: the already-clean check used to live only in the trigger
  // (now deleted). It answers "is the SOURCE photo already a studio
  // shot?" — so it reads the original photo, never the cutout: a cutout
  // is transparent by construction, so checking it would mark every
  // cutout-backed item already-clean and skip the FLUX run PC-94 exists
  // to do. Force bypasses it: a manual Generate means "run FLUX". A
  // failed check never blocks standardization — proceed (the trigger's
  // own rule).
  if (!force) {
    try {
      const cleanBuffer = inputKind === "cutout"
        ? Buffer.from(await (await fetch(photos[0].url)).arrayBuffer())
        : inputBuffer;
      const clean = await isAlreadyClean(cleanBuffer);
      if (clean.isClean) {
        await itemRef.update({
          "standardization.status": "already_clean",
          "standardization.reason": clean.reason,
        });
        return { ready: false, pendingReview: false, standardizedUrl: null, inputKind, skipped: true, reason: "already_clean" };
      }
    } catch (e) {
      console.log(`[standardize-pipeline] clean check failed (non-fatal, proceeding): ${e.message}`);
    }
  }
  // PC-100: anchor FLUX to the input's measured dominant color (the
  // gate's own median). A render that matches the anchor passes the
  // color gate by construction. A null anchor (no garment pixels)
  // means no anchor — the prompt is unchanged.
  let colorAnchor = null;
  try {
    const { dominantColor } = require("./standardize");
    colorAnchor = await dominantColor(inputBuffer);
  } catch (e) {
    console.log(`[standardize-pipeline] color anchor failed (non-fatal): ${e.message}`);
  }
  let outputUrl = null;
  let fluxBuffer = null;
  let lastGateReason = "";
  let prevGateSignature = null;
  for (let attempt = 1; attempt <= MAX_GATE_RETRIES; attempt++) {
    // PC-97: never start an attempt that cannot finish inside the
    // function timeout. FLUX polls up to 200s and SAM up to 120s
    // against a 300s timeout — a third attempt after two slow ones
    // strands the item in "processing" until the 30-minute sweeper.
    if (attempt > 1 && Date.now() - pipelineStartedAt > deadlineMs) {
      await saveRejectedRender(bucket, db, itemRef, uid, itemId, fluxBuffer, lastGateReason);
      throw new Error(`standardization_timeout: ${lastGateReason}`);
    }
    outputUrl = await runFluxStandardization(imageUrl, falApiKey, item, feedback, colorAnchor, {
      // PC-105: the poll shares the pipeline budget — stop inside
      // it, with a timeout error, instead of dying mid-poll at the
      // function cap. Per-fetch timeout 30s.
      deadlineAt: pipelineStartedAt + deadlineMs,
      fetchTimeoutMs: 30000,
    });
    fluxBuffer = Buffer.from(await (await fetch(outputUrl)).arrayBuffer());

    // 2. Quality gates (Sprint 27: now real, not stubs).
    const gates = await runQualityGates(inputBuffer, fluxBuffer);
    if (gates.pass) break;
    lastGateReason = gates.reason;
    console.log(`[standardize-pipeline] Gate fail (attempt ${attempt}/${MAX_GATE_RETRIES}): ${gates.reason}`);
    // PC-97: a systematic failure repeats identically — the same gates
    // fail the same way, run after run, because the input is wrong
    // (e.g. a mirror photo fed to a garment-color gate), not because
    // the model had a bad draw. Retrying burns $0.03 and 200s for a
    // zero chance. Stop after the same signature fails twice, and
    // keep the rejected render as evidence instead of discarding it.
    const signature = gateSignature(gates);
    if (prevGateSignature !== null && signature === prevGateSignature) {
      await saveRejectedRender(bucket, db, itemRef, uid, itemId, fluxBuffer, lastGateReason);
      throw new Error(`systematic_gate_failure: ${lastGateReason} (same gates failed twice)`);
    }
    prevGateSignature = signature;
    if (attempt === MAX_GATE_RETRIES) {
      await saveRejectedRender(bucket, db, itemRef, uid, itemId, fluxBuffer, lastGateReason);
      throw new Error(`quality_gates_failed: ${lastGateReason}`);
    }
    // Otherwise loop and retry FLUX.
  }

  // 3. SAM 3 cutout → transparent PNG.
  let standardizedBuffer = fluxBuffer;
  let cutoutNote = "";
  try {
    console.log(`[standardize-pipeline] Running SAM 3 on FLUX output for transparency...`);
    const seg = await createFalSegmentation({
      apiKey: falApiKey,
      imageBuffer: fluxBuffer,
      filename: "flux-output.png",
      prompt: "the garment",
      fetchImpl: fetch,
    });
    let maskUrl = null;
    for (let i = 0; i < 24; i++) { // 24 * 5s = 120s max
      // PC-97: the SAM poll shares the pipeline deadline — a slow
      // FLUX run must not let SAM eat the rest of the timeout.
      if (Date.now() - pipelineStartedAt > deadlineMs) break;
      await new Promise((r) => setTimeout(r, 5000));
      const segRes = await getFalSegmentation({
        apiKey: falApiKey,
        predictionId: seg.predictionId,
        statusUrl: seg.statusUrl,
        responseUrl: seg.responseUrl,
        fetchImpl: fetch,
      });
      if (segRes.status === "succeeded" && segRes.output?.pred_masks?.[0]) {
        maskUrl = segRes.output.pred_masks[0].url;
        break;
      }
      if (segRes.status === "failed") throw new Error("SAM 3 failed: " + segRes.error);
    }
    if (maskUrl) {
      const maskBuffer = await fetchMaskBuffer({ url: maskUrl, fetchImpl: fetch });
      standardizedBuffer = await maskToCutout({ imageBuffer: fluxBuffer, maskBuffer });
      console.log(`[standardize-pipeline] SAM 3 cutout done, ${standardizedBuffer.length} bytes`);
    } else {
      cutoutNote = " (SAM 3 timed out, using white background)";
      console.log(`[standardize-pipeline] SAM 3 timed out, falling back to white background`);
    }
  } catch (samErr) {
    // Non-fatal: fall back to the white-background FLUX output.
    cutoutNote = " (cutout failed, using white background)";
    console.log(`[standardize-pipeline] SAM 3 failed: ${samErr.message}, using white background`);
  }

  // 4. Upload + mark PENDING REVIEW (Sprint 28 Card 2, #128).
  // The render does NOT become the item's picture yet — it waits for the
  // founder's eyes (approve / regenerate / keep original). The original
  // photo is never replaced. The pending render is stored on the
  // standardization object; approve swaps it into photos[] as 'standardized'.
  const stdPath = `users/${uid}/items/${itemId}/standardized-pending.png`;
  await bucket.file(stdPath).save(standardizedBuffer, { contentType: "image/png" });
  await bucket.file(stdPath).makePublic();
  const stdUrl = `https://storage.googleapis.com/${bucket.name}/${stdPath}`;

  await db.runTransaction(async (t) => {
    t.update(itemRef, {
      "standardization.status": "pending_review",
      "standardization.pendingUrl": stdUrl,
      "standardization.pendingStoragePath": stdPath,
      "standardization.completedAt": new Date().toISOString(),
      "standardization.lastError": null,
      "standardization.cutoutNote": cutoutNote || null,
      "standardization.inputKind": inputKind,
      "standardization.colorAnchor": colorAnchor || null,
    });
  });

  return { ready: false, pendingReview: true, standardizedUrl: stdUrl, inputKind };
}

module.exports = { runStandardizationPipeline, MAX_GATE_RETRIES, PIPELINE_DEADLINE_MS, downloadUrlForPath, gateSignature, saveRejectedRender };
