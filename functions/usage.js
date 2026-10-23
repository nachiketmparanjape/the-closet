"use strict";

// OBS-3a: the ai_usage writer. One append-only Firestore event per
// AI call (schema in docs/OBSERVABILITY.md), written server-side
// only — clients never see this collection (rules deny client
// access; the local usage-report reads it with the founder's own
// credentials).
//
// Fail-safe by contract: record() never throws. Analytics must not
// be able to break the user-facing call it measures; a failed
// write degrades to one console line.

const { FieldValue } = require("firebase-admin/firestore");
const { priceEvent, PRICING_VERSION } = require("./pricing");

// makeUsageRecorder(db) → async record(fields).
// fields: { correlationId, feature, provider, model, uid, surface,
// tokensIn, tokensOut, tokensThinking, predictSeconds, latencyMs,
// outcome, refId } — all optional except feature/provider/outcome;
// missing units simply price as null.
function makeUsageRecorder(db) {
  return async function recordUsage(fields) {
    try {
      if (!db || !fields || !fields.feature) return;
      const event = {
        ts: FieldValue.serverTimestamp(),
        correlationId: fields.correlationId || null,
        feature: fields.feature,
        provider: fields.provider || null,
        model: fields.model || null,
        uid: fields.uid || null,
        surface: fields.surface || null,
        tokensIn: fields.tokensIn != null ? fields.tokensIn : null,
        tokensOut: fields.tokensOut != null ? fields.tokensOut : null,
        tokensThinking: fields.tokensThinking != null ? fields.tokensThinking : null,
        predictSeconds: fields.predictSeconds != null ? fields.predictSeconds : null,
        latencyMs: fields.latencyMs != null ? fields.latencyMs : null,
        outcome: fields.outcome || "success",
        refId: fields.refId || null,
        costUsd: priceEvent(fields),
        pricingVersion: PRICING_VERSION,
      };
      await db.collection("ai_usage").add(event);
    } catch (err) {
      console.error(
        JSON.stringify({ event: "ai_usage_write_failed", feature: fields && fields.feature, err: err && err.message })
      );
    }
  };
}

// OBS-3b: per-request tracker for the Gemini callables. A module
// reports each model call through hooks.onUsage (see reportUsage
// in describe.js); the handler then flushes one ai_usage event
// per captured call once the callable's outcome is known.
function createAiTracker() {
  const calls = [];
  return {
    calls,
    hooks: {
      onUsage(u) {
        if (u && typeof u === "object") calls.push(u);
      },
    },
  };
}

const AI_ERROR_KEYS = new Set(["AI_UNAVAILABLE", "AI_BAD_RESPONSE"]);

// flushAiUsage(recordUsage, base, calls, outcome)
// base: { correlationId, uid, feature, surface, refId }.
// outcome: { ok: true } | { ok: false, key }.
// Semantics:
// - Every captured call consumed real tokens, so each becomes an
//   event. On success they are all "success".
// - On an AI_BAD_RESPONSE failure the LAST captured call is the
//   one that came back unusable: it is recorded as the error;
//   earlier calls in the same request still count as success.
// - On an AI-layer failure with NO captured call (the model call
//   itself threw — outage, quota), one token-less error event is
//   recorded so the failure is visible in the cost lens too.
// - Non-AI failures (validation, auth, bugs) record nothing:
//   OBS-2 owns error quality; OBS-3 counts AI consumption.
async function flushAiUsage(recordUsage, base, calls, outcome) {
  if (typeof recordUsage !== "function" || !base) return;
  const list = Array.isArray(calls) ? calls : [];
  const failed = !!(outcome && outcome.ok === false);
  const key = failed && typeof outcome.key === "string" ? outcome.key : null;
  for (let i = 0; i < list.length; i++) {
    const isLast = i === list.length - 1;
    const callOutcome =
      failed && key === "AI_BAD_RESPONSE" && isLast ? "error:AI_BAD_RESPONSE" : "success";
    try {
      await recordUsage(Object.assign({}, base, list[i], { outcome: callOutcome }));
    } catch (e) {
      /* the recorder is fail-safe; this is belt and braces */
    }
  }
  if (!list.length && failed && AI_ERROR_KEYS.has(key)) {
    try {
      await recordUsage(
        Object.assign({}, base, {
          provider: "vertex",
          model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
          outcome: "error:" + key,
        })
      );
    } catch (e) {
      /* as above */
    }
  }
}

module.exports = { makeUsageRecorder, createAiTracker, flushAiUsage };
