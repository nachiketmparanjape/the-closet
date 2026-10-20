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
const { askStylist, sanitizeItems, sanitizeMessages, sanitizePreviousPick, sanitizeReferences, sanitizeStyleProfile, sanitizeVibe, sanitizeVibeProfile, sanitizeWeatherContext, sanitizeTripContext, sanitizePins } = require("./stylist");
const { reflectOutfit } = require("./reflect");
const { critiqueOutfit } = require("./critique");
const { parseOutfitPhoto } = require("./photo");
const { shopCheck } = require("./shopcheck");
// Sprint 15 (PC-29 Phase 1): trip packing. sanitizeItems/sanitizeVibeProfile
// come from ./stylist (already imported above); only the trip-specific
// pieces live here.
const { planPacking, sanitizeTripInput } = require("./packing");
// PC-11: every expected failure goes through the catalog; every failure
// path logs with a correlation ID.
const { fail, newCorrelationId, logError, logSuccess } = require("./errors");

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

// Success counterpart to boundary(): one structured log line per
// successful request, so Cloud Logging can answer "what's the success
// rate of planPacking this week?" without any extra infrastructure.
function finish(where, correlationId, uid, start, result) {
  logSuccess(where, { correlationId: correlationId, uid: uid, durationMs: Date.now() - start });
  return result;
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
    const start = Date.now();
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
      return finish("describeItem", correlationId, uid, start, await describeImage(buffer, mimeType, photoIds));
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
    const start = Date.now();
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
      const vibe = sanitizeVibe(data.vibe);
      // Sprint 16 (TRIPCHAT-1): optional trip-chat context. Malformed →
      // null; the chat proceeds without it. The client supplies the
      // trip + current packing; item ids are re-validated on execute.
      const tripContext = sanitizeTripContext(data.tripContext);
      // Sprint 13: learned vibe profile, read server-side (best-effort like
      // styleProfile — a failed read never blocks the chat). The client
      // never sends it; the server is the source of truth.
      let vibeProfile = null;
      try {
        const userSnap = await getFirestore().collection("users").doc(uid).get();
        if (userSnap.exists) {
          vibeProfile = sanitizeVibeProfile(userSnap.data().vibeProfile);
        }
      } catch (e) {
        logError("askStylist.vibeProfile", e, { uid: uid, correlationId: correlationId });
      }
      // Sprint 17 (CONTEXT PINS): confirmed current facts, read
      // server-side best-effort like the vibe profile. Expiry filtering
      // happens in buildStylistRequest (a pin past its date is ignored).
      let pins = [];
      try {
        const pinsSnap = await getFirestore()
          .collection("users").doc(uid).collection("context_pins").limit(20).get();
        pins = sanitizePins(pinsSnap.docs.map((d) => d.data()));
      } catch (e) {
        logError("askStylist.contextPins", e, { uid: uid, correlationId: correlationId });
      }
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
      return finish("askStylist", correlationId, uid, start, await askStylist(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins));
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
    const start = Date.now();
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const ratingId = typeof data.ratingId === "string" ? data.ratingId.trim() : "";
      if (!ratingId || ratingId.length > 100) {
        fail("BAD_REQUEST");
      }
      return finish("reflectOutfit", correlationId, uid, start, await reflectOutfit(uid, ratingId));
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
    const start = Date.now();
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const outfitId = typeof data.outfitId === "string" ? data.outfitId.trim() : "";
      if (!outfitId || outfitId.length > 100) {
        fail("BAD_REQUEST");
      }
      return finish("critiqueOutfit", correlationId, uid, start, await critiqueOutfit(uid, outfitId));
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
    const start = Date.now();
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const storagePath = typeof data.storagePath === "string" ? data.storagePath.trim() : "";
      if (!storagePath || storagePath.length > 300) {
        fail("BAD_REQUEST");
      }
      return finish("parseOutfitPhoto", correlationId, uid, start, await parseOutfitPhoto(uid, storagePath));
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
    const start = Date.now();
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const storagePath = typeof data.storagePath === "string" ? data.storagePath.trim() : "";
      if (!storagePath || storagePath.length > 300) {
        fail("BAD_REQUEST");
      }
      return finish("shopCheck", correlationId, uid, start, await shopCheck(uid, storagePath));
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("shopCheck", correlationId, uid, err);
    }
  }
);

// Sprint 15 (PC-29 Phase 1): trip packing. One AI call: ranked articles +
// 2–3 outfits from the user's wardrobe for a trip leg. Auth mandatory;
// the client sends its own item list (same trust model as askStylist).
exports.planPacking = onCall(
  {
    region: "us-central1",
    // Packing is not latency-sensitive: generous timeout for cold starts
    // (first invocation loads the model SDK) plus the model call itself.
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    const start = Date.now();
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const items = sanitizeItems(data.items);
      const trip = sanitizeTripInput(data);
      if (!items.length) {
        fail("EMPTY_WARDROBE");
      }
      if (!trip.leg) {
        fail("BAD_REQUEST");
      }
      // Learned vibe profile, server-side best-effort (same as askStylist).
      let vibeProfile = null;
      try {
        const userSnap = await getFirestore().collection("users").doc(uid).get();
        if (userSnap.exists) {
          vibeProfile = sanitizeVibeProfile(userSnap.data().vibeProfile);
        }
      } catch (e) {
        logError("planPacking.vibeProfile", e, { uid: uid, correlationId: correlationId });
      }
      return finish("planPacking", correlationId, uid, start, await planPacking(items, trip.leg, trip.weatherSummary, trip.notes, vibeProfile));
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      boundary("planPacking", correlationId, uid, err);
    }
  }
);
