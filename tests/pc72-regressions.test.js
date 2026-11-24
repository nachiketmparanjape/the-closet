// PC-72 regression guards (found by QA Round 1, Sprint 32
// acceptance failures). Two separate regressions, two causes.
//
// PC-72a — the context bar still cut words mid-screen ("Trips ar…",
// "Mountain Vie…"). Root cause: openChat called renderContextLine
// BEFORE openOverlay, so trimContextText measured a hidden element
// (clientWidth 0, scrollWidth 0) and bailed, leaving the CSS
// ellipsis to cut mid-word. Fix: the line renders after the overlay
// opens, and the trim retries once on the next frame when it has no
// layout yet.
//
// PC-72b — stock phrases repeated in every reply ("incredibly …",
// "timeless, quiet luxury"). Root cause: the SYSTEM prompt banned
// two example phrases ("effortless", "cool-toned") and the model
// kept its own favorites. Fix: the observed offenders join the
// banned list, and the rule names intensifiers too.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const stylist = fs.readFileSync(path.join(__dirname, "..", "functions", "stylist.js"), "utf8");

function sliceFrom(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i > -1, "marker missing: " + marker);
  return src.slice(i, i + len);
}

describe("PC-72a: context bar trims at a word boundary", () => {
  it("openChat renders the line after the overlay opens", () => {
    const body = sliceFrom(html, "function openChat()", 1800);
    const openIdx = body.indexOf("openOverlay(chatOverlay);");
    const lineIdx = body.indexOf('renderContextLine();', body.indexOf("renderPinChip();"));
    assert.ok(openIdx > -1 && lineIdx > -1, "openChat order unreadable");
    assert.ok(lineIdx > openIdx, "context line still renders before the overlay opens");
  });

  it("the trim retries once when it has no layout", () => {
    const body = sliceFrom(html, "function trimContextText", 1200);
    assert.ok(body.includes("el.clientWidth === 0"), "no-layout check missing");
    assert.ok(body.includes("requestAnimationFrame"), "frame retry missing");
    assert.ok(body.includes("tried"), "retry is not once-only");
  });

  it("the trim still shrinks word by word with the suffix kept", () => {
    const body = sliceFrom(html, "function trimContextText", 1200);
    assert.ok(body.includes("truncateAtWord(base)"), "word-boundary shrink missing");
    assert.ok(body.includes('el.textContent = base + (suffix || "");'), "suffix dropped");
  });
});

describe("PC-72b: no repeated stock phrases", () => {
  it("the prompt bans the observed offenders", () => {
    assert.ok(stylist.includes('"incredibly"'), '"incredibly" not banned');
    assert.ok(stylist.includes('"timeless, quiet luxury"'), '"timeless, quiet luxury" not banned');
    assert.ok(stylist.includes("Never reuse a stock phrase or intensifier"), "rule wording lost");
  });
});
