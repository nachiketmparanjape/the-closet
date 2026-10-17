// Committed unit tests for PC-12 (structured stylist output + style profile).
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { sanitizeItems, sanitizePreviousPick, sanitizeReferences, sanitizeStyleProfile, mapHandlesToIds, validateSlots, parseScores, confidenceFromScores, describeColors, itemLine, buildStylistRequest } = require("../functions/stylist.js");

describe("sanitizeItems (PC-12)", () => {
  it("keeps a cleaned id for server-side handle→id mapping", () => {
    const items = sanitizeItems([{ id: "abc123", name: "Navy Tee", category: "Tops" }]);
    assert.equal(items[0].id, "abc123");
  });
  it("drops missing ids without breaking", () => {
    const items = sanitizeItems([{ name: "Navy Tee" }]);
    assert.equal(items[0].id, "");
  });
  it("keeps rich color objects for the rubric", () => {
    const items = sanitizeItems([{
      id: "x", name: "Tee", colors: [{ name: "navy", family: "navy", primary: true }, "white"]
    }]);
    assert.deepEqual(items[0].colors, [{ name: "navy", family: "navy", primary: true }, "white"]);
  });
});

describe("mapHandlesToIds (Sprint 5: handles replace names)", () => {
  const wardrobe = [
    { id: "1", name: "Black tee", category: "Tops" },
    { id: "2", name: "Black tee", category: "Tops" },
    { id: "3", name: "Jeans", category: "Bottoms" },
  ];

  it("maps handles to ids and drops invalid handles", () => {
    const out = mapHandlesToIds({ items: ["i1", "i3", "i9", "xx"] }, wardrobe);
    assert.deepEqual(out.map((m) => m.id), ["1", "3"]);
  });

  it("accepts bracketed handles as the prompt shows them ([i1])", () => {
    const out = mapHandlesToIds({ items: ["[i1]", "[i3]"] }, wardrobe);
    assert.deepEqual(out.map((m) => m.id), ["1", "3"]);
  });

  it("distinguishes duplicate names via handles", () => {
    const out = mapHandlesToIds({ items: ["i2", "i3"] }, wardrobe);
    assert.deepEqual(out.map((m) => m.id), ["2", "3"]);
  });

  it("dedupes repeated handles", () => {
    const out = mapHandlesToIds({ items: ["i1", "i1", "i3"] }, wardrobe);
    assert.deepEqual(out.map((m) => m.id), ["1", "3"]);
  });

  it("returns null when fewer than two handles validate", () => {
    assert.equal(mapHandlesToIds({ items: ["i1", "i9"] }, wardrobe), null);
    assert.equal(mapHandlesToIds({ items: [] }, wardrobe), null);
    assert.equal(mapHandlesToIds(null, wardrobe), null);
  });
});

describe("validateSlots", () => {
  const wardrobe = [
    { id: "1", name: "Tee", category: "Tops" },
    { id: "2", name: "Jeans", category: "Bottoms" },
    { id: "3", name: "Sneakers", category: "Shoes" },
  ];

  it("accepts a complete outfit (shoes optional)", () => {
    assert.equal(validateSlots([{ id: "1" }, { id: "2" }], wardrobe), null);
    assert.equal(validateSlots([{ id: "1" }, { id: "2" }, { id: "3" }], wardrobe), null);
  });

  it("rejects missing top or bottom", () => {
    assert.ok(validateSlots([{ id: "1" }, { id: "3" }], wardrobe).includes("bottom"));
    assert.ok(validateSlots([{ id: "2" }, { id: "3" }], wardrobe).includes("top"));
  });

  it("rejects two items in the same slot (accessories exempt)", () => {
    const twoTops = [
      { id: "1", name: "Tee", category: "Tops" },
      { id: "4", name: "Shirt", category: "Tops" },
      { id: "2", name: "Jeans", category: "Bottoms" },
    ];
    assert.ok(validateSlots([{ id: "1" }, { id: "4" }, { id: "2" }], twoTops).includes("two tops"));
  });
});

describe("parseScores + confidenceFromScores", () => {
  const full = { color: 8, formality: 7, weather: 9, proportion: 6, occasion: 8 };
  it("parses and clamps all five sub-scores", () => {
    assert.deepEqual(parseScores(full), full);
    assert.equal(parseScores({ ...full, color: 11 }).color, 10);
    assert.equal(parseScores({ ...full, weather: -2 }).weather, 0);
  });
  it("rejects partial scorecards", () => {
    assert.equal(parseScores({ color: 8 }), null);
    assert.equal(parseScores(null), null);
  });
  it("computes confidence as the sub-score mean", () => {
    assert.equal(confidenceFromScores(full), 8); // 38/5 = 7.6 → 8
  });
});

describe("describeColors + itemLine handles", () => {
  it("marks primary colors from rich objects", () => {
    assert.equal(
      describeColors([{ name: "navy", family: "navy", primary: true }, { name: "cream", family: "cream" }]),
      "navy (primary), cream"
    );
  });
  it("still handles legacy string colors", () => {
    assert.equal(describeColors(["navy", "white"]), "navy, white");
    assert.equal(describeColors([]), "unknown");
  });
  it("prefixes a stable handle", () => {
    const line = itemLine({ id: "x", name: "Tee", category: "Tops", colors: ["white"] }, 0);
    assert.ok(line.startsWith('[i1] "Tee"'));
  });
});

