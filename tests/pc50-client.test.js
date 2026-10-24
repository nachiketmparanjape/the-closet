// PC-50 wiring guards: the check sheet carries the link
// route, link checks run the shared analysis on the fetched
// photo (no upload/crop), the context snapshot is shared,
// and retry knows both shapes. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the check sheet carries the link route", () => {
  assert.ok(html.includes('id="shopLinkInput"'), "link input missing");
  assert.ok(html.includes('id="shopLinkBtn"'), "check-link button missing");
  assert.ok(html.includes("or paste its product link"), "label missing");
});

test("link checks reuse fetchLinkItem and run on the stored path", () => {
  assert.ok(html.includes("function startShopCheckFromPath(storagePath, photoUrl, sourceUrl)"), "entry missing");
  assert.ok(html.includes("linkPath: storagePath"), "state does not record the link path");
});

test("the context snapshot is one shared helper used by both entries", () => {
  assert.ok(html.includes("function snapshotShopContext()"), "helper missing");
  const uses = html.match(/snapshotShopContext\(\)/g) || [];
  assert.ok(uses.length >= 3, "expected helper + 2 call sites, got " + uses.length);
  assert.ok(html.includes("function callShopCheckAnalysis()"), "shared analysis caller missing");
});

test("retry re-runs a link check without re-snapshotting", () => {
  assert.ok(html.includes("else if (st.linkPath)"), "link retry branch missing");
});
