// Sprint 32 (UX-14a): demo wardrobe shape + demo flag persistence (client
// pure functions), extracted from public/index.html like the other
// client tests.
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

const demoWardrobeItems = extractClientFn("demoWardrobeItems", "");
const serializeMessages = extractClientFn("serializeMessages", "list");

describe("demoWardrobeItems (UX-14a)", () => {
  test("is 10 sample pieces with unique demo ids", () => {
    const items = demoWardrobeItems();
    assert.strictEqual(items.length, 10);
    const ids = items.map((it) => it.id);
    assert.strictEqual(new Set(ids).size, 10);
    ids.forEach((id) => assert.ok(/^demo-\d+$/.test(id), id));
  });

  test("covers tops and bottoms, so a real outfit can be built", () => {
    const items = demoWardrobeItems();
    const cats = new Set(items.map((it) => it.category));
    assert.ok(cats.has("Tops"));
    assert.ok(cats.has("Bottoms"));
    assert.ok(cats.has("Outerwear"));
    assert.ok(cats.has("Shoes"));
  });

  test("every piece has a name, a primary color, and a verified Unsplash photo", () => {
    const items = demoWardrobeItems();
    const urls = new Set();
    items.forEach((it) => {
      assert.ok(it.name && it.shortName, it.id);
      assert.ok(Array.isArray(it.colors) && it.colors.length, it.id);
      assert.ok(it.colors.some((c) => c.primary && c.name), it.id);
      assert.ok(Array.isArray(it.photos) && it.photos.length, it.id);
      const url = it.photos[0].url;
      assert.ok(/^https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9-]+[?]/.test(url), it.id + ": " + url);
      assert.ok(!urls.has(url), "duplicate photo: " + url);
      urls.add(url);
    });
  });
});

describe("serializeMessages keeps the demo flag (UX-14a)", () => {
  test("a demo reply round-trips demo: true; thinking placeholders still drop", () => {
    const out = serializeMessages([
      { role: "user", text: "casual dinner", at: 1 },
      { role: "model", text: "Try this", at: 2, demo: true, outfit: { itemIds: ["demo-2", "demo-3"] } },
      { role: "model", text: "Thinking…", thinking: true, at: 3 },
    ]);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[1].demo, true);
    assert.deepEqual(out[1].outfit, { itemIds: ["demo-2", "demo-3"] });
  });

  test("a real reply carries no demo flag", () => {
    const out = serializeMessages([{ role: "model", text: "Try this", at: 2 }]);
    assert.strictEqual(out[0].demo, undefined);
  });
});
