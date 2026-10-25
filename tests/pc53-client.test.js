// PC-53: gapCopyFor — the one gap sentence shared by Today's
// progress card and the Wardrobe/Outfits tier-1 banners. It
// must name the SPECIFIC gap (missing category, or the count
// left when categories are covered), never a bare count.
// Extracted from public/index.html like the other client tests.
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);

function extractClientFn(name, params) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + params + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + params + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(...params.split(",").map((s) => s.trim()), body);
}

const gapCopyFor = extractClientFn("gapCopyFor", "n, hasTop, hasBottom");

describe("gapCopyFor", () => {
  test("missing both categories names both", () => {
    assert.equal(
      gapCopyFor(1, false, false),
      "1 piece in. Add a top and a bottom and morning picks unlock."
    );
    assert.equal(
      gapCopyFor(2, false, false),
      "2 pieces in. Add a top and a bottom and morning picks unlock."
    );
  });

  test("missing bottom only (the design's example)", () => {
    assert.equal(
      gapCopyFor(3, true, false),
      "3 pieces in. Add a bottom and morning picks unlock."
    );
  });

  test("missing top only", () => {
    assert.equal(
      gapCopyFor(2, false, true),
      "2 pieces in. Add a top and morning picks unlock."
    );
  });

  test("categories covered, count short: names the count left", () => {
    assert.equal(
      gapCopyFor(3, true, true),
      "Tops and bottoms covered — one more piece and picks begin."
    );
    assert.equal(
      gapCopyFor(2, true, true),
      "Tops and bottoms covered — 2 more pieces and picks begin."
    );
  });
});
