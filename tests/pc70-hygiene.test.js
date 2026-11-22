// PC-70 guards: outfit-card hygiene in the chat thread.
// (a) A saved card stays saved: saveChatOutfit persists the thread
//     after setting savedId (both the duplicate-link branch and the
//     create branch) — before this, the Saved state lived only in
//     memory and reverted on reload.
// (b) Older outfit cards collapse to a one-line strip; only the
//     latest full card renders open. Expanded state is runtime-only.
// (c) Card tiles are true squares: the card img rule must carry
//     height:auto — the standalone .outfit-thumbs height:56px
//     otherwise defeats aspect-ratio (verified live: tiles rendered
//     as 125x56 strips in Chromium, ragged natural-aspect on iOS).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

describe("PC-70a: saved state persists", () => {
  it("saveChatOutfit saves the thread in both success branches", () => {
    const start = html.indexOf("function saveChatOutfit");
    assert.ok(start > -1, "saveChatOutfit missing");
    const body = html.slice(start, start + 6000);
    const calls = body.split("saveThread(activeThreadKey)").length - 1;
    assert.ok(calls >= 2, "expected saveThread in dup + create branches, found " + calls);
  });
});

describe("PC-70b: older cards collapse", () => {
  it("renderChat precomputes the latest full-card index", () => {
    assert.ok(html.includes("var lastCardIdx = -1;"), "lastCardIdx precompute missing");
    assert.ok(html.includes("seenSetsPre"), "set pre-registration missing");
  });

  it("older cards render through the collapsed strip, expandable at runtime", () => {
    assert.ok(html.includes("function renderCollapsedOutfitCard(m)"), "collapsed renderer missing");
    assert.ok(html.includes("renderCollapsedOutfitCard(m)"), "renderChat does not use the collapsed renderer");
    assert.ok(html.includes("m.cardExpanded = true"), "expand toggle missing");
    assert.ok(html.includes("m.cardExpanded = false"), "show-less toggle missing");
  });

  it("expanded state never reaches the thread doc", () => {
    assert.ok(!html.includes("o.cardExpanded"), "cardExpanded leaked into serializeMessages");
  });

  it("the collapsed strip carries mini thumbs and the saved marker", () => {
    assert.ok(html.includes("collapsed-thumbs"), "mini thumbs missing");
    assert.ok(html.includes('" · Saved"'), "saved marker missing");
    assert.ok(html.includes(".collapsed-thumbs img { width: 28px; height: 28px;"), "mini thumb CSS missing");
  });
});

describe("PC-70c: uniform tiles", () => {
  it("the card img rule defeats the inherited 56px height", () => {
    const m = html.match(/\.outfit-card \.outfit-thumb img \{[^}]*\}/);
    assert.ok(m, "card img rule missing");
    assert.ok(m[0].includes("height: auto"), "height:auto missing — aspect-ratio will be defeated");
    assert.ok(m[0].includes("aspect-ratio: 1"), "square aspect missing");
    assert.ok(m[0].includes("object-fit: cover"), "cover fit missing");
  });

  it("card thumbs top-align so uneven captions do not shift tiles", () => {
    const all = html.match(/\.outfit-card \.outfit-thumbs \{[^}]*\}/g) || [];
    assert.ok(all.length >= 1, "card thumbs rule missing");
    assert.ok(all.some((r) => r.includes("align-items: flex-start")), "top alignment missing");
  });
});
