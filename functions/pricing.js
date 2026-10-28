"use strict";

// OBS-3 pricing table — the single place AI unit prices live.
// Every ai_usage event stores its raw units (tokens / predicted
// seconds) AND the estimate computed under PRICING_VERSION, so a
// price change here never rewrites history and any past window
// can be re-priced from its stored units. Unknown model or
// missing units price as null — an honest gap beats a made-up
// number, and the report shows unpriced volume separately.
//
// Rates (v1, 2026-10-23):
// - gemini-3.5-flash on Vertex (global endpoint, the one the app
//   calls): $1.50 input / $9.00 output per 1M tokens, corroborated
//   across Google launch coverage and two pricing indexes, Oct
//   2026. Thinking tokens bill as output. Cached-input discounts
//   are ignored (the app doesn't use context caching today) —
//   estimates run a hair high, never low.
// - BiRefNet on Replicate: $0.000225/s is the T4 rate from the
//   studio research note (verified 2026-10-21). The deployment's
//   hardware class gets confirmed at the first live call — if it
//   is not T4, this rate and PRICING_VERSION change together.

const PRICING_VERSION = "2026-10-23.v1";

const VERTEX_USD_PER_1M = {
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
};

const REPLICATE_USD_PER_SECOND = {
  "sprited/birefnet": 0.000225,
};

// fields: { provider, model, tokensIn, tokensOut, tokensThinking,
// predictSeconds } → USD estimate (number) or null when unpriceable.
function priceEvent(fields) {
  if (!fields || typeof fields !== "object") return null;
  if (fields.provider === "vertex") {
    const rate = VERTEX_USD_PER_1M[fields.model];
    if (!rate) return null;
    const inTok = num(fields.tokensIn);
    const outTok = num(fields.tokensOut) + num(fields.tokensThinking);
    if (inTok === null && outTok === 0) return null;
    return ((inTok || 0) * rate.input + outTok * rate.output) / 1e6;
  }
  if (fields.provider === "replicate") {
    const rate = REPLICATE_USD_PER_SECOND[fields.model];
    const secs = num(fields.predictSeconds);
    if (rate == null || secs === null) return null;
    return secs * rate;
  }
  return null;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

module.exports = { priceEvent, PRICING_VERSION, VERTEX_USD_PER_1M, REPLICATE_USD_PER_SECOND };
