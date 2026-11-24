// PC-84 guards: "More formal" revises the card's outfit instead of
// returning a fresh one. Root cause: the server's ITERATION section
// named the direction examples "warmer/cooler/dressier/…" — "more
// formal" (the exact words the More formal chip sends) did not map
// onto any of them, so the model read the request as a fresh formal
// pick and even described the base outfit as containing pieces it
// did not have ("rugged flannel"). Fix: the direction list names
// "more formal" explicitly, a direction change must keep MOST of
// the previous pick, and the reply may only describe the base from
// its listed handles.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const {
  assembleContext, sanitizeItems, sanitizeMessages, sanitizePins,
} = require("../functions/stylist.js");

const ITEMS = sanitizeItems([
  { id: "a", name: "Olive field jacket", category: "Outerwear" },
  { id: "b", name: "White tee", category: "Tops" },
  { id: "c", name: "Dark jeans", category: "Bottoms" },
]);
const MSGS = sanitizeMessages([{ role: "user", text: "Make this outfit more formal" }]);

function systemText(input) {
  const out = assembleContext(Object.assign({
    items: ITEMS, messages: MSGS, styleProfile: [],
    references: { articles: [], outfits: [] }, weatherContext: null,
    vibe: null, vibeProfile: null, tripContext: null,
    pins: sanitizePins([]), today: "2026-11-23", todayPick: null,
  }, input));
  assert.ok(out.config && out.config.systemInstruction, "no system instruction");
  return out.config.systemInstruction;
}

describe("PC-84: formal revision", () => {
  const sys = systemText({ previousPick: { itemIds: ["a", "b", "c"] } });

  it("names the previous pick as the iteration base", () => {
    assert.ok(sys.includes("ITERATION"), "iteration section missing");
    assert.ok(sys.includes("Olive field jacket"), "base handles missing");
  });

  it("names 'more formal' as a direction change", () => {
    assert.ok(sys.includes("more formal/dressier"), "formal direction missing from iteration rules");
  });

  it("a direction change keeps most of the base", () => {
    assert.ok(sys.includes("keeps MOST of the previous pick"), "keep-most rule missing");
  });

  it("the reply may only describe the base from its handles", () => {
    assert.ok(sys.includes("never name a piece it does not contain"), "don't-invent rule missing");
  });

  it("without a previous pick there is no iteration section", () => {
    const bare = systemText({ previousPick: null });
    assert.ok(!bare.includes("ITERATION — the user is refining"), "iteration leaks without a base");
  });
});
