"use strict";

// PC-34: garment extraction orchestration.
// Reads the caller's ORIGINAL photo from Storage (never writes to
// it), asks the provider for a cutout, and stores the render beside
// the originals at a deterministic path. Re-running extraction for
// the same photo overwrites the same render — no orphan files, no
// duplicate renders.
//
// Invariants (founder requirements, 2026-10-22):
// - The original photo is retained untouched.
// - The PC-19 pHash lives on the photo entry and is computed by the
//   client from the original. Nothing here reads or writes it, so
//   duplicate detection is unaffected by extraction.

const crypto = require("crypto");
const { codedError } = require("./errors");
const { segmentImage } = require("./photoroom");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches describeItem

function renderPathFor(uid, storagePath) {
  const hash = crypto
    .createHash("sha256")
    .update(storagePath)
    .digest("hex")
    .slice(0, 32);
  return "users/" + uid + "/renders/" + hash + ".png";
}

// deps are injectable for tests: { bucket, apiKey, fetchImpl }.
async function extractGarmentPhoto(uid, storagePath, deps) {
  const expectedPrefix = "users/" + uid + "/";
  if (typeof storagePath !== "string" || !storagePath.startsWith(expectedPrefix)) {
    throw codedError("NOT_YOUR_PHOTO", "storagePath outside caller prefix: " + storagePath);
  }
  if (!deps.apiKey) {
    throw codedError("EXTRACT_NOT_CONFIGURED", "PHOTOROOM_API_KEY is not set");
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

  const { png, uncertainty } = await segmentImage(
    buffer,
    metadata.contentType || "image/jpeg",
    deps.apiKey,
    deps.fetchImpl
  );

  const renderStoragePath = renderPathFor(uid, storagePath);
  await deps.bucket.file(renderStoragePath).save(png, {
    contentType: "image/png",
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  return { renderStoragePath, uncertainty, provider: "photoroom" };
}

module.exports = { extractGarmentPhoto, renderPathFor, MAX_IMAGE_BYTES };
