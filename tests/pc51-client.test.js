// PC-51 wiring guards: a document-level paste handler takes
// clipboard images into the flow that owns the screen —
// shop check via the cropper, capture via the ordinary
// ingest, or the chooser when nothing is open — and never
// hijacks a text paste into a text field.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the paste handler extracts image files from the clipboard event", () => {
  assert.ok(html.includes('document.addEventListener("paste"'), "paste listener missing");
  assert.ok(html.includes('it.kind === "file"'), "item filter missing");
  assert.ok(html.includes("it.getAsFile()"), "file snapshot missing");
});

test("routing covers shop sheet, capture, and the chooser", () => {
  assert.ok(html.includes("openShopCropper(images[0])"), "shop route missing");
  assert.ok(html.includes("routeFilesToAdd(images)"), "capture route missing");
  assert.ok(html.includes('id="pasteChoiceSheet"'), "chooser markup missing");
  assert.ok(html.includes('id="pasteChoiceAdd"'), "chooser add option missing");
  assert.ok(html.includes('id="pasteChoiceCheck"'), "chooser check option missing");
});

test("a text paste into a text field is never hijacked", () => {
  assert.ok(html.includes("if (inField && text) return;"), "text-paste guard missing");
});

test("pastes do not stack over an unrelated open flow", () => {
  assert.ok(html.includes('document.querySelector(".overlay:not([hidden])")'), "open-overlay guard missing");
});

test("both surfaces carry the paste guidance copy", () => {
  assert.ok(html.includes("paste it right here"), "capture hint missing");
  assert.ok(html.includes("paste it here (Ctrl+V / Cmd+V)"), "shop hint missing");
});
