"use strict";

// PC-34: garment extraction orchestration (founder-approved
// package, 2026-10-23). Pipeline, in order:
//
// 1. Read the caller's ORIGINAL photo from Storage (never write
//    to it).
// 2. Bake the EXIF orientation into the pixels (imagenorm) —
//    everything downstream lives in display orientation.
// 3. Provider cutout (birefnet.js — BiRefNet via Replicate,
//    behind the swappable seam).
// 4. Save the render at a deterministic path. Re-runs overwrite;
//    no orphans, no duplicate renders.
// 5. Quality gate, two layers: mask heuristics (imagenorm) then
//    the Gemini vision check (extractcheck). The render file is
//    saved either way (evidence for tuning), but the result only
//    reports gatePassed when BOTH layers pass — and the client
//    only points the photo entry at a passed render. A rejected
//    render changes nothing the user sees: the original keeps
//    showing, exactly as before PC-34.
// 6. Both AI calls emit ai_usage events (OBS-3a): the provider
//    call priced from predict_time, the check from token usage.
//
// Invariants (founder requirements, 2026-10-22):
// - The original photo is retained untouched.
// - The PC-19 pHash lives on the photo entry and is computed by
//   the client from the original. Nothing here reads or writes
//   it, so duplicate detection is unaffected by extraction.

const crypto = require("crypto");
const { codedError } = require("./errors");
const { segmentImage, MODEL } = require("./birefnet");
const { normalizeOrientation, alphaStats, judgeMask } = require("./imagenorm");
const { checkCutout } = require("./extractcheck");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches describeItem

function renderPathFor(uid, storagePath) {
  const hash = crypto
    .createHash("sha256")
    .update(storagePath)
    .digest("hex")
    .slice(0, 32);
  return "users/" + uid + "/renders/" + hash + ".png";
}

// deps are injectable for tests:
// { bucket, apiKey, fetchImpl, callModel, recordUsage,
//   correlationId, surface }.
async function extractGarmentPhoto(uid, storagePath, deps) {
  const expectedPrefix = "users/" + uid + "/";
  if (typeof storagePath !== "string" || !storagePath.startsWith(expectedPrefix)) {
    throw codedError("NOT_YOUR_PHOTO", "storagePath outside caller prefix: " + storagePath);
  }
  if (!deps.apiKey) {
    throw codedError("EXTRACT_NOT_CONFIGURED", "REPLICATE_API_TOKEN is not set");
  }

  const file = deps.bucket.file(storagePath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size || 0);
  if (size > MAX_IMAGE_BYTES) {
    throw codedError("IMAGE_TOO_LARGE", "photo is " + size + " bytes");
  }
  const [buffer] = await file.download();
  if (!buffer || buffer.length === 0) {
    throw codedError("BAD_IMAGE", "downloaded photo is empty");
  }

  // Step 2: orientation bake-in. A sharp failure here means the
  // stored bytes are not a readable image — an extraction failure,
  // never a silent pass.
  let normalized;
  try {
    normalized = await normalizeOrientation(buffer);
  } catch (err) {
    throw codedError("EXTRACT_FAILED", "orientation normalize failed: " + err.message);
  }

  // Step 3: provider call, with its ai_usage event on both paths.
  const providerStart = Date.now();
  let png;
  let predictSeconds = null;
  try {
    const out = await segmentImage(
      normalized.buffer,
      normalized.mimeType,
      deps.apiKey,
      deps.fetchImpl
    );
    png = out.png;
    predictSeconds = out.predictSeconds != null ? out.predictSeconds : null;
    await emitUsage(deps, uid, storagePath, {
      feature: "extractGarment.provider",
      provider: "replicate",
      model: MODEL,
      predictSeconds,
      latencyMs: Date.now() - providerStart,
      outcome: "success",
    });
  } catch (err) {
    await emitUsage(deps, uid, storagePath, {
      feature: "extractGarment.provider",
      provider: "replicate",
      model: MODEL,
      predictSeconds: null,
      latencyMs: Date.now() - providerStart,
      outcome: "error:" + (err && err.key ? err.key : "EXTRACT_FAILED"),
    });
    throw err;
  }

  // Step 4: the render lands at its deterministic path regardless
  // of the gate — a rejected render is tuning evidence, and the
  // client never points at it (see the return contract below).
  const renderStoragePath = renderPathFor(uid, storagePath);
  await deps.bucket.file(renderStoragePath).save(png, {
    contentType: "image/png",
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  // Step 5, layer 1: mask heuristics + the aspect assertion.
  const stats = await alphaStats(png);
  const mask = judgeMask(stats, { width: normalized.width, height: normalized.height });
  if (!mask.pass) {
    return {
      renderStoragePath,
      uncertainty: null,
      provider: "birefnet",
      gatePassed: false,
      gate: { stage: "mask", reasons: mask.reasons },
    };
  }

  // Step 5, layer 2: the vision check. checkCutout never throws
  // for model-side failures — an outage resolves to a rejection
  // with checkError set (the gate fails safe, toward the original).
  const checkStart = Date.now();
  const verdict = await checkCutout(
    { buffer: normalized.buffer, mimeType: normalized.mimeType },
    png,
    { callModel: deps.callModel }
  );
  const usage = verdict.usage || {};
  await emitUsage(deps, uid, storagePath, {
    feature: "extractGarment.check",
    provider: "vertex",
    model: verdict.model || "gemini-3.5-flash",
    tokensIn: typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : null,
    tokensOut: typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : null,
    tokensThinking: typeof usage.thoughtsTokenCount === "number" ? usage.thoughtsTokenCount : null,
    latencyMs: Date.now() - checkStart,
    outcome: verdict.ok ? "success" : verdict.checkError ? "error:CHECK_UNAVAILABLE" : "gate_rejected",
  });

  return {
    renderStoragePath,
    uncertainty: null,
    provider: "birefnet",
    gatePassed: verdict.ok === true,
    gate: { stage: "vision", problems: verdict.problems || [] },
  };
}

// The recorder is fail-safe by contract; this wrapper is belt and
// braces so an analytics surprise can never fail the extraction.
async function emitUsage(deps, uid, storagePath, fields) {
  if (!deps || typeof deps.recordUsage !== "function") return;
  try {
    await deps.recordUsage(
      Object.assign(
        {
          correlationId: deps.correlationId || null,
          uid,
          surface: deps.surface || "upload",
          refId: storagePath,
        },
        fields
      )
    );
  } catch (err) {
    /* analytics never breaks the measured call */
  }
}

module.exports = { extractGarmentPhoto, renderPathFor, MAX_IMAGE_BYTES };
