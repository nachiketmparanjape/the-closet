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
const { getFirestore } = require("firebase-admin/firestore");
const { describeImage } = require("./describe");
const { askStylist, sanitizeItems, sanitizeMessages, sanitizePreviousPick, sanitizeReferences, sanitizeStyleProfile, sanitizeWeatherContext } = require("./stylist");
const { reflectOutfit } = require("./reflect");
const { critiqueOutfit } = require("./critique");
const { parseOutfitPhoto } = require("./photo");
const { shopCheck } = require("./shopcheck");
// PC-11: every expected failure goes through the catalog; every failure
// path logs with a correlation ID.
const { fail, newCorrelationId, logError } = require("./errors");

// The default bucket is closet-404e9.firebasestorage.app (the appspot.com
// bucket exists but the client writes to firebasestorage.app). Without an
// explicit storageBucket, getStorage().bucket() throws "Bucket name not
// specified or invalid" — this broke shopCheck and parseOutfitPhoto, whose
// storage reads were never exercised before (describeItem sends base64).
initializeApp({ storageBucket: "closet-404e9.firebasestorage.app" });

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — phone photos, pre-resize

// Callable boundary: HttpsErrors (from fail()) pass through untouched;
// coded downstream errors map via their key; anything else is INTERNAL.
// The client never sees raw internals — only catalog messages.
function boundary(where, correlationId, uid, err) {
  logError(where, err, { uid: uid, correlationId: correlationId });
  if (err instanceof HttpsError) throw err;
  fail(err && err.key ? err.key : "INTERNAL");
}

exports.describeItem = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    if (!request.auth) {
      fail("NOT_SIGNED_IN");
    }
    const data = request.data || {};

    let buffer = null;
    let mimeType = "image/jpeg";

    try {
      if (typeof data.storagePath === "string" && data.storagePath.length > 0) {
        const expectedPrefix = "users/" + uid + "/";
        if (!data.storagePath.startsWith(expectedPrefix)) {
          fail("NOT_YOUR_PHOTO");
        }
        const file = getStorage().bucket().file(data.storagePath);
        const [metadata] = await file.getMetadata();
        mimeType = metadata.contentType || mimeType;
        const size = Number(metadata.size || 0);
        if (size > MAX_IMAGE_BYTES) {
          fail("IMAGE_TOO_LARGE");
        }
        [buffer] = await file.download();
      } else if (typeof data.imageBase64 === "string" && data.imageBase64.length > 0) {
        buffer = Buffer.from(data.imageBase64, "base64");
        if (typeof data.mimeType === "string" && data.mimeType.startsWith("image/")) {
          mimeType = data.mimeType;
        }
      } else {
        fail("NO_IMAGE");
      }

      if (!buffer || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
        fail("BAD_IMAGE");
      }

      const photoIds = Array.isArray(data.photoIds)
        ? data.photoIds.filter((p) => typeof p === "string").slice(0, 4)
        : [];
      return await describeImage(buffer, mimeType, photoIds);
    } catch (err) {
      // Any failure inside describeImage is a downstream AI failure.
      if (!(err instanceof HttpsError) && !err.key) err.key = "DESCRIBE_FAILED";
      boundary("describeItem", correlationId, uid, err);
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
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const items = sanitizeItems(data.items);
      const messages = sanitizeMessages(data.messages);
      const previousPick = sanitizePreviousPick(data.previousPick);
      const references = sanitizeReferences(data.references, items);
      const weatherContext = sanitizeWeatherContext(data.weatherContext);
      if (!items.length) {
        fail("EMPTY_WARDROBE");
      }
      if (!messages.length) {
        fail("BAD_MESSAGES");
      }
      // PC-12: ground recommendations in confirmed style preferences.
      // Best-effort — a failed read never blocks the chat.
      let styleProfile = [];
      try {
        const profSnap = await getFirestore()
          .collection("users").doc(uid).collection("style_profile").doc(uid).get();
        if (profSnap.exists) {
          const prefs = profSnap.data().preferences;
          styleProfile = sanitizeStyleProfile(
            Array.isArray(prefs) ? prefs.map((p) => p && p.text) : []
          );
        }
      } catch (e) {
        logError("askStylist.styleProfile", e, { uid: uid, correlationId: correlationId });
      }
      return await askStylist(items, messages, styleProfile, previousPick, references, weatherContext);
    } catch (err) {
      // Any failure inside askStylist is a downstream AI failure.
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("askStylist", correlationId, uid, err);
    }
  }
);

// PC-12: post-wear reflection. The client writes the user's rating first
// (direct to Firestore); this callable runs the model reflection and
// persists it as a sibling app rating. Idempotent per ratingId — safe to
// retry after a failure.
exports.reflectOutfit = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const ratingId = typeof data.ratingId === "string" ? data.ratingId.trim() : "";
      if (!ratingId || ratingId.length > 100) {
        fail("BAD_REQUEST");
      }
      return await reflectOutfit(uid, ratingId);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("reflectOutfit", correlationId, uid, err);
    }
  }
);

exports.critiqueOutfit = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const outfitId = typeof data.outfitId === "string" ? data.outfitId.trim() : "";
      if (!outfitId || outfitId.length > 100) {
        fail("BAD_REQUEST");
      }
      return await critiqueOutfit(uid, outfitId);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("critiqueOutfit", correlationId, uid, err);
    }
  }
);

exports.parseOutfitPhoto = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const storagePath = typeof data.storagePath === "string" ? data.storagePath.trim() : "";
      if (!storagePath || storagePath.length > 300) {
        fail("BAD_REQUEST");
      }
      return await parseOutfitPhoto(uid, storagePath);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("parseOutfitPhoto", correlationId, uid, err);
    }
  }
);

// PC-14: shop compatibility check.
exports.shopCheck = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const storagePath = typeof data.storagePath === "string" ? data.storagePath.trim() : "";
      if (!storagePath || storagePath.length > 300) {
        fail("BAD_REQUEST");
      }
      return await shopCheck(uid, storagePath);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("shopCheck", correlationId, uid, err);
    }
  }
);
