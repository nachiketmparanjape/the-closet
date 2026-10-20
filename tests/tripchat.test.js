// Sprint 16 (TRIPCHAT-1): server pure functions for trip chat mode.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
  sanitizeTripContext,
  extractToolCall,
  handleIndex,
} = require("../functions/stylist");

describe("sanitizeTripContext", () => {
  test("returns null for non-objects and missing tripId", () => {
    assert.strictEqual(sanitizeTripContext(null), null);
    assert.strictEqual(sanitizeTripContext("x"), null);
    assert.strictEqual(sanitizeTripContext({}), null);
    assert.strictEqual(sanitizeTripContext({ tripId: "" }), null);
  });

  test("passes a valid context through, clamped", () => {
    const ctx = sanitizeTripContext({
      tripId: "abc",
      tripName: "Vancouver",
      leg: {
        location: "Vancouver",
        resolvedName: "Vancouver, Canada",
        startDate: "2026-10-29",
        endDate: "2026-11-06",
      },
      notes: "skiing maybe",
      weatherSummary: "cold and rainy",
      packing: {
        articleIds: ["a", "b", 42, "", "x".repeat(200)],
        articleReasons: { a: "warm", b: "light" },
        outfits: [{ itemIds: ["a", "b"], reasoning: "city day" }],
      },
    });
    assert.strictEqual(ctx.tripId, "abc");
    assert.strictEqual(ctx.tripName, "Vancouver");
    assert.strictEqual(ctx.leg.startDate, "2026-10-29");
    assert.strictEqual(ctx.weatherSummary, "cold and rainy");
    assert.deepStrictEqual(ctx.packing.articleIds, ["a", "b"]);
    assert.deepStrictEqual(ctx.packing.outfits, [
      { itemIds: ["a", "b"], reasoning: "city day" },
    ]);
  });

  test("caps packing lists and drops malformed outfits", () => {
    const ctx = sanitizeTripContext({
      tripId: "abc",
      packing: {
        articleIds: new Array(50).fill("id").map((x, i) => x + i),
        outfits: [
          { itemIds: ["id1"] }, // single piece — dropped
          { itemIds: ["id1", "id2"], reasoning: "ok" },
        ],
      },
    });
    assert.strictEqual(ctx.packing.articleIds.length, 30);
    assert.strictEqual(ctx.packing.outfits.length, 1);
    assert.strictEqual(ctx.packing.outfits[0].reasoning, "ok");
  });

  test("rejects bad date formats", () => {
    const ctx = sanitizeTripContext({
      tripId: "abc",
      leg: { startDate: "tomorrow", endDate: "2026/11/06" },
    });
    assert.strictEqual(ctx.leg.startDate, "");
    assert.strictEqual(ctx.leg.endDate, "");
  });
});

describe("extractToolCall", () => {
  test("reads the SDK functionCalls shape", () => {
    const r = extractToolCall({
      functionCalls: [{ name: "updateTripPacking", args: { whatChanged: "warmer" } }],
      text: "",
    });
    assert.deepStrictEqual(r, {
      name: "updateTripPacking",
      args: { whatChanged: "warmer" },
    });
  });

  test("reads the raw candidates-parts shape", () => {
    const r = extractToolCall({
      candidates: [
        { content: { parts: [{ functionCall: { name: "updateTripPacking", args: {} } }] } },
      ],
    });
    assert.strictEqual(r.name, "updateTripPacking");
  });

  test("returns null when there is no call", () => {
    assert.strictEqual(extractToolCall({}), null);
    assert.strictEqual(extractToolCall(null), null);
    assert.strictEqual(extractToolCall({ functionCalls: [] }), null);
  });
});

describe("handleIndex", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  test("maps [iN] to a 0-based index", () => {
    assert.strictEqual(handleIndex("[i1]", items), 0);
    assert.strictEqual(handleIndex("[i3]", items), 2);
  });
  test("rejects out-of-range and malformed handles", () => {
    assert.strictEqual(handleIndex("[i0]", items), -1);
    assert.strictEqual(handleIndex("[i4]", items), -1);
    assert.strictEqual(handleIndex("i2", items), -1);
    assert.strictEqual(handleIndex("[x2]", items), -1);
    assert.strictEqual(handleIndex(null, items), -1);
  });
});
