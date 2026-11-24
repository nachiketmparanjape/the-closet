// PC-88 guards: a three-outfit ask must return three outfits, not
// "Something went wrong on our end." Root cause, proven from the
// Round 2 error refs (req_6f7c, req_72b4, req_4f06 — all
// askStylist / AI_BAD_RESPONSE / "model returned non-JSON"): the
// prompt allowed only ONE outfit per reply, and the 2500-token cap
// (1024 of it thinking budget) truncated a three-outfit JSON
// mid-object, so the parse failed every time. Fix: the prompt
// allows an "outfits" array (up to 3) when the user asks for more
// than one; the parser validates each entry and drops malformed
// ones instead of failing the reply; the token cap rises to 6000
// on multi-outfit turns only; the client renders the extras as
// cards of their own (same dedupe + collapse treatment).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { assembleContext, parseStylistJson, sanitizeItems, sanitizeMessages, SYSTEM } = require("../functions/stylist.js");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const SCORES = { color: 8, formality: 7, weather: 9, proportion: 6, occasion: 8 };
function oneOutfit(handleA, handleB, name) {
  return { items: [handleA, handleB], reasoning: "Anchored.", lookName: name, tagline: "Feel", styleNote: "Reads well.", scores: SCORES };
}

describe("PC-88: the parser takes an outfits array", () => {
  it("three valid outfits come back, outfit is the first", () => {
    const r = parseStylistJson(JSON.stringify({
      reply: "Here are three.",
      outfit: null,
      outfits: [oneOutfit("[i1]", "[i2]", "First"), oneOutfit("[i3]", "[i4]", "Second"), oneOutfit("[i1]", "[i3]", "Third")],
    }));
    assert.equal(r.outfits.length, 3);
    assert.equal(r.outfit.lookName, "First");
    assert.equal(r.outfits[2].lookName, "Third");
  });

  it("a malformed entry drops instead of failing the reply", () => {
    const bad = oneOutfit("[i1]", "[i2]", "Bad");
    delete bad.scores;
    const r = parseStylistJson(JSON.stringify({
      reply: "Here are three.",
      outfit: null,
      outfits: [oneOutfit("[i1]", "[i2]", "Good"), bad, oneOutfit("[i3]", "[i4]", "Also good")],
    }));
    assert.equal(r.outfits.length, 2);
    assert.equal(r.outfits[1].lookName, "Also good");
  });

  it("a single outfit still parses exactly as before", () => {
    const r = parseStylistJson(JSON.stringify({ reply: "Here.", outfit: oneOutfit("[i1]", "[i2]", "Solo") }));
    assert.equal(r.outfit.lookName, "Solo");
    assert.equal(r.outfits, null);
  });

  it("non-JSON still throws AI_BAD_RESPONSE", () => {
    assert.throws(() => parseStylistJson("not json at all"), (e) => e.key === "AI_BAD_RESPONSE");
  });
});

describe("PC-88: the prompt and the token cap", () => {
  it("the prompt allows an outfits array when asked for more than one", () => {
    assert.ok(SYSTEM.includes('MORE THAN ONE (PC-88)'), "multi rule missing");
    assert.ok(SYSTEM.includes('"outfits"'), "outfits contract missing");
  });

  it("a three-outfit ask raises the cap; a single ask keeps 2500", () => {
    const items = sanitizeItems([
      { id: "a", name: "Navy crewneck", category: "Tops" },
      { id: "b", name: "Tan chinos", category: "Bottoms" },
      { id: "c", name: "White sneakers", category: "Shoes" },
    ]);
    function outFor(text) {
      return assembleContext({
        items: items, messages: sanitizeMessages([{ role: "user", text: text }]),
        styleProfile: [], previousPick: null, references: { articles: [], outfits: [] },
        weatherContext: null, vibe: null, vibeProfile: null, tripContext: null,
        pins: [], today: "2026-10-24", todayPick: null,
      });
    }
    assert.equal(outFor("give me three outfits for the weekend").config.maxOutputTokens, 6000);
    assert.equal(outFor("show me a few options").config.maxOutputTokens, 6000);
    assert.equal(outFor("dress me").config.maxOutputTokens, 2500);
  });
});

describe("PC-88: the client renders the extras", () => {
  function sliceFrom(marker, len) {
    const i = html.indexOf(marker);
    assert.ok(i > -1, "marker missing: " + marker);
    return html.slice(i, i + len);
  }

  it("sendChat attaches the extras; the serializer persists them", () => {
    assert.ok(html.includes("thinking.outfits = multiOutfits.length >= 2 ? multiOutfits : null;"), "attach missing");
    assert.ok(html.includes("if (m.outfits) o.outfits = m.outfits;"), "serializer missing");
  });

  it("renderChat renders the extras with dedupe + collapse", () => {
    const body = sliceFrom("function renderChat()", 16000);
    assert.ok(body.includes("m.outfits.slice(1).forEach"), "extras loop missing");
    assert.ok(body.includes("renderCollapsedOutfitCard(m, extra)"), "extras collapse missing");
    assert.ok(body.includes("renderSameOutfitStrip(m, extraFirst)"), "extras dedupe missing");
  });

  it("the collapse pre-pass counts the extras as cards", () => {
    const body = sliceFrom("function renderChat()", 7000);
    assert.ok(body.includes("if (Array.isArray(m.outfits)) cardOutfits = cardOutfits.concat(m.outfits);"), "pre-pass missing");
  });

  it("the latest pick of a multi-outfit reply is its last outfit", () => {
    const count = (html.match(/var lastOutfit = \(Array\.isArray\(pm\.outfits\)/g) || []).length;
    assert.equal(count, 2, "both previousPick derivations must prefer the last outfit");
  });
});
