// PC-83 guards: the stylist judges an attached shop item instead of
// deflecting to the Shop check tool. Root cause: the SYSTEM prompt's
// SCOPE rule ("you work with what they own; a Shop check is the right
// tool for buy decisions") outranked the ITEM UNDER CONSIDERATION
// brief, so the model refused a handoff the user made on purpose.
// Fix: the SCOPE rule now carries an explicit exception for an
// attached item.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const {
  assembleContext, sanitizeItems, sanitizeMessages, sanitizePins, sanitizeShopItem,
} = require("../functions/stylist.js");

const ITEMS = sanitizeItems([
  { id: "a", name: "Navy crewneck", category: "Tops" },
  { id: "b", name: "Tan chinos", category: "Bottoms" },
]);
const MSGS = sanitizeMessages([{ role: "user", text: "should I buy this?" }]);
const SHOP = sanitizeShopItem({
  name: "Navy crew-neck t-shirt", category: "Tops",
  colors: ["navy"], score: 4, verdict: "pass", reasons: ["duplicates the crewneck"],
});

function baseInput(extra) {
  return Object.assign({
    items: ITEMS, messages: MSGS, styleProfile: [], previousPick: null,
    references: { articles: [], outfits: [] }, weatherContext: null,
    vibe: null, vibeProfile: null, tripContext: null,
    pins: sanitizePins([]), today: "2026-11-23", todayPick: null,
  }, extra || {});
}

function systemText(input) {
  const out = assembleContext(input);
  assert.ok(out.config && out.config.systemInstruction, "assembled request has no system instruction");
  return out.config.systemInstruction;
}

describe("PC-83: attached shop item", () => {
  it("carries the item brief with its check score", () => {
    const sys = systemText(baseInput({ shopItem: SHOP }));
    assert.ok(sys.includes("ITEM UNDER CONSIDERATION"), "shop brief missing");
    assert.ok(sys.includes("Navy crew-neck t-shirt"), "shop item name missing");
    assert.ok(sys.includes("4/10"), "shop check score missing");
  });

  it("the SCOPE rule excepts an attached item from the deflection", () => {
    const sys = systemText(baseInput({ shopItem: SHOP }));
    assert.ok(sys.includes("Exception (PC-83)"), "SCOPE exception missing");
    assert.ok(sys.includes("judge it"), "judge-it instruction missing");
    assert.ok(sys.includes("buy or pass"), "buy/pass verdict missing");
  });

  it("without an attached item the deflection still stands", () => {
    const sys = systemText(baseInput({}));
    assert.ok(!sys.includes("the user ran a shop check on this piece"), "shop brief leaks without an item");
    assert.ok(sys.includes("a Shop check is the right tool"), "general deflection lost");
    assert.ok(sys.includes("Exception (PC-83)"), "exception line must still be present in SCOPE");
  });
});
