"use strict";

// PC-34 provider: Photoroom Remove Background API.
// POST https://sdk.photoroom.com/v1/segment, key in the x-api-key
// header, image as multipart field image_file. The response body is
// the cutout PNG; the x-uncertainty-score header (0 confident, 1
// unsure) rides along for the review flag. Verified live in the
// 2026-10-22 trial (10 production calls, all 200).
//
// This module is the swappable seam: extract.js depends only on the
// { png, uncertainty } shape, so a future provider (or the
// self-hosted route past ~5,000 images/month) replaces this file,
// not the pipeline.

const { codedError } = require("./errors");

const SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";

async function segmentImage(buffer, mimeType, apiKey, fetchImpl) {
  if (!apiKey) {
    throw codedError("EXTRACT_NOT_CONFIGURED", "PHOTOROOM_API_KEY is not set");
  }
  const doFetch = fetchImpl || fetch;
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "image/jpeg" });
  form.append("image_file", blob, "photo.jpg");

  let res;
  try {
    res = await doFetch(SEGMENT_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: form,
    });
  } catch (err) {
    throw codedError("EXTRACT_FAILED", "photoroom request failed: " + err.message);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch (e) {
      /* body unreadable — the status alone is enough for the log */
    }
    throw codedError("EXTRACT_FAILED", "photoroom status " + res.status + ": " + detail);
  }

  const png = Buffer.from(await res.arrayBuffer());
  if (png.length === 0) {
    throw codedError("EXTRACT_FAILED", "photoroom returned an empty image");
  }
  const rawScore =
    res.headers && typeof res.headers.get === "function"
      ? res.headers.get("x-uncertainty-score")
      : null;
  const parsed = rawScore == null ? NaN : Number(rawScore);
  return { png, uncertainty: Number.isFinite(parsed) ? parsed : null };
}

module.exports = { segmentImage, SEGMENT_URL };
