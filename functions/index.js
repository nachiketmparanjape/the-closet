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
const { askStylist, sanitizeItems, sanitizeMessages, sanitizePreviousPick, sanitizeTodayPick, sanitizeReferences, sanitizeStyleProfile, sanitizeVibe, sanitizeVibeProfile, sanitizeWeatherContext, sanitizeTripContext, sanitizePins } = require("./stylist");
const { reflectOutfit } = require("./reflect");
const { critiqueOutfit } = require("./critique");
const { parseOutfitPhoto } = require("./photo");
const { shopCheck } = require("./shopcheck");
const { fetchLinkItem } = require("./linkimport");
const { extractGarmentPhoto } = require("./extract");
const { makeUsageRecorder, createAiTracker, flushAiUsage } = require("./usage");
// Sprint 15 (PC-29 Phase 1): trip packing. sanitizeItems/sanitizeVibeProfile
// come from ./stylist (already imported above); only the trip-specific
// pieces live here.
const { planPacking, sanitizeTripInput } = require("./packing");
// PC-11: every expected failure goes through the catalog; every failure
// path logs with a correlation ID.
const { fail, newCorrelationId, logError, logSuccess, keyOf, logEvent, CATALOG } = require("./errors");
const { makeErrorEventRecorder } = require("./events");

// The default bucket is closet-404e9.firebasestorage.app (the appspot.com
// bucket exists but the client writes to firebasestorage.app). Without an
// explicit storageBucket, getStorage().bucket() throws "Bucket name not
// specified or invalid" — this broke shopCheck and parseOutfitPhoto, whose
// storage reads were never exercised before (describeItem sends base64).
initializeApp({ storageBucket: "closet-404e9.firebasestorage.app" });

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — phone photos, pre-resize

// OBS-2: the durable event sink (error_events). Created lazily —
// getFirestore() is valid at module scope after initializeApp,
// but the recorder factory tolerates a null db by design.
let _errorEventRecorder = null;
function recordErrorEvent(fields) {
  try {
    if (!_errorEventRecorder) _errorEventRecorder = makeErrorEventRecorder(getFirestore());
    _errorEventRecorder(fields);
  } catch (e) { /* the sink must never break the request path */ }
}

// Callable boundary: HttpsErrors (from fail()) pass through untouched;
// coded downstream errors map via their key; anything else is INTERNAL.
// The client never sees raw internals — only catalog messages.
function boundary(where, correlationId, uid, err) {
  logError(where, err, { uid: uid, correlationId: correlationId });
  const key = keyOf(err) || (err && err.key) || "INTERNAL";
  recordErrorEvent({
    kind: "failure", fn: where, key: key,
    category: (CATALOG[key] || {}).category || null,
    correlationId: correlationId, uid: uid,
    detail: err && err.message ? String(err.message).slice(0, 300) : null,
  });
  if (err instanceof HttpsError) throw err;
  fail(err && err.key ? err.key : "INTERNAL");
}

// Success counterpart to boundary(): one structured log line per
// successful request, so Cloud Logging can answer "what's the success
// rate of planPacking this week?" without any extra infrastructure.
function finish(where, correlationId, uid, start, result) {
  const durationMs = Date.now() - start;
  logSuccess(where, { correlationId: correlationId, uid: uid, durationMs: durationMs });
  recordErrorEvent({ kind: "success", fn: where, correlationId: correlationId, uid: uid, durationMs: durationMs });
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "describeItem", surface: "upload", refId: null };

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
      usageBase.refId = photoIds[0] || data.storagePath || null;
      const result = await describeImage(buffer, mimeType, photoIds, aiTracker.hooks);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("describeItem", correlationId, uid, start, result);
    } catch (err) {
      // Any failure inside describeImage is a downstream AI failure.
      if (!(err instanceof HttpsError) && !err.key) err.key = "DESCRIBE_FAILED";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
      boundary("describeItem", correlationId, uid, err);
    }
  }
);

