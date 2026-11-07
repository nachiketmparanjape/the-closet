"use strict";

// PC-34 provider: BiRefNet (MIT, ZhengPeng7/BiRefNet) hosted on
// Replicate — pay-per-prediction, no subscription floor, chosen by
// the founder 2026-10-23 over Photoroom's $20/mo floor after the
// local side-by-side showed quality parity (and stronger dark-lens
// handling on sunglasses). See photoroom-trial/results.md.
//
// API shape: POST /v1/models/{owner}/{name}/predictions with a
// Bearer token, input image as a data URI; the run is async, so we
// ask Replicate to wait (Prefer: wait) and then poll the prediction
// URL until it settles. Output is a file URL; we download the PNG.
//
// ENDPOINT HISTORY: the first pinned id, zhengpeng-7/birefnet,
// was never verified (Replicate's API refuses unauthenticated
// model lookups, so it could not be read before the founder's
// token existed). At the first live check (2026-10-27, the day
// the token landed) its public model page returned 404 and it
// appears in no Replicate listing — the id does not resolve.
// The endpoint is now sprited/birefnet, a maintained community
// packaging of the same MIT BiRefNet model; its published
// schema (read 2026-10-27) takes input "image" and an
// output_format, pinned to "cutout" below so the pipeline
// always receives an RGBA cutout, never a raw matte.
// MODEL_VERSION stays null; the founder's first phone add is
// the live end-to-end verification of this endpoint.
//
// This module is the swappable seam: extract.js depends only on the
// { png, uncertainty } shape. BiRefNet returns no uncertainty score,
// so uncertainty is always null here — the quality gate in
// extract.js / extractcheck.js replaces what Photoroom's score did.

const { codedError } = require("./errors");

const MODEL = "sprited/birefnet";
const MODEL_VERSION = null; // pin a version hash here once verified live
const API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 90000; // the callable's own timeout is 120s

let resolvedVersion = null;

async function resolveVersion(doFetch, apiKey) {
  if (resolvedVersion) return resolvedVersion;
  const res = await doFetch(API_BASE + "/models/" + MODEL, {
    headers: { Authorization: "Bearer " + apiKey },
  });
  if (!res.ok) {
    throw codedError(
      "EXTRACT_FAILED",
      "replicate model lookup status " + res.status
    );
  }
  const j = await res.json();
  const v = j && j.latest_version && j.latest_version.id;
  if (!v) {
    throw codedError(
      "EXTRACT_FAILED",
      "replicate model lookup returned no latest_version"
    );
  }
  resolvedVersion = v;
  return v;
}

// Replicate throttles accounts without a payment method to a
// burst of 1 prediction create (429, retry_after ~10s). Wait
// out the window a few times — the callable's 120s budget
// absorbs it — rather than failing the extraction.
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
      /* unreadable body — the default wait stands */
    }
    await sleep(wait);
  }
}

async function segmentImage(buffer, mimeType, apiKey, fetchImpl, opts) {
  if (!apiKey) {
    throw codedError("EXTRACT_NOT_CONFIGURED", "REPLICATE_API_TOKEN is not set");
  }
  const options = opts || {};
  const doFetch = fetchImpl || fetch;
  const sleep =
    options.sleepImpl || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const dataUri =
    "data:" + (mimeType || "image/jpeg") + ";base64," + buffer.toString("base64");
  // Community models cannot be created through
  // /models/{owner}/{name}/predictions (404, learned live
  // 2026-10-27) — creation is by version hash. Resolve the
  // latest version once per instance unless one is pinned.
  const version =
    options.modelVersion || MODEL_VERSION || (await resolveVersion(doFetch, apiKey));
  const createBody = {
    version,
    input: { image: dataUri, output_format: "cutout" },
  };

  let prediction;
  try {
    const res = await createWithBackoff(doFetch, sleep, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        Prefer: "wait=30",
      },
      body: JSON.stringify(createBody),
    });
    prediction = await readPrediction(res, "create");
  } catch (err) {
    if (err && err.key) throw err;
    throw codedError("EXTRACT_FAILED", "replicate request failed: " + err.message);
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  while (
    prediction &&
    (prediction.status === "starting" || prediction.status === "processing")
  ) {
    if (Date.now() > deadline) {
      throw codedError(
        "EXTRACT_FAILED",
        "replicate prediction " + prediction.id + " did not finish in time"
      );
    }
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await doFetch(prediction.urls.get, {
        headers: { Authorization: "Bearer " + apiKey },
      });
      prediction = await readPrediction(res, "poll");
    } catch (err) {
      if (err && err.key) throw err;
      throw codedError("EXTRACT_FAILED", "replicate poll failed: " + err.message);
    }
  }

  if (!prediction || prediction.status !== "succeeded") {
    const detail =
      prediction && prediction.error ? String(prediction.error).slice(0, 300) : "";
    throw codedError(
      "EXTRACT_FAILED",
      "replicate prediction ended " +
        (prediction ? prediction.status : "unknown") +
        (detail ? ": " + detail : "")
    );
  }

  const outputUrl = Array.isArray(prediction.output)
    ? prediction.output[prediction.output.length - 1]
    : prediction.output;
  if (typeof outputUrl !== "string" || outputUrl.length === 0) {
    throw codedError("EXTRACT_FAILED", "replicate returned no output file");
  }

  let png;
  try {
    const outRes = await doFetch(outputUrl);
    if (!outRes.ok) {
      throw new Error("output download status " + outRes.status);
    }
    png = Buffer.from(await outRes.arrayBuffer());
  } catch (err) {
    if (err && err.key) throw err;
    throw codedError("EXTRACT_FAILED", "replicate output fetch failed: " + err.message);
  }
  if (png.length === 0) {
    throw codedError("EXTRACT_FAILED", "replicate returned an empty image");
  }
  // predict_time is what Replicate bills on; extract.js records it
  // on the ai_usage event (OBS-3a) and pricing.js turns it into
  // the USD estimate.
  const predictSeconds =
    prediction.metrics && typeof prediction.metrics.predict_time === "number"
      ? prediction.metrics.predict_time
      : null;
  return { png, uncertainty: null, predictSeconds };
}

async function readPrediction(res, stage) {
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch (e) {
      /* body unreadable — the status alone is enough for the log */
    }
    throw codedError(
      "EXTRACT_FAILED",
      "replicate " + stage + " status " + res.status + ": " + detail
    );
  }
  return res.json();
}

module.exports = { segmentImage, MODEL, MODEL_VERSION };
