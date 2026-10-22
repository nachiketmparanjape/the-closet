// PC-11: standardized server error catalog.
//
// Every expected failure has a key. The catalog maps it to a category, an
// HttpsError code, and a client-safe message. The client never sees raw
// internals — details go to the structured server log with a correlation
// ID, so a user report maps to one trace.
//
// Unexpected failures (bugs, downstream outages) are NOT in this catalog:
// throw a plain Error (or a codedError for a known downstream failure),
// the callable boundary logs it with a correlation ID and the client gets
// a generic message.
"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { error: logErrorRaw, info: logInfoRaw } = require("firebase-functions/logger");
const crypto = require("crypto");

const CATALOG = {
  // auth
  NOT_SIGNED_IN: {
    category: "auth",
    grpc: "unauthenticated",
    message: "Please sign in to continue.",
  },
  // validation
  NO_IMAGE: {
    category: "validation",
    grpc: "invalid-argument",
    message: "No photo was provided.",
  },
  NOT_YOUR_PHOTO: {
    category: "auth",
    grpc: "permission-denied",
    message: "You can only use your own photos.",
  },
  BAD_IMAGE: {
    category: "validation",
    grpc: "invalid-argument",
    message: "That photo couldn't be read. Try a JPEG, PNG, or WebP under 10 MB.",
  },
  IMAGE_TOO_LARGE: {
    category: "validation",
    grpc: "invalid-argument",
    message: "Each photo must be under 10 MB.",
  },
  BAD_MESSAGES: {
    category: "validation",
    grpc: "invalid-argument",
    message: "That message couldn't be sent. Try again.",
  },
  BAD_REQUEST: {
    category: "validation",
    grpc: "invalid-argument",
    message: "Something in that request wasn't right.",
  },
  EMPTY_WARDROBE: {
    category: "validation",
    grpc: "invalid-argument",
    message: "Your wardrobe looks empty — add a few pieces first.",
  },
  // dependency (a downstream service failed)
  AI_UNAVAILABLE: {
    category: "dependency",
    grpc: "internal",
    message: "The AI service is having trouble right now. Please try again in a bit.",
  },
  AI_BAD_RESPONSE: {
    category: "dependency",
    grpc: "internal",
    message: "The AI service returned something unusable. Please try again.",
  },
  DESCRIBE_FAILED: {
    category: "dependency",
    grpc: "internal",
    message: "The description service is having trouble. Your upload still works without it.",
  },
  EXTRACT_NOT_CONFIGURED: {
    category: "dependency",
    grpc: "internal",
    message: "Photo cleanup isn't switched on yet. Your original photo is saved as-is.",
  },
  EXTRACT_FAILED: {
    category: "dependency",
    grpc: "internal",
    message: "Photo cleanup had trouble with that one. Your original photo is untouched.",
  },
  // internal (our bug — the client message stays generic on purpose)
  INTERNAL: {
    category: "internal",
    grpc: "internal",
    message: "Something went wrong on our end. Please try again.",
  },
};

// Throw the catalog entry for key. Unknown keys become INTERNAL —
// failing closed, never leaking.
function fail(key) {
  const entry = CATALOG[key] || CATALOG.INTERNAL;
  throw new HttpsError(entry.grpc, entry.message);
}

// A plain Error carrying a catalog key plus an internal-only detail.
// Throw these for expected downstream failures; the callable boundary
// maps them through fail(). The detail never reaches the client.
function codedError(key, detail) {
  const err = new Error(detail || key);
  err.key = CATALOG[key] ? key : "INTERNAL";
  return err;
}

// One correlation ID per request. Pass it through every log line and it
// connects a user's "it broke" report to a single server-side trace.
function newCorrelationId() {
  return "req_" + crypto.randomBytes(8).toString("hex");
}

// Structured server log for a failed request. Server-side only —
// err.message and stack are fine here, they never reach the client.
function logError(where, err, context) {
  const fields = Object.assign({}, context || {}, {
    err: err && err.message,
    key: (err && err.key) || undefined,
  });
  if (err && err.stack) fields.stack = err.stack;
  logErrorRaw(where + " failed", fields);
}

// Structured server log for a successful callable request. Pairs with
// logError in Cloud Logging, so success rates per function are a query
// (not a guess). No user content — only timing, outcome, and ids.
function logSuccess(where, context) {
  logInfoRaw(where + " succeeded", Object.assign({ outcome: "success" }, context || {}));
}

module.exports = { CATALOG, fail, codedError, newCorrelationId, logError, logSuccess };
