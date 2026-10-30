"use strict";

// PC-36 provider: SAM 3 (yodagg/sam3-image-seg) hosted on
// Replicate — the multi-garment engine. BiRefNet (birefnet.js)
// cuts the dominant subject; it cannot pick a NAMED garment
// out of a group or worn photo, which is this flow's whole
// job. SAM takes a text prompt per garment ("black zip
// jacket") and returns instances with polygons, boxes and
// scores.
//
// API shape (proven by the 2026-10-28 backfill spikes):
// resolve the model version once (GET /models/{model}
// -> latest_version.id), create by version hash ALWAYS
// (POST /predictions {version, input}), poll with one
// status read per call (GET /predictions/{id}). The
// input image reaches Replicate through its Files API
// (POST /files, multipart) — Firebase download-token
// URLs minted through the raw Storage JSON API 403 on
// public fetch, so they are never used as inputs.
//
// This module is the swappable seam, mirroring
// birefnet.js: it creates and polls, but it NEVER waits
// out a whole prediction inside one call. Cold boots on
// the community build ran ~20 minutes in spike
// evidence (the run itself is ~10 seconds once warm),
// so the parse pipeline polls through short client-driven
// calls and harvests the moment a job completes —
// outputs left unread get pruned (the batch-2 loss).
// The fal fallback (founder decision, Sprint 25) is a
// provider swap behind this seam, not a rewrite.
//
// Polygon -> cutout mirrors the backfill's proven chain
// exactly (SVG mask, removeAlpha + joinChannel): the
// polygon rings are flat [x0,y0,x1,y1,...] arrays in the
// uploaded image's pixel space, so the caller MUST pass
// the same EXIF-baked pixels it uploaded.

const { codedError } = require("./errors");
const sharp = require("sharp");

const MODEL = "yodagg/sam3-image-seg";
const API_BASE = "https://api.replicate.com/v1";

let resolvedVersion = null;

async function resolveVersion(doFetch, apiKey) {
  if (resolvedVersion) return resolvedVersion;
  const res = await doFetch(API_BASE + "/models/" + MODEL, {
    headers: { Authorization: "Bearer " + apiKey },
  });
  if (!res.ok) {
    throw codedError(
      "SAM_FAILED",
      "replicate model lookup status " + res.status
    );
  }
  const j = await res.json().catch(() => null);
  const v = j && j.latest_version && j.latest_version.id;
  if (!v) {
    throw codedError(
      "SAM_FAILED",
      "replicate model lookup returned no latest_version"
    );
  }
  resolvedVersion = v;
  return v;
}

// Replicate throttles accounts without a payment method to
// a burst of 1 prediction create (429, retry_after ~10s).
// Same pattern as birefnet.js: wait the window out a few
// times rather than failing the cut.
async function createWithBackoff(doFetch, sleep, init) {
  for (let attempt = 0; ; attempt++) {
    const res = await doFetch(API_BASE + "/predictions", init);
    if (res.status !== 429 || attempt >= 4) return res;
    let wait = 12000;
    try {
      const j = JSON.parse(await res.text());
      if (j && j.retry_after) {
        wait = Math.min(30000, (Number(j.retry_after) + 2) * 1000);
      }
    } catch (e) {
      /* keep the default wait */
    }
    await sleep(wait);
  }
}

// Upload an input image to Replicate's Files API. Returns
// the serving URL for use as a prediction input.
// SAM 3 takes RGB. An RGBA input fails INSIDE the model
// ("The size of tensor a (4) must match the size of
// tensor b (3)") — the backfill never hit this because
// it baked everything to JPEG first, but production
// normalizeOrientation preserves PNG, so a store PNG
// with an alpha channel breaks the prediction. Flatten
// over white (what the viewer sees) and encode JPEG.
// Dimensions are unchanged, so polygon coordinates
// still match the stored baked pixels exactly. Only
// the copy sent to SAM is flattened — the stored baked
// bytes stay RGBA, so cutting keeps translucent pixels.
async function toSamInput(buffer) {
  return sharp(buffer).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
}