// PC-34: garment extraction (BiRefNet via Replicate, founder's
// provider call 2026-10-23). The client sends the Storage path of
// a photo it already uploaded; the function reads the original
// (never writes to it), bakes in its EXIF orientation, stores a
// clean cutout render at a deterministic path, runs the two-layer
// quality gate, and returns the path + gate verdict — the client
// only displays a render that passed. The API token lives in
// Secret Manager (REPLICATE_API_TOKEN), bound in the deploy
// script's serviceConfig — never in code or the client.
exports.extractGarment = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    maxInstances: 5,
    secrets: ["REPLICATE_API_TOKEN"],
  },
  async (request) => {
    const correlationId = newCorrelationId();
    const uid = request.auth ? request.auth.uid : null;
    const start = Date.now();
    if (!request.auth) {
      fail("NOT_SIGNED_IN");
    }
    const data = request.data || {};
    try {
      if (typeof data.storagePath !== "string" || data.storagePath.length === 0) {
        fail("NO_IMAGE");
      }
      const result = await extractGarmentPhoto(uid, data.storagePath, {
        bucket: getStorage().bucket(),
        apiKey: process.env.REPLICATE_API_TOKEN || null,
        correlationId,
        recordUsage: makeUsageRecorder(getFirestore()),
      });
      return finish("extractGarment", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "EXTRACT_FAILED";
      boundary("extractGarment", correlationId, uid, err);
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "askStylist", surface: "chat", refId: null };
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const items = sanitizeItems(data.items);
      const messages = sanitizeMessages(data.messages);
      const previousPick = sanitizePreviousPick(data.previousPick);
      const todayPick = sanitizeTodayPick(data.todayPick);
      const references = sanitizeReferences(data.references, items);
      const weatherContext = sanitizeWeatherContext(data.weatherContext);
      const vibe = sanitizeVibe(data.vibe);
      // Sprint 16 (TRIPCHAT-1): optional trip-chat context. Malformed →
      // null; the chat proceeds without it. The client supplies the
      // trip + current packing; item ids are re-validated on execute.
      const tripContext = sanitizeTripContext(data.tripContext);
      usageBase.surface = tripContext ? "trip" : "chat";
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
        logEvent("subcall_degraded", { fn: "askStylist.vibeProfile", key: keyOf(e) });
        recordErrorEvent({ kind: "degraded", fn: "askStylist.vibeProfile", key: keyOf(e), correlationId: correlationId, uid: uid });
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
        logEvent("subcall_degraded", { fn: "askStylist.contextPins", key: keyOf(e) });
        recordErrorEvent({ kind: "degraded", fn: "askStylist.contextPins", key: keyOf(e), correlationId: correlationId, uid: uid });
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
        logEvent("subcall_degraded", { fn: "askStylist.styleProfile", key: keyOf(e) });
        recordErrorEvent({ kind: "degraded", fn: "askStylist.styleProfile", key: keyOf(e), correlationId: correlationId, uid: uid });
      }
      // Sprint 17 fix buffer: the client's local date (YYYY-MM-DD) —
      // the model resolves relative dates against it, and pins expire
      // by it. Malformed → null (server falls back to its own clock).
      const today = /^\d{4}-\d{2}-\d{2}$/.test(data.today || "") ? data.today : null;
      // OBS-2: the stylist's non-failure events (rejections,
      // self-heals) ride the same hooks object into the sink.
      const stylistHooks = Object.assign({}, aiTracker.hooks, {
        onEvent: function (kind, name, fields) {
          recordErrorEvent({
            kind: kind, fn: "askStylist:" + name, key: fields && fields.key || null,
            correlationId: correlationId, uid: uid,
            detail: fields ? JSON.stringify(fields).slice(0, 300) : null,
          });
        },
      });
      const result = await askStylist(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins, today, stylistHooks, todayPick);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("askStylist", correlationId, uid, start, result);
    } catch (err) {
      // Any failure inside askStylist is a downstream AI failure.
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "reflectOutfit", surface: "chat", refId: null };
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const ratingId = typeof data.ratingId === "string" ? data.ratingId.trim() : "";
      if (!ratingId || ratingId.length > 100) {
        fail("BAD_REQUEST");
      }
      usageBase.refId = ratingId;
      const result = await reflectOutfit(uid, ratingId, aiTracker.hooks);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("reflectOutfit", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "critiqueOutfit", surface: "chat", refId: null };
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const outfitId = typeof data.outfitId === "string" ? data.outfitId.trim() : "";
      if (!outfitId || outfitId.length > 100) {
        fail("BAD_REQUEST");
      }
      usageBase.refId = outfitId;
      const result = await critiqueOutfit(uid, outfitId, undefined, aiTracker.hooks);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("critiqueOutfit", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "parseOutfitPhoto", surface: "upload", refId: null };
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const storagePath = typeof data.storagePath === "string" ? data.storagePath.trim() : "";
      if (!storagePath || storagePath.length > 300) {
        fail("BAD_REQUEST");
      }
      usageBase.refId = storagePath;
      const result = await parseOutfitPhoto(uid, storagePath, undefined, aiTracker.hooks);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("parseOutfitPhoto", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "shopCheck", surface: "shop", refId: null };
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const storagePath = typeof data.storagePath === "string" ? data.storagePath.trim() : "";
      if (!storagePath || storagePath.length > 300) {
        fail("BAD_REQUEST");
      }
      usageBase.refId = storagePath;
      // PC-40: optional context — a trip this check is for (the
      // server reads the trip doc itself) and the wearer's own
      // question. Both sanitized; absence = the plain check.
      const shopCtx = {
        tripId: typeof data.tripId === "string" && data.tripId.length <= 80 ? data.tripId : null,
        question: typeof data.question === "string" ? data.question.trim().slice(0, 200) : "",
      };
      const result = await shopCheck(uid, storagePath, undefined, aiTracker.hooks, shopCtx);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("shopCheck", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
      boundary("shopCheck", correlationId, uid, err);
    }
  }
);

