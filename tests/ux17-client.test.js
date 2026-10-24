// UX-17 wiring guards: the theme must resolve through the
// data-theme attribute (head resolver + Account choice), not
// the bare media query, so a manual Light beats a dark phone.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("dark tokens key off data-theme, not the media query", () => {
  assert.ok(html.includes(':root[data-theme="dark"]'), "data-theme dark block missing");
  assert.ok(!html.includes("@media (prefers-color-scheme: dark) {\n      :root"), "media-query token block should be gone");
});

test("the head resolver stamps data-theme before first paint", () => {
  const head = html.slice(0, html.indexOf("<style>"));
  assert.ok(head.includes('localStorage.getItem("closet.theme")'), "resolver missing from head");
  assert.ok(head.includes("dataset.theme"), "resolver does not stamp data-theme");
});

test("the account appearance control exists with all three choices", () => {
  assert.ok(html.includes('h("Appearance")'), "Appearance section missing");
  assert.ok(html.includes('["system", "System"], ["light", "Light"], ["dark", "Dark"]'), "choices missing");
  assert.ok(html.includes("function setThemePref(p)"), "setter missing");
  assert.ok(html.includes('localStorage.setItem("closet.theme", p)'), "preference not persisted");
});

test("system changes re-resolve only in System mode", () => {
  assert.ok(html.includes('if (themePref() === "system") applyTheme();'), "media-change listener missing");
});
