// PC-44 wiring guards. The link route itself was REMOVED +
// PARKED by the founder 2026-10-24 (worked only for
// Open-Graph-friendly stores; revisit trigger = a fetch
// approach that is 90%+ reliable across a representative
// store panel). The retail-label plumbing stays — pieces
// saved from links during its brief life still carry the
// label, and it is the revival path if the card un-parks.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the link route is gone from the capture screen (parked)", () => {
  assert.ok(!html.includes('id="captureLinkInput"'), "link input still present");
  assert.ok(!html.includes('id="captureLinkBtn"'), "fetch button still present");
  assert.ok(!html.includes('httpsCallable("fetchLinkItem")'), "client still calls the parked callable");
});

test("the retail label binds by file identity at save time", () => {
  assert.ok(html.includes("files[0] === linkImport.file"), "identity binding missing");
  assert.ok(html.includes('photos[0].source = "retail"'), "photo label not written");
});

test("grid + detail render the retail label from the cover photo", () => {
  assert.ok(html.includes('coverPhoto.source === "retail"'), "grid chip missing");
  assert.ok(html.includes('id="itemSourceNote"'), "detail note missing");
  assert.ok(html.includes('cover0.source === "retail"'), "detail note not wired");
});

test("the guide lists four ways in — clipboard, not link", () => {
  assert.ok(html.includes("Four ways in"), "guide intro stale");
  assert.ok(html.includes("From your clipboard"), "clipboard path missing");
  assert.ok(!html.includes("From a link"), "link path still in the guide");
});
