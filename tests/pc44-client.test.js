// PC-44 wiring guards: the link route lives on the one
// capture door, the saved cover is labeled only when the
// saved photo IS the imported file, and the label renders on
// the grid + detail. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the capture screen carries the link route", () => {
  assert.ok(html.includes('id="captureLinkInput"'), "link input missing");
  assert.ok(html.includes('id="captureLinkBtn"'), "fetch button missing");
  assert.ok(html.includes("or paste a product link"), "label missing");
});

test("the client calls fetchLinkItem and hands the photo to the add flow", () => {
  assert.ok(html.includes('httpsCallable("fetchLinkItem")'), "callable not wired");
  assert.ok(html.includes("getDownloadURL()"), "photo download missing");
  assert.ok(html.includes("linkImport = { file: file"), "source binding missing");
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

test("the guide lists four ways in, including the link", () => {
  assert.ok(html.includes("Four ways in"), "guide intro stale");
  assert.ok(html.includes("From a link"), "guide path missing");
});
