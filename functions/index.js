"use strict";

// index.js — Closet Cloud Functions (PC-6 + PC-10).
//
// Two callable functions. describeItem: the client sends either a Storage
// path to the signed-in user's own photo, or the photo bytes directly
// (base64) — PC-7 analyzes at upload-confirm time, before the item exists.
// askStylist: conversational outfit picks — the client sends its own item
// list plus recent chat messages; the model reasons text-only over the
// cached descriptions (no vision at recommendation time, per the decided
// research in PRODUCT.md). Auth is mandatory on both; model access is via
// Vertex AI + the function's service account, so no API key exists anywhere
// in the client or repo.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { describeImage } = require("./describe");
const { askStylist, sanitizeItems, sanitizeMessages } = require("./stylist");

initializeApp();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — phone photos, pre-resize

exports.describeItem = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const uid = request.auth.uid;
    const data = request.data || {};

    let buffer = null;
    let mimeType = "image/jpeg";

    if (typeof data.storagePath === "string" && data.storagePath.length > 0) {
      const expectedPrefix = "users/" + uid + "/";
      if (!data.storagePath.startsWith(expectedPrefix)) {
        throw new HttpsError(
          "permission-denied",
          "storagePath must point at your own photos."
        );
      }
      const file = getStorage().bucket().file(data.storagePath);
      const [metadata] = await file.getMetadata();
      mimeType = metadata.contentType || mimeType;
      const size = Number(metadata.size || 0);
      if (size > MAX_IMAGE_BYTES) {
        throw new HttpsError("invalid-argument", "Photo is too large.");
      }
      [buffer] = await file.download();
    } else if (typeof data.imageBase64 === "string" && data.imageBase64.length > 0) {
      buffer = Buffer.from(data.imageBase64, "base64");
      if (typeof data.mimeType === "string" && data.mimeType.startsWith("image/")) {
        mimeType = data.mimeType;
      }
    } else {
      throw new HttpsError(
        "invalid-argument",
        "Provide storagePath or imageBase64."
      );
    }

    if (!buffer || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      throw new HttpsError("invalid-argument", "Photo is empty or too large.");
    }

    try {
      return await describeImage(buffer, mimeType);
    } catch (err) {
      console.error("describeItem model call failed:", err);
      throw new HttpsError(
        "internal",
        "The description service is unavailable right now. Upload still works without it."
      );
    }
  }
);

exports.askStylist = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const data = request.data || {};
    const items = sanitizeItems(data.items);
    const messages = sanitizeMessages(data.messages);
    if (!items.length) {
      throw new HttpsError(
        "invalid-argument",
        "Your wardrobe looks empty — add a few pieces first."
      );
    }
    if (!messages.length) {
      throw new HttpsError("invalid-argument", "Tell me the occasion first.");
    }
    try {
      return await askStylist(items, messages);
    } catch (err) {
      console.error("askStylist model call failed:", err);
      throw new HttpsError(
        "internal",
        "The stylist is unavailable right now. Try again in a moment."
      );
    }
  }
);
