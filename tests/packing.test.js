// Sprint 15: trip packing pure functions (sanitizers + result mapping).
const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
  sanitizeLeg,
  sanitizeTripInput,
  planPackingResult,
  parsePackingJson,
} = require("../functions/packing");

const items = [
  { id: "a1", name: "White tee", category: "Tops" },
  { id: "b2", name: "Navy chinos", category: "Bottoms" },
  { id: "c3", name: "Denim jacket", category: "Outerwear" },
];

describe("sanitizeLeg", () => {
  test("accepts a valid leg", () => {
    const leg = sanitizeLeg({
      location: "Paris",
      resolvedName: "Paris, France",
      lat: 48.85,
      lng: 2.35,
      startDate: "2026-11-10",
      endDate: "2026-11-15",
    });
    assert.ok(leg);
    assert.strictEqual(leg.resolvedName, "Paris, France");
  });
  test("rejects bad coords, dates", () => {
    assert.strictEqual(sanitizeLeg({ location: "X", lat: 999, lng: 0, startDate: "2026-11-10", endDate: "2026-11-15" }), null);
    assert.strictEqual(sanitizeLeg({ location: "X", lat: 0, lng: 0, startDate: "2026-11-15", endDate: "2026-11-10" }), null);
    assert.strictEqual(sanitizeLeg({ location: "X", lat: 0, lng: 0, startDate: "tomorrow", endDate: "2026-11-10" }), null);
    assert.strictEqual(sanitizeLeg(null), null);
  });
  test("resolvedName falls back to location", () => {
    const leg = sanitizeLeg({ location: "Paris", lat: 48.8, lng: 2.3, startDate: "2026-11-10", endDate: "2026-11-11" });
    assert.strictEqual(leg.resolvedName, "Paris");
  });
});

describe("planPackingResult", () => {
  test("maps handles to ids, drops unknown handles", () => {
    const r = planPackingResult(
      {
        reply: "Pack light.",
        articles: [
          { handle: "i1", reason: "versatile" },
          { handle: "i2", reason: "goes with everything" },
          { handle: "i99", reason: "ghost" },
          { handle: "i1", reason: "dup" },
        ],
        outfits: [{ items: ["i1", "i2"], reasoning: "clean" }],
      },
      items
    );
    assert.deepStrictEqual(r.articles.map((a) => a.id), ["a1", "b2"]);
    assert.strictEqual(r.articles[0].reason, "versatile");
    assert.deepStrictEqual(r.outfits[0].itemIds, ["a1", "b2"]);
  });
  test("outfit items must be packed (stragglers dropped)", () => {
    const r = planPackingResult(
      {
        reply: "",
        articles: [{ handle: "i1", reason: "" }],
        outfits: [{ items: ["i1", "i3"], reasoning: "" }],
      },
      items
    );
    // i3 not packed → outfit drops below 2 → outfit dropped entirely
    assert.strictEqual(r.outfits.length, 0);
  });
  test("empty articles is an error at the planPacking level (not here)", () => {
    const r = planPackingResult({ reply: "", articles: [], outfits: [] }, items);
    assert.strictEqual(r.articles.length, 0);
  });
});

describe("parsePackingJson", () => {
  test("rejects non-JSON", () => {
    assert.throws(() => parsePackingJson("not json"), (e) => e.key === "AI_BAD_RESPONSE");
  });
});