describe("sanitizeStyleProfile", () => {
  it("cleans, caps length, and drops non-strings", () => {
    const out = sanitizeStyleProfile(["  likes navy  ", "", 42, null, "x".repeat(200)]);
    assert.equal(out.length, 2);
    assert.equal(out[0], "likes navy");
    assert.equal(out[1].length, 140);
  });
  it("caps at 50 preferences", () => {
    const out = sanitizeStyleProfile(Array.from({ length: 60 }, (_, i) => "pref " + i));
    assert.equal(out.length, 50);
  });
  it("returns [] for non-arrays", () => {
    assert.deepEqual(sanitizeStyleProfile(null), []);
    assert.deepEqual(sanitizeStyleProfile("nope"), []);
  });
});

describe("sanitizePreviousPick (PC-16)", () => {
  it("keeps string ids, caps at 6", () => {
    const p = sanitizePreviousPick({ itemIds: ["a", "b", 42, null, "c"] });
    assert.deepEqual(p, { itemIds: ["a", "b", "c"] });
  });
  it("returns null for missing/empty/non-object input", () => {
    assert.equal(sanitizePreviousPick(null), null);
    assert.equal(sanitizePreviousPick({}), null);
    assert.equal(sanitizePreviousPick({ itemIds: [] }), null);
    assert.equal(sanitizePreviousPick("nope"), null);
  });
});

describe("buildStylistRequest iteration block (PC-16)", () => {
  const items = sanitizeItems([
    { id: "aaa", name: "Navy Tee", category: "Tops" },
    { id: "bbb", name: "Tan Shorts", category: "Bottoms" },
  ]);
  const messages = [{ role: "user", text: "casual lunch" }];
  it("adds the iteration block with resolved handles when a previous pick exists", () => {
    const { config } = buildStylistRequest(items, messages, [], { itemIds: ["aaa", "bbb"] });
    const sys = config.systemInstruction;
    assert.ok(sys.includes("ITERATION"));
    assert.ok(sys.includes('[i1] "Navy Tee"'));
    assert.ok(sys.includes('[i2] "Tan Shorts"'));
  });
  it("omits the block without a previous pick (benchmark-compatible)", () => {
    const { config } = buildStylistRequest(items, messages, []);
    assert.ok(!config.systemInstruction.includes("ITERATION"));
  });
  it("skips ids that are not in the wardrobe", () => {
    const { config } = buildStylistRequest(items, messages, [], { itemIds: ["zzz"] });
    assert.ok(!config.systemInstruction.includes("ITERATION"));
  });
});

describe("sanitizeReferences (PC-22)", () => {
  const items = sanitizeItems([
    { id: "aaa", name: "Navy Tee", category: "Tops" },
    { id: "bbb", name: "Tan Shorts", category: "Bottoms" },
    { id: "ccc", name: "White Sneakers", category: "Shoes" },
  ]);
  it("keeps valid article ids and drops unknown ones", () => {
    const r = sanitizeReferences({ articleIds: ["aaa", "zzz", 42], outfits: [] }, items);
    assert.deepEqual(r.articles, ["aaa"]);
    assert.deepEqual(r.outfits, []);
  });
  it("keeps outfits with >=2 valid items, resolving against the wardrobe", () => {
    const r = sanitizeReferences({
      articleIds: [],
      outfits: [{ id: "o1", name: "Weekend", itemIds: ["aaa", "bbb", "zzz"] }],
    }, items);
    assert.equal(r.outfits.length, 1);
    assert.deepEqual(r.outfits[0].itemIds, ["aaa", "bbb"]);
  });
  it("drops outfits with fewer than 2 valid items", () => {
    const r = sanitizeReferences({ articleIds: [], outfits: [{ id: "o1", name: "X", itemIds: ["aaa"] }] }, items);
    assert.deepEqual(r.outfits, []);
  });
  it("treats malformed input as empty, never throws", () => {
    assert.deepEqual(sanitizeReferences(null, items), { articles: [], outfits: [] });
    assert.deepEqual(sanitizeReferences("nope", items).articles, []);
  });
  it("caps counts", () => {
    const many = Array.from({ length: 10 }, (_, i) => "aaa");
    const r = sanitizeReferences({ articleIds: many, outfits: [] }, items);
    assert.ok(r.articles.length <= 5);
  });
});

describe("buildStylistRequest references block (PC-22)", () => {
  const items = sanitizeItems([
    { id: "aaa", name: "Navy Tee", category: "Tops" },
    { id: "bbb", name: "Tan Shorts", category: "Bottoms" },
  ]);
  const messages = [{ role: "user", text: "build around this" }];
  it("adds the references block with resolved handles", () => {
    const refs = sanitizeReferences({ articleIds: ["aaa"], outfits: [] }, items);
    const { config } = buildStylistRequest(items, messages, [], null, refs);
    const sys = config.systemInstruction;
    assert.ok(sys.includes("EXPLICIT REFERENCES"));
    assert.ok(sys.includes('[i1] "Navy Tee"'));
  });
  it("omits the block without references (benchmark-compatible)", () => {
    const { config } = buildStylistRequest(items, messages, [], null, null);
    assert.ok(!config.systemInstruction.includes("EXPLICIT REFERENCES"));
  });
});
