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

module.exports = { makeUsageRecorder };
