// Every overlay/sheet must offer a visible dismiss path (icon-button ✕
// or a Cancel row). Regression guard: the wearSheet shipped without one.
const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("every overlay has a dismiss control", () => {
  const overlays = [...html.matchAll(/<div class="overlay[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(overlays.length > 5, "expected several overlays, found " + overlays.length);
  const missing = [];
  for (const id of overlays) {
    const start = html.indexOf('id="' + id + '"');
    // crude section bound: next overlay div or end of body
    const next = html.indexOf('<div class="overlay', start + 1);
    const section = html.slice(start, next === -1 ? undefined : next);
    const hasDismiss =
      section.includes("icon-button") ||
      /id="[^"]*[Cc]ancel"/.test(section) ||
      section.includes("sheet-cancel");
    if (!hasDismiss) missing.push(id);
  }
  assert.deepStrictEqual(missing, [], "overlays without a dismiss control: " + missing.join(", "));
});
