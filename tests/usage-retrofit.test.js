// OBS-3b: the retrofit plumbing — reportUsage normalization
// (describe.js), the per-request tracker, and flush semantics
// (usage.js). The contract under test: every captured model call
// becomes exactly one ai_usage event; an AI-layer failure with no
// captured call still leaves one token-less error event; non-AI
// failures leave nothing.
const { test, describe } = require("node:test");
const assert = require("node:assert");

const { reportUsage } = require("../functions/describe");
const { createAiTracker, flushAiUsage } = require("../functions/usage");

const BASE = { correlationId: "req_x", uid: "u1", feature: "askStylist", surface: "chat", refId: null };

function recorder() {
  const events = [];
  return { events, record: async (f) => events.push(f) };
}

function call(tokensIn) {
  return { provider: "vertex", model: "gemini-3.5-flash", tokensIn, tokensOut: 10, tokensThinking: 5, latencyMs: 100 };
}

describe("reportUsage", () => {
  test("normalizes usageMetadata into a call record", () => {
    const tracker = createAiTracker();
    const response = { usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 450 } };
    reportUsage(tracker.hooks, response, "gemini-3.5-flash", Date.now() - 50);
    assert.equal(tracker.calls.length, 1);
    const c = tracker.calls[0];
    assert.equal(c.provider, "vertex");
    assert.equal(c.model, "gemini-3.5-flash");
    assert.equal(c.tokensIn, 1200);
    assert.equal(c.tokensOut, 300);
    assert.equal(c.tokensThinking, 450);
    assert.ok(c.latencyMs >= 50);
  });

  test("missing metadata yields nulls, and no hook is a no-op", () => {
    const tracker = createAiTracker();
    reportUsage(tracker.hooks, {}, "gemini-3.5-flash", Date.now());
    assert.equal(tracker.calls[0].tokensIn, null);
    reportUsage(null, { usageMetadata: { promptTokenCount: 1 } }, "m", Date.now()); // must not throw
    reportUsage({}, null, "m", Date.now()); // must not throw
  });
});

describe("flushAiUsage", () => {
  test("success: one success event per captured call", async () => {
    const { events, record } = recorder();
    await flushAiUsage(record, BASE, [call(100), call(200)], { ok: true });
    assert.equal(events.length, 2);
    assert.ok(events.every((e) => e.outcome === "success" && e.feature === "askStylist"));
    assert.equal(events[1].tokensIn, 200);
  });

  test("AI_BAD_RESPONSE: the last captured call carries the error", async () => {
    const { events, record } = recorder();
    await flushAiUsage(record, BASE, [call(100), call(200)], { ok: false, key: "AI_BAD_RESPONSE" });
    assert.equal(events.length, 2);
    assert.equal(events[0].outcome, "success");
    assert.equal(events[1].outcome, "error:AI_BAD_RESPONSE");
  });

  test("AI_UNAVAILABLE after captured calls: captured stay success, no phantom event", async () => {
    const { events, record } = recorder();
    await flushAiUsage(record, BASE, [call(100)], { ok: false, key: "AI_UNAVAILABLE" });
    assert.equal(events.length, 1);
    assert.equal(events[0].outcome, "success");
  });

  test("AI-layer failure with no captured call: one token-less error event", async () => {
    const { events, record } = recorder();
    await flushAiUsage(record, BASE, [], { ok: false, key: "AI_UNAVAILABLE" });
    assert.equal(events.length, 1);
    assert.equal(events[0].outcome, "error:AI_UNAVAILABLE");
    assert.equal(events[0].tokensIn, undefined); // recorder stamps nulls downstream
    assert.equal(events[0].provider, "vertex");
  });

  test("non-AI failures record nothing", async () => {
    const { events, record } = recorder();
    await flushAiUsage(record, BASE, [], { ok: false, key: "EMPTY_WARDROBE" });
    await flushAiUsage(record, BASE, [], { ok: false, key: null });
    await flushAiUsage(record, BASE, [], { ok: false, key: "NOT_SIGNED_IN" });
    assert.equal(events.length, 0);
  });
});
