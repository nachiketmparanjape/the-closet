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
    try {
      if (!db || !fields || !fields.fn) return;
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
      db.collection("error_events").add(event).catch((err) => {
        console.error(JSON.stringify({ event: "error_event_write_failed", fn: fields.fn, err: err && err.message }));
      });
    } catch (err) {
      console.error(JSON.stringify({ event: "error_event_write_failed", err: err && err.message }));
    }
  };
}

module.exports = { makeErrorEventRecorder, KINDS };