async function uploadInputImage({ apiKey, buffer, filename, contentType, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const form = new FormData();
  form.append(
    "content",
    new Blob([buffer], { type: contentType || "image/jpeg" }),
    filename || "input.jpg"
  );
  const res = await doFetch(API_BASE + "/files", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey },
    body: form,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || !j.urls || !j.urls.get) {
    throw codedError(
      "SAM_FAILED",
      "replicate file upload status " + res.status
    );
  }
  return j.urls.get;
}

// Backend switch (founder decision 2026-10-29): the Replicate
// community build is too slow (~11-minute cold starts), so the
// official fal build is the fast path. SAM_BACKEND=fal routes
// through sam-fal.js with FAL_API_KEY from Secret Manager;
// anything else (including unset) keeps the Replicate path.
// parse.js calls the router names (createSegmentation /
// getSegmentation) and never knows which backend is live.
const falBackend = require("./sam-fal");

function samBackend() {
  return process.env.SAM_BACKEND === "fal" ? "fal" : "replicate";
}

async function createSegmentation(args) {
  if (samBackend() === "fal") {
    return falBackend.createFalSegmentation({
      apiKey: process.env.FAL_API_KEY,
      imageUrl: args.imageUrl,
      prompt: args.prompt,
      fetchImpl: args.fetchImpl,
    });
  }
  return createReplicateSegmentation(args);
}

async function getSegmentation(args) {
  if (samBackend() === "fal") {
    return falBackend.getFalSegmentation({
      apiKey: process.env.FAL_API_KEY,
      predictionId: args.predictionId,
      statusUrl: args.statusUrl,
      responseUrl: args.responseUrl,
      fetchImpl: args.fetchImpl,
    });
  }
  return getReplicateSegmentation(args);
}

// Create one segmentation prediction for one garment (Replicate).
// Returns { predictionId, status }. Never waits.
async function createReplicateSegmentation({ apiKey, imageUrl, prompt, fetchImpl, sleep }) {
  const doFetch = fetchImpl || fetch;
  const doSleep = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  if (!apiKey) {
    throw codedError("SAM_NOT_CONFIGURED", "REPLICATE_API_TOKEN is not set");
  }
  const version = await resolveVersion(doFetch, apiKey);
  const res = await createWithBackoff(doFetch, doSleep, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ version, input: { image: imageUrl, prompt } }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || !j.id) {
    throw codedError(
      "SAM_FAILED",
      "replicate create status " + res.status + ": " + JSON.stringify(j).slice(0, 300)
    );
  }
  return { predictionId: j.id, status: j.status || "starting" };
}

// One status read (Replicate). Returns { status, output, error }
// where output is present only on "succeeded".
async function getReplicateSegmentation({ apiKey, predictionId, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(
    API_BASE + "/predictions/" + encodeURIComponent(String(predictionId)),
    { headers: { Authorization: "Bearer " + apiKey } }
  );
  const j = await res.json().catch(() => null);
  if (!res.ok || !j) {
    throw codedError(
      "SAM_FAILED",
      "replicate poll status " + res.status
    );
  }
  return {
    status: j.status,
    output: j.status === "succeeded" ? j.output || null : null,
    error: j.error || null,
  };
}

// Shoelace area of one flat ring. Absolute value; sign
// depends on winding and is irrelevant here.
function ringArea(ring) {
  let a = 0;
  for (let i = 0; i + 3 < ring.length; i += 2) {
    a += ring[i] * ring[i + 3] - ring[i + 2] * ring[i + 1];
  }
  return Math.abs(a) / 2;
}

function instanceArea(rings) {
  if (!Array.isArray(rings)) return 0;
  return rings.reduce((sum, r) => sum + (Array.isArray(r) ? ringArea(r) : 0), 0);
}

// Pick the instance to cut: highest score wins (the
// backfill's rule); ties break toward the larger mask,
// the main-subject preference. Returns null when SAM
// found nothing — the caller marks "not found", never
// an error.
// Two output shapes: the Replicate path gives polygons
// (pred_polygons), the fal path gives mask images
// (pred_masks: [{url}]); the caller cuts via rings or
// maskUrl accordingly.
function selectInstance(output) {
  const scores = (output && output.pred_scores) || [];
  const polygons = (output && output.pred_polygons) || [];
  const masks = (output && output.pred_masks) || [];
  const boxes = (output && output.pred_boxes) || [];
  if (!scores.length || (!polygons.length && !masks.length)) return null;
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
    else if (
      scores[i] === scores[best] &&
      instanceArea(polygons[i]) > instanceArea(polygons[best])
    ) {
      best = i;
    }
  }
  const mask = masks[best] || null;
  return {
    index: best,
    score: scores[best],
    box: boxes[best] || null,
    rings: polygons[best] || [],
    maskUrl: mask && mask.url ? mask.url : null,
    detections: scores.length,
  };
}

