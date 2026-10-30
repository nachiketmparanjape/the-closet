"use strict";

// PC-36 provider: SAM 3, official build, hosted on fal
// (fal-ai/sam-3/image) — the fast alternative to the
// Replicate community build (founder decision 2026-10-29:
// Replicate's ~11-minute cold starts are too slow; fal
// claims no cold starts, ~$0.005 per call).
//
// Why the *image* endpoint and not *image-rle*: image-rle
// returns the mask as an RLE string in Meta's SAM 3 wire
// protocol (base-85 + arithmetic-coded `one_bit`/`lossless`
// payloads — see the meta-sam-parser PyPI package), which
// would need a ~150-line port of the range decoder. The
// image endpoint returns the same masks as PNG files
// (`masks[].url`), which feed straight into the existing
// removeAlpha + joinChannel cutout chain — no RLE, no
// polygon tracing.
//
// API shape (from fal's queue OpenAPI + llms.txt):
// submit POST https://queue.fal.run/fal-ai/sam-3/image
//   { image_url, prompt, include_scores, include_boxes,
//     return_multiple_masks: false }
//   -> { status: "IN_QUEUE"|"IN_PROGRESS", request_id }
// poll GET .../requests/{id}/status -> { status }
// result GET .../requests/{id}
//   -> { masks: [{url, width, height}], scores, boxes }
// Auth is `Authorization: Key <key>` (the scheme the
// custom.fal connector cannot express — hence server-side
// calls with FAL_API_KEY from Secret Manager, never the
// connector).
// Boxes are normalized [cx, cy, w, h]; the pipeline
// stores [x_min, y_min, w, h], converted in
// getFalSegmentation.
//
// This module never waits out a whole request inside one
// call — same contract as sam.js: create returns the
// request id, polls are one status read each, and the
// parse pipeline harvests the moment a job completes.

const { codedError } = require("./errors");

const FAL_QUEUE = "https://queue.fal.run/fal-ai/sam-3/image";

function falHeaders(apiKey) {
  return { Authorization: "Key " + apiKey, "Content-Type": "application/json" };
}

// fal [cx, cy, w, h] (normalized) -> pipeline [x_min, y_min, w, h].
function convertBox(box) {
  if (!Array.isArray(box) || box.length < 4) return null;
  const [cx, cy, w, h] = box;
  if (![cx, cy, w, h].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return [clamp(cx - w / 2), clamp(cy - h / 2), clamp(w), clamp(h)];
}

// Create one segmentation request for one garment.
// Returns { predictionId, status, statusUrl, responseUrl }.
// The status_url / response_url from fal's submit response are
// the authoritative poll endpoints — never reconstructed by
// hand (a hand-built .../requests/{id}/status 405'd live on
// 2026-10-29 while the submit on the same host succeeded).
// Never waits.
async function createFalSegmentation({ apiKey, imageUrl, prompt, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  if (!apiKey) {
    throw codedError("SAM_NOT_CONFIGURED", "FAL_API_KEY is not set");
  }
  let res;
  try {
    res = await doFetch(FAL_QUEUE, {
      method: "POST",
      headers: falHeaders(apiKey),
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
        include_scores: true,
        include_boxes: true,
        return_multiple_masks: false,
      }),
    });
  } catch (e) {
    throw codedError("SAM_FAILED", "fal submit failed: " + (e && e.message ? e.message : e));
  }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || !j.request_id) {
    throw codedError(
      "SAM_FAILED",
      "fal submit status " + res.status + ": " + JSON.stringify(j).slice(0, 300)
    );
  }
  return {
    predictionId: j.request_id,
    status: "processing",
    statusUrl: typeof j.status_url === "string" ? j.status_url : null,
    responseUrl: typeof j.response_url === "string" ? j.response_url : null,
  };
}

// One status read. Returns { status, output, error } where
// output is present only on "succeeded", shaped like the
// Replicate path's output ({ pred_scores, pred_boxes,
// pred_masks }) so the harvest code needs only a small
// branch for the mask-image cutout. Polls fal's own
// status_url / response_url when the caller has them.
async function getFalSegmentation({ apiKey, predictionId, statusUrl, responseUrl, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  if (!apiKey) {
    throw codedError("SAM_NOT_CONFIGURED", "FAL_API_KEY is not set");
  }
  const base = FAL_QUEUE + "/requests/" + encodeURIComponent(String(predictionId));
  const statusEndpoint = typeof statusUrl === "string" && statusUrl ? statusUrl : base + "/status";
  const resultEndpoint = typeof responseUrl === "string" && responseUrl ? responseUrl : base;
  let res;
  try {
    res = await doFetch(statusEndpoint, { headers: { Authorization: "Key " + apiKey } });
  } catch (e) {
    throw codedError("SAM_FAILED", "fal poll failed: " + (e && e.message ? e.message : e));
  }
  const sj = await res.json().catch(() => null);
  if (!res.ok || !sj) {
    throw codedError("SAM_FAILED", "fal poll status " + res.status);
  }
  const st = sj.status;
  if (st === "IN_QUEUE" || st === "IN_PROGRESS") {
    return { status: "processing", output: null, error: null };
  }
  if (st !== "COMPLETED") {
    return { status: "failed", output: null, error: "fal status " + st };
  }
  let rres;
  try {
    rres = await doFetch(resultEndpoint, { headers: { Authorization: "Key " + apiKey } });
  } catch (e) {
    throw codedError("SAM_FAILED", "fal result fetch failed: " + (e && e.message ? e.message : e));
  }
  const rj = await rres.json().catch(() => null);
  if (!rres.ok || !rj) {
    return { status: "failed", output: null, error: "fal result status " + rres.status };
  }
  const masks = Array.isArray(rj.masks) ? rj.masks : [];
  const scores = Array.isArray(rj.scores) ? rj.scores : [];
  const boxes = Array.isArray(rj.boxes) ? rj.boxes : [];
  return {
    status: "succeeded",
    output: {
      pred_scores: scores,
      pred_boxes: boxes.map(convertBox),
      pred_masks: masks
        .filter((m) => m && typeof m.url === "string" && m.url)
        .map((m) => ({ url: m.url, width: m.width || null, height: m.height || null })),
    },
    error: null,
  };
}

// Download a mask PNG from fal's file URL (public signed URL, no auth).
async function fetchMaskBuffer({ url, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  let res;
  try {
    res = await doFetch(url);
  } catch (e) {
    throw codedError("SAM_FAILED", "fal mask download failed: " + (e && e.message ? e.message : e));
  }
  if (!res.ok) {
    throw codedError("SAM_FAILED", "fal mask download status " + res.status);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) {
    throw codedError("SAM_FAILED", "fal mask download empty");
  }
  return buf;
}

module.exports = {
  FAL_QUEUE,
  convertBox,
  createFalSegmentation,
  getFalSegmentation,
  fetchMaskBuffer,
};
