// Sprint 32 (UX-14a): demo wardrobe + partial-wardrobe honesty in the brief.
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { sanitizeItems, buildStylistRequest } = require("../functions/stylist.js");

function brief(items, demoWardrobe) {
  const messages = [{ role: "user", text: "casual dinner, 60°F" }];
  const { config } = buildStylistRequest(
    items, messages, [], null, null, null, null, null, null, [],
    "2026-11-23", null, null, [], null, null, [], [], demoWardrobe
  );
  return config.systemInstruction;
}

function fiveItems() {
  return sanitizeItems([
    { id: "a", name: "Navy Tee", category: "Tops" },
    { id: "b", name: "Tan Shorts", category: "Bottoms" },
    { id: "c", name: "White Shirt", category: "Tops" },
    { id: "d", name: "Dark Jeans", category: "Bottoms" },
    { id: "e", name: "Grey Hoodie", category: "Tops" },
  ]);
}

function twelveItems() {
  const items = fiveItems();
  for (let i = 6; i <= 12; i++) {
    items.push({ id: "x" + i, name: "Piece " + i, category: i % 2 ? "Tops" : "Bottoms" });
  }
  return items;
}

describe("buildStylistRequest demo wardrobe (UX-14a)", () => {
  it("labels the 10 sample pieces as samples, never owned", () => {
    const sys = brief(twelveItems(), true);
    assert.ok(sys.includes("DEMO WARDROBE"));
    assert.ok(sys.includes("SAMPLES"));
    assert.ok(sys.includes("Never claim they own any of them"));
    assert.ok(!sys.includes("PARTIAL WARDROBE"));
  });

  it("says so honestly for a partial real wardrobe (under 10)", () => {
    const sys = brief(fiveItems(), false);
    assert.ok(sys.includes("PARTIAL WARDROBE"));
    assert.ok(sys.includes("only 5 pieces"));
    assert.ok(sys.includes("never pretend pieces exist"));
    assert.ok(!sys.includes("DEMO WARDROBE"));
  });

  it("says neither for a full real wardrobe (10+)", () => {
    const sys = brief(twelveItems(), false);
    assert.ok(!sys.includes("DEMO WARDROBE"));
    assert.ok(!sys.includes("PARTIAL WARDROBE"));
  });

  it("demo wins over partial when both would apply", () => {
    const sys = brief(fiveItems(), true);
    assert.ok(sys.includes("DEMO WARDROBE"));
    assert.ok(!sys.includes("PARTIAL WARDROBE"));
  });
});

// PC-69: a card action chip sends a follow-up with the card's outfit
// as previousPick — the reply must revise THIS outfit, not invent
// fresh. The chip texts are worded for the iteration rules.
describe("buildStylistRequest card-action follow-ups (PC-69)", () => {
  function briefWithPick(text, pickIds) {
    const items = fiveItems();
    const messages = [{ role: "user", text }];
    const { config } = buildStylistRequest(
      items, messages, [], { itemIds: pickIds }, null, null, null, null, null, [],
      "2026-11-23", null, null, [], null, null, [], [], false
    );
    return config.systemInstruction;
  }

  it("a Swap chip revises the card's outfit, slot by slot", () => {
    const sys = briefWithPick("Swap the Tan Shorts for something else", ["a", "b"]);
    assert.ok(sys.includes("ITERATION"));
    assert.ok(sys.includes('[i1] "Navy Tee"'));
    assert.ok(sys.includes('[i2] "Tan Shorts"'));
    assert.ok(sys.includes("replace only that slot"));
  });

  it("Warmer / More formal chips adjust the same pick in that direction", () => {
    const warmer = briefWithPick("Make this outfit warmer", ["a", "b"]);
    assert.ok(warmer.includes("ITERATION"));
    assert.ok(warmer.includes("something warmer/cooler/dressier"));
    const formal = briefWithPick("Make this outfit more formal", ["a", "b"]);
    assert.ok(formal.includes("ITERATION"));
  });
});
