// friendly-error.js — PC-11 client error choke point.
//
// Pure function: takes whatever a catch site got, returns one human
// sentence. NEVER returns raw SDK messages, codes, or stack traces —
// those go to reportError() (the Sentry hook in index.html) instead.
//
// Loaded as a plain script before the app bundle; also required directly
// by the committed unit tests (tests/errors-client.test.js).
(function (global) {
  "use strict";

  // Canonical copy per error code. Firebase callable, Firestore, and Auth
  // errors all surface a string `code`; Storage prefixes its own.
  var CODE_COPY = {
    "unauthenticated": "Please sign in to continue.",
    "permission-denied": "You don't have access to that. Try signing in again.",
    "not-found": "That item doesn't exist anymore.",
    "already-exists": "That's already there.",
    "invalid-argument": "Something in that request wasn't right. Check and try again.",
    "failed-precondition": "That can't be done right now. Try again in a bit.",
    "resource-exhausted": "We're being rate-limited right now. Wait a minute and try again.",
    "unavailable": "Couldn't reach the server. Check your connection and try again.",
    "deadline-exceeded": "That took too long. Try again.",
    "cancelled": "That was cancelled. Try again.",
    "aborted": "That was interrupted. Try again.",
    "internal": "Something went wrong on our end. Try again.",
    "unknown": "Something went wrong. Try again.",
    // Firebase Storage codes
    "storage/unauthorized": "Please sign in to continue.",
    "storage/retry-limit-exceeded": "Couldn't reach the server. Check your connection and try again.",
    "storage/unknown": "Something went wrong. Try again.",
    "storage/canceled": "That was cancelled. Try again."
  };

  // Raw network failures that never got a code (fetch, SDK internals).
  var NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|offline/i;

  function friendlyError(err) {
    if (!err) return "Something went wrong. Try again.";
    var code = err.code;
    if (typeof code === "string" && CODE_COPY[code]) return CODE_COPY[code];
    // Some SDKs nest the code or only leave a message.
    var msg = err.message || String(err);
    if (NETWORK_RE.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "You're offline. Reconnect and try again.";
    }
    return "Something went wrong. Try again.";
  }

  global.friendlyError = friendlyError;
})(typeof window !== "undefined" ? window : globalThis);
