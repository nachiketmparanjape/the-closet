/**
 * Sprint 28 Card 1: Shared standardization pipeline.
 *
 * Extracted from the `standardizeItem` callable (2026-11-04) so both the
 * manual Generate path and the `autoStandardizeItem` Firestore trigger run
 * the exact same code. No duplication, no drift.
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
const { runFluxStandardization, runQualityGates } = require("./standardize");
const {
  createFalSegmentation,
  getFalSegmentation,
  fetchMaskBuffer,
} = require("./sam-fal");
const { maskToCutout } = require("./sam");

const MAX_GATE_RETRIES = 3;

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
 * @returns {Promise<{ready: boolean, pendingReview: boolean, standardizedUrl: string}>}
 *   ready is always false — the render waits in pending_review (#128).
 * @throws on FLUX failure, gate failure after retries, or upload failure.
 */
async function runStandardizationPipeline({ db, bucket, uid, itemId, item, falApiKey, feedback = "" }) {
  const photos = item.photos || [];
  if (!photos.length || !photos[0].url) {
    throw new Error("No photo URL on item");
  }
  if (!falApiKey) {
    throw new Error("FAL_API_KEY not configured");
  }
  const imageUrl = photos[0].url;
  const itemRef = db.collection("users").doc(uid).collection("items").doc(itemId);

  // 1. FLUX standardization, with quality-gate retries.
  // Each attempt re-runs FLUX (fresh input, rebuilt prompt — no prior-render context).
  let outputUrl = null;
  let fluxBuffer = null;
  let lastGateReason = "";
  for (let attempt = 1; attempt <= MAX_GATE_RETRIES; attempt++) {
    outputUrl = await runFluxStandardization(imageUrl, falApiKey, item, feedback);
    fluxBuffer = Buffer.from(await (await fetch(outputUrl)).arrayBuffer());

    // 2. Quality gates (Sprint 27: now real, not stubs).
    const inputBuffer = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
    const gates = await runQualityGates(inputBuffer, fluxBuffer);
    if (gates.pass) break;
    lastGateReason = gates.reason;
    console.log(`[standardize-pipeline] Gate fail (attempt ${attempt}/${MAX_GATE_RETRIES}): ${gates.reason}`);
    if (attempt === MAX_GATE_RETRIES) {
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
    });
  });

  return { ready: false, pendingReview: true, standardizedUrl: stdUrl };
}

module.exports = { runStandardizationPipeline, MAX_GATE_RETRIES };
