// PC-36: outfit-photo review — pure client helpers,
// extracted from public/index.html (multi-line,
// 6-space closing indent).
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

function extractClientSrc(name, arg) {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "public", "index.html"),
    "utf8"
  );
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  return m[0];
}

function extractClientFn(name, arg) {
  const src = extractClientSrc(name, arg);
  const body = src.replace(/^function \w+\(\w+(, \w+)*\) \{/, "").replace(/\n      \}$/, "");
  return new Function(arg.split(",").map((s) => s.trim()), body);
}

const outfitParseDraftName = extractClientFn("outfitParseDraftName", "type, colors");
const outfitParseCategoryForType = extractClientFn("outfitParseCategoryForType", "type");
const outfitParseCardStatus = extractClientFn("outfitParseCardStatus", "g, decision");
const outfitParseCanSave = extractClientFn("outfitParseCanSave", "garments, decisions");

describe("outfitParseDraftName", () => {
  test("colors + type, sentence case", () => {
    assert.strictEqual(outfitParseDraftName("zip jacket", ["black"]), "Black zip jacket");
  });
  test("no colors", () => {
    assert.strictEqual(outfitParseDraftName("tee", []), "Tee");
  });
  test("no type", () => {
    assert.strictEqual(outfitParseDraftName("", ["red"]), "Red piece");
  });
});

describe("outfitParseCategoryForType", () => {
  test("maps the wardrobe enum", () => {
    assert.strictEqual(outfitParseCategoryForType("tee"), "Tops");
    assert.strictEqual(outfitParseCategoryForType("trousers"), "Bottoms");
    assert.strictEqual(outfitParseCategoryForType("zip jacket"), "Outerwear");
    assert.strictEqual(outfitParseCategoryForType("sneakers"), "Shoes");
    assert.strictEqual(outfitParseCategoryForType("bag"), "Accessories");
  });
  test("dress and unknown fall to Other (the enum has no dresses)", () => {
    assert.strictEqual(outfitParseCategoryForType("dress"), "Other");
    assert.strictEqual(outfitParseCategoryForType("poncho"), "Other");
  });
});

describe("outfitParseCardStatus", () => {
  const ready = (over) => ({
    status: "ready",
    matchCandidates: [],
    score: 0.9,
    ...over,
  });
  test("pipeline states", () => {
    assert.strictEqual(outfitParseCardStatus({ status: "cutting" }, {}).text, "Still cutting…");
    assert.strictEqual(outfitParseCardStatus({ status: "failed" }, {}).text, "Couldn't cut");
    assert.strictEqual(outfitParseCardStatus({ status: "not-found" }, {}).text, "Not found in this photo");
  });
  test("dismissed decision wins over status", () => {
    assert.strictEqual(
      outfitParseCardStatus(ready(), { decision: "dismissed" }).text,
      "Dismissed"
    );
  });
  test("propose beats possible, both beat New", () => {
    const propose = ready({ matchCandidates: [{ itemId: "i1", itemName: "Tee", band: "propose" }] });
    assert.strictEqual(outfitParseCardStatus(propose, {}).text, "Looks like your Tee");
    const possible = ready({ matchCandidates: [{ itemId: "i1", itemName: "Tee", band: "possible" }] });
    assert.strictEqual(outfitParseCardStatus(possible, {}).text, "Might be your Tee?");
    assert.strictEqual(outfitParseCardStatus(ready(), {}).text, "New");
  });
  test("low SAM score tags Needs a look without changing the text", () => {
    const s = outfitParseCardStatus(ready({ score: 0.65 }), {});
    assert.strictEqual(s.text, "New");
    assert.strictEqual(s.tag, "Needs a look");
    assert.strictEqual(outfitParseCardStatus(ready({ score: 0.9 }), {}).tag, null);
  });
});

describe("outfitParseCanSave", () => {
  const g = (id, status) => ({ id, status });
  test("needs a kept piece and every garment decided", () => {
    const garments = [g("g0", "ready"), g("g1", "ready")];
    assert.strictEqual(
      outfitParseCanSave(garments, { g0: { decision: "confirmed-new" }, g1: { decision: "dismissed" } }),
      true
    );
    // One undecided blocks, even with a kept piece.
    assert.strictEqual(
      outfitParseCanSave(garments, { g0: { decision: "confirmed-new" } }),
      false
    );
    // A cutting garment can only block or be dismissed.
    assert.strictEqual(
      outfitParseCanSave([g("g0", "cutting")], { g0: { decision: "dismissed" } }),
      false
    );
    // Nothing kept blocks.
    assert.strictEqual(
      outfitParseCanSave(garments, { g0: { decision: "dismissed" }, g1: { decision: "dismissed" } }),
      false
    );
    // Editing details is not a decision.
    assert.strictEqual(
      outfitParseCanSave([g("g0", "ready")], { g0: { userName: "Tee", editing: false } }),
      false
    );
  });
});
