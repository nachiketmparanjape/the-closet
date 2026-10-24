// Unit tests for PC-14 shop compatibility check (Sprint 11). Prompt shape,
// response validation (hallucinated ids dropped), and handler edge paths.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildShopCheckRequest, parseShopCheckJson, shopCheck } = require("../functions/shopcheck.js");

const items = [
  { id: "a", name: "Black tee", category: "Tops", colors: [{ name: "black" }] },
  { id: "b", name: "Navy jeans", category: "Bottoms", colors: [{ name: "navy" }] },
  { id: "c", name: "White sneakers", category: "Shoes", colors: [{ name: "white" }] },
];

describe("buildShopCheckRequest", () => {
  it("embeds the wardrobe with ids and the photo, and forbids price talk", () => {
    const { contents, config } = buildShopCheckRequest("Zm9v", "image/jpeg", items);
    const text = contents[0].parts[0].text;
    assert.ok(text.includes('id="a"'));
    assert.ok(text.includes("Black tee"));
    assert.ok(text.includes("JSON only"));
    assert.ok(text.includes("Never comment on price"));
    assert.equal(contents[0].parts[1].inlineData.data, "Zm9v");
    assert.equal(config.responseMimeType, "application/json");
  });
});

describe("parseShopCheckJson", () => {
  it("parses a full result and drops hallucinated/dup ids", () => {
    const r = parseShopCheckJson(JSON.stringify({
      item: { category: "Tops", colors: ["olive"], pattern: "solid", note: "Olive henley" },
      score: 7.6,
      verdict: "Fills a gap.",
      reasons: ["Nothing olive", "Goes with navy"],
      similarOwned: [
        { itemId: "a", note: "Same vibe" },
        { itemId: "zzz", note: "hallucinated" },
        { itemId: "a", note: "dup" },
      ],
      outfits: [
        { pieces: ["a", "b"], note: "Works" },
        { pieces: ["zzz", "b"], note: "one real id only — dropped" },
        { pieces: ["a", "zzz"], note: "single piece — dropped" },
      ],
    }), ["a", "b", "c"]);
    assert.equal(r.notClothing, false);
    assert.equal(r.score, 8);
    assert.equal(r.verdict, "Fills a gap.");
    assert.deepEqual(r.similarOwned, [{ itemId: "a", note: "Same vibe" }]);
    assert.deepEqual(r.outfits, [{ pieces: ["a", "b"], note: "Works" }]);
  });

  it("handles the not-clothing short-circuit", () => {
    const r = parseShopCheckJson('{"notClothing": true}', ["a"]);
    assert.deepEqual(r, { notClothing: true });
  });

  it("passes through the AI short name", () => {
    const r = parseShopCheckJson(JSON.stringify({
      item: { name: "Off-white running hat", category: "Accessories", colors: [], pattern: "solid", note: "An off-white running hat..." },
      score: 5, verdict: "v",
    }), ["a"]);
    assert.equal(r.item.name, "Off-white running hat");
  });

  it("constrains category to the app vocabulary", () => {
    const ok = parseShopCheckJson(JSON.stringify({
      item: { category: "Accessories", colors: [], pattern: "solid", note: "Cap" },
      score: 5, verdict: "v",
    }), ["a"]);
    assert.equal(ok.item.category, "Accessories");
    const bad = parseShopCheckJson(JSON.stringify({
      item: { category: "Headwear", colors: [], pattern: "solid", note: "Cap" },
      score: 5, verdict: "v",
    }), ["a"]);
    assert.equal(bad.item.category, "Other");
  });

  it("caps outfits at 3 and reasons at 4", () => {
    const r = parseShopCheckJson(JSON.stringify({
      score: 5, verdict: "v",
      reasons: ["1", "2", "3", "4", "5"],
      outfits: [
        { pieces: ["a", "b"] }, { pieces: ["b", "c"] },
        { pieces: ["a", "c"] }, { pieces: ["a", "b", "c"] },
      ],
    }), ["a", "b", "c"]);
    assert.equal(r.reasons.length, 4);
    assert.equal(r.outfits.length, 3);
  });

  it("throws AI_BAD_RESPONSE on non-JSON", () => {
    assert.throws(() => parseShopCheckJson("not json at all", ["a"]), (e) => e.key === "AI_BAD_RESPONSE");
  });

  it("clamps a wild score into 0-10 and nulls a missing one", () => {
    assert.equal(parseShopCheckJson('{"score": 99}', ["a"]).score, 10);
    assert.equal(parseShopCheckJson('{"score": -3}', ["a"]).score, 0);
    assert.equal(parseShopCheckJson('{"score": "high"}', ["a"]).score, null);
  });
});

describe("shopCheck handler", () => {
  it("rejects a storage path outside the user's shop-checks folder", async () => {
    await assert.rejects(
      shopCheck("u1", "users/u1/outfit-photos/x.jpg", {}),
      (e) => e.key === "NOT_YOUR_PHOTO"
    );
    await assert.rejects(
      shopCheck("u1", "users/other/shop-checks/x.jpg", {}),
      (e) => e.key === "NOT_YOUR_PHOTO"
    );
  });
});

describe("PC-40: contextual shop checks", () => {
  const { loadTripContext } = require("../functions/shopcheck.js");
  const trip = {
    id: "t1", name: "Hong Kong", location: "Hong Kong",
    startDate: "2026-11-23", endDate: "2026-11-29",
    weather: "highs 75°F, lows 65°F", notes: "",
    packedNames: ["Black tee"],
  };
  it("the prompt carries the trip + the question when context is given", () => {
    const { contents } = buildShopCheckRequest("Zm9v", "image/jpeg", items, { trip, question: "Warm enough for evenings?" });
    const text = contents[0].parts[0].text;
    assert.ok(text.includes("TRIP CONTEXT"));
    assert.ok(text.includes("Hong Kong"));
    assert.ok(text.includes("Already packed for this trip: Black tee"));
    assert.ok(text.includes("THE WEARER'S QUESTION"));
    assert.ok(text.includes("Warm enough for evenings?"));
  });
  it("without context the prompt is the original wardrobe-only check", () => {
    const { contents } = buildShopCheckRequest("Zm9v", "image/jpeg", items);
    const text = contents[0].parts[0].text;
    assert.ok(!text.includes("TRIP CONTEXT"));
    assert.ok(!text.includes("WEARER'S QUESTION"));
  });
  it("loadTripContext shapes the trip and degrades to null", async () => {
    const fakeDb = {
      collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => ({
        exists: true,
        data: () => ({
          name: "Hong Kong", notes: "",
          legs: [{ location: "HK", resolvedName: "Hong Kong", startDate: "2026-11-23", endDate: "2026-11-29" }],
          weatherSnapshot: "highs 75°F",
          packing: { articleIds: ["a", "zzz"] },
        }),
      }) }) }) }) }),
    };
    const ctx = await loadTripContext(fakeDb, "u1", "t1", items);
    assert.equal(ctx.name, "Hong Kong");
    assert.deepEqual(ctx.packedNames, ["Black tee"]);
    assert.equal(await loadTripContext(fakeDb, "u1", null, items), null);
    const boomDb = { collection: () => { throw new Error("nope"); } };
    assert.equal(await loadTripContext(boomDb, "u1", "t1", items), null);
  });
});
