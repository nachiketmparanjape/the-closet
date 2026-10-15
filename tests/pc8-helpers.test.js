// Committed unit tests for PC-8 client helpers (data model v2).
// The helpers live inline in public/index.html (single-file app), so the
// tests extract them from the shipped file — this tests the real code,
// not a copy. Run from hosting/: node --test tests/
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const js = html.split("<script>")[1].split("</script>")[0];
// The helpers reference window.Palette (browser global) — shim it with the
// real client module so the tests exercise the actual palette.
global.window = {};
require("../public/js/palette.js");
const scope = {};
for (const name of ["itemColors", "itemPrimaryHex", "itemField", "buildColorsFromAI", "buildV2Fields", "syncPrimaryHex"]) {
  const m = js.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n      \\}"));
  assert.ok(m, "helper not found in index.html: " + name);
  scope[name] = eval("(" + m[0].replace("function " + name, "function") + ")");
}
const { itemColors, itemPrimaryHex, itemField, buildColorsFromAI, buildV2Fields, syncPrimaryHex } = scope;

describe("itemColors (lazy migration)", () => {
  it("passes v2 colors through untouched", () => {
    const v2 = { colors: [{ name: "navy", hex: "#1a2b4a", source: "ai", primary: true }] };
    assert.equal(itemColors(v2), v2.colors);
  });
  it("falls back from the v1 color field", () => {
    assert.deepEqual(itemColors({ color: "#ff0000" }),
      [{ name: "", hex: "#ff0000", source: "user", primary: true }]);
  });
  it("defaults when nothing usable exists", () => {
    assert.equal(itemColors({})[0].hex, "#5c6673");
  });
});

describe("itemPrimaryHex", () => {
  it("prefers the primary entry, then the first valid hex", () => {
    assert.equal(itemPrimaryHex({ colors: [{ name: "navy", hex: "#1a2b4a", source: "ai", primary: true }] }), "#1a2b4a");
    assert.equal(itemPrimaryHex({ colors: [
      { name: "a", hex: null, source: "ai", primary: true },
      { name: "b", hex: "#00ff00", source: "ai", primary: false },
    ] }), "#00ff00");
  });
  it("falls back for v1 docs", () => {
    assert.equal(itemPrimaryHex({ color: "#123456" }), "#123456");
  });
});

describe("itemField", () => {
  it("top-level wins, then the ai blob, then the default", () => {
    assert.equal(itemField({ pattern: "striped", ai: { pattern: "solid" } }, "pattern", "pattern", "other"), "striped");
    assert.equal(itemField({ ai: { pattern: "solid" } }, "pattern", "pattern", "other"), "solid");
    assert.equal(itemField({}, "pattern", "pattern", "other"), "other");
    assert.equal(itemField({ brand: "" }, "brand", "brand", null), null);
  });
});

describe("buildColorsFromAI / buildV2Fields", () => {
  it("caps AI names at 3 and anchors the primary hex", () => {
    const c = buildColorsFromAI({ colors: ["navy", "white", "red", "green"] }, "#111111");
    assert.equal(c.length, 3);
    assert.equal(c[0].hex, "#111111");
    assert.equal(c[0].primary, true);
    assert.equal(c[1].hex, null);
    assert.equal(c[2].source, "ai");
  });
  it("creates a user entry when AI gave nothing", () => {
    assert.equal(buildColorsFromAI(null, "#222222")[0].source, "user");
  });
  it("fills safe defaults", () => {
    const f = buildV2Fields(null, null);
    assert.equal(f.pattern, "other");
    assert.equal(f.fit, "unknown");
    assert.equal(f.brand, null);
    assert.equal(f.brandKey, null);
    assert.equal(f.colors[0].hex, "#5c6673");
  });
  it("carries brandKey and canonical families from the AI", () => {
    const f = buildV2Fields({ brand: "Uniqlo", brandKey: "uniqlo", colors: ["navy", "white"] }, "#111111");
    assert.equal(f.brand, "Uniqlo");
    assert.equal(f.brandKey, "uniqlo");
    assert.equal(f.colors[0].family, "navy");
    assert.equal(f.colors[1].family, "white");
  });
  it("computes brandKey when the AI did not send one", () => {
    const f = buildV2Fields({ brand: "UNIQLO" }, null);
    assert.equal(f.brandKey, "uniqlo");
  });
});

describe("syncPrimaryHex", () => {
  it("updates the primary entry and never crashes on empty", () => {
    const p = [{ name: "a", hex: "#000000", source: "ai", primary: true }];
    syncPrimaryHex(p, "#ffffff");
    assert.equal(p[0].hex, "#ffffff");
    syncPrimaryHex([], "#ffffff");
  });
});
