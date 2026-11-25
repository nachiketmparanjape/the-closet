// #137: trip thumbnails fit the WHOLE garment photo — the old
// 52px cover box cropped tall trousers and wide tops. A missing
// photo leaves a same-size empty slot so rows stay aligned.
// Run from hosting/: node --test "tests/*.test.js"
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractClientFn(name, arg) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + arg + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(arg, body);
}

function fakeEl(tag) {
  const el = {
    tag: tag,
    children: [],
    attrs: {},
    className: "",
    appendChild: function (c) { this.children.push(c); return c; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
  };
  return el;
}

const packingThumb = extractClientFn("packingThumb", "it");

function setup(photosById) {
  global.document = { createElement: function (tag) { return fakeEl(tag); } };
  global.itemPhotos = function (it) { return photosById[it.id] || []; };
  global.showDisplayPhoto = function (img, it) { img.src = (photosById[it.id] || [])[0].url; };
}

describe("packingThumb (#137)", () => {
  test("a piece with a photo renders a pack-thumb img", () => {
    setup({ trousers: [{ url: "trousers.jpg" }] });
    const el = packingThumb({ id: "trousers", name: "Linen trousers" });
    assert.strictEqual(el.tag, "img");
    assert.strictEqual(el.className, "pack-thumb");
    assert.strictEqual(el.src, "trousers.jpg");
    assert.strictEqual(el.alt, "Linen trousers");
  });

  test("a piece with no photo renders a same-size empty slot", () => {
    setup({});
    const el = packingThumb({ id: "bare", name: "Bare tee" });
    assert.strictEqual(el.tag, "div");
    assert.strictEqual(el.className, "pack-thumb pack-thumb-empty");
    assert.strictEqual(el.attrs["aria-hidden"], "true");
  });

  test("the thumb rule fits the whole photo on a neutral background", () => {
    const m = html.match(/\.pack-thumb \{[^}]*\}/);
    assert.ok(m, ".pack-thumb rule missing");
    assert.ok(m[0].includes("object-fit: contain"), "contain fit missing — cover crops the garment");
    assert.ok(!m[0].includes("object-fit: cover"), "cover fit still present");
    assert.ok(m[0].includes("background: var(--paper-soft)"), "neutral background missing");
    assert.ok(m[0].includes("width: 64px") && m[0].includes("height: 64px"), "thumbnail space was not enlarged");
  });

  test("renderTripPacking uses the helper for every packed row", () => {
    const start = html.indexOf("function renderTripPacking(trip)");
    assert.ok(start > -1, "renderTripPacking missing");
    const end = html.indexOf("function renderTripShopSection(trip)", start);
    const body = html.slice(start, end);
    assert.ok(body.includes("row.appendChild(packingThumb(it))"), "packing rows do not use packingThumb");
  });

  test("trip-linked shop rows share the fit and the empty slot", () => {
    const start = html.indexOf("function renderTripShopSection(trip)");
    assert.ok(start > -1, "renderTripShopSection missing");
    const body = html.slice(start, start + 6000);
    assert.ok(body.includes('img.className = "pack-thumb"'), "shop rows do not use pack-thumb");
    assert.ok(body.includes("pack-thumb-empty"), "shop rows have no empty slot for a missing photo");
  });
});
