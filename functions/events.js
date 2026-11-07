"use strict";

// OBS-2: the error_events writer — the durable, queryable mirror
// of the structured logs. One append-only Firestore event per
// callable outcome (success / failure) and per non-failure event
// worth counting (rejection, degradation, self-heal), so the
// local quality report can answer "what's failing, how often,
// since when" without a Cloud Logging dig. Server-side only —
// clients never see this collection (rules deny client access,
// same as ai_usage).
//
// Fail-safe by contract, same as usage.js: record() never
// throws and is fire-and-forget from the request path.

const { FieldValue } = require("firebase-admin/firestore");

const KINDS = ["success", "failure", "rejection", "degraded", "self_heal"];

function makeErrorEventRecorder(db) {
  return function recordErrorEvent(fields) {
    // Returns a promise that resolves when the write completes (or fails).
    // Callers on the error path SHOULD await this — a fire-and-forget write
    // can be silently dropped if the Cloud Function returns first (seen
    // 2026-11-02: heartbeat probe failed twice, no event in error_events).
    // Success-path callers may still fire-and-forget for latency.
    try {
      if (!db || !fields || !fields.fn) return Promise.resolve(false);
      const event = {
        ts: FieldValue.serverTimestamp(),
        kind: KINDS.includes(fields.kind) ? fields.kind : "failure",
        fn: fields.fn,
        key: fields.key || null,
        category: fields.category || null,
        correlationId: fields.correlationId || null,
        uid: fields.uid || null,
        durationMs: fields.durationMs != null ? fields.durationMs : null,
        // Shape-only detail (arg keys, stage names) — never user
        // content. Capped hard.
        detail: fields.detail ? String(fields.detail).slice(0, 300) : null,
      };
      return db.collection("error_events").add(event).then(
        () => true,
        (err) => {
          console.error(JSON.stringify({ event: "error_event_write_failed", fn: fields.fn, err: err && err.message }));
          return false;
        }
      );
    } catch (err) {
      console.error(JSON.stringify({ event: "error_event_write_failed", err: err && err.message }));
      return Promise.resolve(false);
    }
  };
}

module.exports = { makeErrorEventRecorder, KINDS };
