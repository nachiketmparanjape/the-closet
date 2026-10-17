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
const tagMatch = js.match(/var STYLE_TAGS = (\[[^\]]*\]);/);
assert.ok(tagMatch, "STYLE_TAGS not found in index.html");
const STYLE_TAGS = eval(tagMatch[1]);
for (const name of ["itemColors", "itemPrimaryHex", "itemField", "buildColorsFromAI", "buildV2Fields", "syncPrimaryHex", "outfitDedupHash", "defaultOutfitName"]) {
  const m = js.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n      \\}"));
  assert.ok(m, "helper not found in index.html: " + name);
  scope[name] = eval("(" + m[0].replace("function " + name, "function") + ")");
}
const { itemColors, itemPrimaryHex, itemField, buildColorsFromAI, buildV2Fields, syncPrimaryHex, outfitDedupHash, defaultOutfitName } = scope;

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
    // Sprint 5: non-primary colors get the palette-anchor hex (never null),
    // so swatch and label can't contradict each other.
    assert.equal(c[1].hex, "#f4f4f2"); // white anchor
    assert.equal(c[2].hex, "#c0392b"); // red anchor
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
  it("carries subtype and style tags from the AI (constrained to the vocab)", () => {
    const f = buildV2Fields({ subtype: "oxford shirt", style_tags: ["preppy", "classic", "bogus"] }, null);
    assert.equal(f.subtype, "oxford shirt");
    assert.deepEqual(f.styleTags, ["preppy", "classic"]);
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

describe("outfitDedupHash (PC-18)", () => {
  it("is order-insensitive over item ids", () => {
    assert.equal(outfitDedupHash(["a", "b"], "stylist"), outfitDedupHash(["b", "a"], "stylist"));
  });
  it("distinguishes sources and combinations", () => {
    assert.notEqual(outfitDedupHash(["a", "b"], "stylist"), outfitDedupHash(["a", "b"], "manual"));
    assert.notEqual(outfitDedupHash(["a", "b"], "stylist"), outfitDedupHash(["a", "c"], "stylist"));
  });
  it("returns a short string hash", () => {
    assert.ok(/^[0-9a-z]+$/.test(outfitDedupHash(["x"], "manual")));
  });
});

describe("defaultOutfitName (Sprint 7)", () => {
  const fakeItems = {
    a: { name: "Black Nike Air joggers" },
    b: { name: "White Cotton Tee" },
    c: { name: "Grey Hoodie" },
  };
  it("derives a name from the first two pieces", () => {
    global.itemById = (id) => fakeItems[id] || null;
    assert.equal(defaultOutfitName(["a", "b"]), "Black Nike Air joggers + White Cotton Tee");
    delete global.itemById;
  });
  it("counts extra pieces", () => {
    global.itemById = (id) => fakeItems[id] || null;
    assert.equal(defaultOutfitName(["a", "b", "c"]), "Black Nike Air joggers + White Cotton Tee +1");
    delete global.itemById;
  });
  it("falls back to the date when nothing resolves", () => {
    const name = defaultOutfitName(["zzz"]);
    assert.ok(name.startsWith("Outfit · "));
  });
});
