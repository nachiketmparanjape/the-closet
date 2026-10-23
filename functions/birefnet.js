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
// VERIFY-AT-FIRST-LIVE-CALL: MODEL and the "image" input name are
// the canonical public BiRefNet deployment values, but Replicate's
// API refuses unauthenticated model lookups, so the pinned model
// version could not be read before the founder's token existed.
// The deploy smoke call (one wardrobe photo, by hand) is the check:
// a wrong model id fails loudly as EXTRACT_FAILED, and the fix is
// this one constant (plus optionally MODEL_VERSION to pin a hash).
//
// This module is the swappable seam: extract.js depends only on the
// { png, uncertainty } shape. BiRefNet returns no uncertainty score,
// so uncertainty is always null here — the quality gate in
// extract.js / extractcheck.js replaces what Photoroom's score did.

const { codedError } = require("./errors");

const MODEL = "zhengpeng-7/birefnet";
const MODEL_VERSION = null; // pin a version hash here once verified live
const API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 90000; // the callable's own timeout is 120s

async function segmentImage(buffer, mimeType, apiKey, fetchImpl, opts) {
  if (!apiKey) {
    throw codedError("EXTRACT_NOT_CONFIGURED", "REPLICATE_API_TOKEN is not set");
  }
  const options = opts || {};
  const doFetch = fetchImpl || fetch;
  const sleep =
    options.sleepImpl || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const version = options.modelVersion || MODEL_VERSION;
  const dataUri =
    "data:" + (mimeType || "image/jpeg") + ";base64," + buffer.toString("base64");

  const createUrl = version
    ? API_BASE + "/predictions"
    : API_BASE + "/models/" + MODEL + "/predictions";
  const createBody = version
    ? { version, input: { image: dataUri } }
    : { input: { image: dataUri } };

  let prediction;
  try {
    const res = await doFetch(createUrl, {
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
