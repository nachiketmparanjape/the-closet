// Committed unit tests for PC-12 (structured stylist output + style profile).
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { sanitizeItems, sanitizeStyleProfile, mapOutfitToIds } = require("../functions/stylist.js");

describe("sanitizeItems (PC-12)", () => {
  it("keeps a cleaned id for server-side name→id mapping", () => {
    const items = sanitizeItems([{ id: "abc123", name: "Navy Tee", category: "Tops" }]);
    assert.equal(items[0].id, "abc123");
  });
  it("drops missing ids without breaking", () => {
    const items = sanitizeItems([{ name: "Navy Tee" }]);
    assert.equal(items[0].id, "");
  });
});

describe("mapOutfitToIds", () => {
  const wardrobe = [
    { id: "1", name: "Navy Tee" },
    { id: "2", name: "Khaki Chinos" },
    { id: "3", name: "White Sneakers" },
  ];

  it("maps exact names to ids and drops misses", () => {
    const out = mapOutfitToIds(
      { items: ["Navy Tee", "Khaki Chinos", "Nonexistent"], confidence: 8, reasoning: "Nice." },
      wardrobe
    );
    assert.deepEqual(out.itemIds, ["1", "2"]);
    assert.equal(out.confidence, 8);
    assert.equal(out.reasoning, "Nice.");
  });

  it("matches case-insensitively, dedupes, and clamps confidence", () => {
    const out = mapOutfitToIds(
      { items: ["Navy Tee", "navy tee", "Khaki Chinos"], confidence: 11, reasoning: "x" },
      wardrobe
    );
    assert.deepEqual(out.itemIds, ["1", "2"]);
    assert.equal(out.confidence, 10);
  });

  it("returns null when fewer than two ids validate", () => {
    assert.equal(
      mapOutfitToIds({ items: ["Navy Tee", "Nonexistent"], confidence: 8, reasoning: "x" }, wardrobe),
      null
    );
    assert.equal(mapOutfitToIds({ items: [] }, wardrobe), null);
    assert.equal(mapOutfitToIds(null, wardrobe), null);
  });

  it("defaults a missing confidence to 0 rather than NaN", () => {
    const out = mapOutfitToIds({ items: ["Navy Tee", "Khaki Chinos"] }, wardrobe);
    assert.equal(out.confidence, 0);
  });
});

describe("sanitizeStyleProfile", () => {
  it("cleans, caps length, and drops non-strings", () => {
    const out = sanitizeStyleProfile(["  likes navy  ", "", 42, null, "x".repeat(200)]);
    assert.equal(out.length, 2);
    assert.equal(out[0], "likes navy");
    assert.equal(out[1].length, 140);
  });
  it("caps at 50 preferences", () => {
    const out = sanitizeStyleProfile(Array.from({ length: 60 }, (_, i) => "pref " + i));
    assert.equal(out.length, 50);
  });
  it("returns [] for non-arrays", () => {
    assert.deepEqual(sanitizeStyleProfile(null), []);
    assert.deepEqual(sanitizeStyleProfile("nope"), []);
  });
});