// Cut one instance out of the uploaded image. The image
// buffer MUST be the same EXIF-baked pixels the polygon
// coordinates were measured on. Mirrors the backfill
// chain exactly: SVG mask (black ground, white rings),
// removeAlpha + joinChannel.
async function polygonToCutout({ imageBuffer, rings }) {
  const md = await sharp(imageBuffer).metadata();
  if (!md.width || !md.height) {
    throw codedError("SAM_FAILED", "polygonToCutout: image has no dimensions");
  }
  let polys = "";
  for (const ring of rings || []) {
    if (!Array.isArray(ring)) continue;
    const pts = [];
    for (let i = 0; i + 1 < ring.length; i += 2) {
      pts.push(ring[i].toFixed(0) + "," + ring[i + 1].toFixed(0));
    }
    if (pts.length >= 3) {
      polys += `<polygon points="${pts.join(" ")}" fill="white"/>`;
    }
  }
  if (!polys) {
    throw codedError("SAM_FAILED", "polygonToCutout: no usable rings");
  }
  const mask = await sharp(
    Buffer.from(
      `<svg width="${md.width}" height="${md.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="black"/>${polys}</svg>`
    )
  )
    .png()
    .toBuffer();
  return sharp(imageBuffer).removeAlpha().joinChannel(mask).png().toBuffer();
}

// Cut one instance out of the uploaded image from a mask
// IMAGE (the fal path) instead of polygon rings. The mask
// may arrive at a different resolution than the image
// (fal serves 1024x1024), so it is resized to the image's
// exact pixels first. Inversion guard: a garment rarely
// covers most of the photo, so a mostly-white mask is
// treated as inverted. Same tail as polygonToCutout
// (removeAlpha + joinChannel) so the downstream gates see
// identical pixels.
async function maskToCutout({ imageBuffer, maskBuffer }) {
  const md = await sharp(imageBuffer).metadata();
  if (!md.width || !md.height) {
    throw codedError("SAM_FAILED", "maskToCutout: image has no dimensions");
  }
  const maskPng = await sharp(maskBuffer)
    .resize(md.width, md.height, { fit: "fill" })
    .greyscale()
    .png()
    .toBuffer();
  const { data } = await sharp(maskPng).raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > 127) white++;
  const finalMask =
    white / data.length > 0.6 ? await sharp(maskPng).negate().toBuffer() : maskPng;
  return sharp(imageBuffer).removeAlpha().joinChannel(finalMask).png().toBuffer();
}

module.exports = {
  MODEL,
  samBackend,
  resolveVersion,
  toSamInput,
  uploadInputImage,
  createSegmentation,
  getSegmentation,
  createReplicateSegmentation,
  getReplicateSegmentation,
  selectInstance,
  polygonToCutout,
  maskToCutout,
  ringArea,
};