// PC-44: non-photo catalogue intake. Fetches a product page,
// stores its retail photo, and hands the client a storagePath
// to run through the ordinary add flow. No AI call here —
// describe runs on the photo afterwards, as usual.
exports.fetchLinkItem = onCall(
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
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "linkImport", surface: "catalogue", refId: null };
    try {
      if (!request.auth) {
        fail("NOT_SIGNED_IN");
      }
      const data = request.data || {};
      const url = typeof data.url === "string" ? data.url.trim() : "";
      if (!url || url.length > 2000) {
        fail("LINK_BAD_URL");
      }
      usageBase.refId = url.slice(0, 200);
      const result = await fetchLinkItem(uid, url);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("fetchLinkItem", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "LINK_UNREACHABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
      boundary("fetchLinkItem", correlationId, uid, err);
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
    // OBS-3b: AI usage tracking for this request (flushed below).
    const aiTracker = createAiTracker();
    const recordUsage = makeUsageRecorder(getFirestore());
    const usageBase = { correlationId, uid, feature: "planPacking", surface: "trip", refId: null };
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
        logEvent("subcall_degraded", { fn: "planPacking.vibeProfile", key: keyOf(e) });
        recordErrorEvent({ kind: "degraded", fn: "planPacking.vibeProfile", key: keyOf(e), correlationId: correlationId, uid: uid });
      }
      const result = await planPacking(items, trip.leg, trip.weatherSummary, trip.notes, vibeProfile, aiTracker.hooks);
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: true });
      return finish("planPacking", correlationId, uid, start, result);
    } catch (err) {
      if (!(err instanceof HttpsError) && !err.key) err.key = "AI_UNAVAILABLE";
      await flushAiUsage(recordUsage, usageBase, aiTracker.calls, { ok: false, key: err.key || null });
      boundary("planPacking", correlationId, uid, err);
    }
  }
);
