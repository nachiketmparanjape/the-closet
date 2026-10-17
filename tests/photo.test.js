// Unit tests for PC-13 photo parsing (Sprint 8). Prompt shape, response
// validation (hallucinated ids dropped), and handler auth/edge paths.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildPhotoParseRequest, parsePhotoParseJson, parseOutfitPhoto } = require("../functions/photo.js");

const items = [
  { id: "a", name: "Black tee", category: "Tops", colors: [{ name: "black" }] },
  { id: "b", name: "Navy jeans", category: "Bottoms", colors: "legacy-string" },
];

describe("buildPhotoParseRequest", () => {
  it("embeds the wardrobe with ids and the photo", () => {
    const { contents, config } = buildPhotoParseRequest("Zm9v", "image/jpeg", items);
    const text = contents[0].parts[0].text;
    assert.ok(text.includes('id="a"'));
    assert.ok(text.includes("Black tee"));
    assert.ok(text.includes("JSON only"));
    assert.equal(contents[0].parts[1].inlineData.data, "Zm9v");
    assert.equal(config.responseMimeType, "application/json");
  });
});

describe("parsePhotoParseJson", () => {
  it("keeps valid matches, drops hallucinated and duplicate ids", () => {
    const r = parsePhotoParseJson(JSON.stringify({
      matches: [
        { itemId: "a", confidence: 0.9 },
        { itemId: "zzz", confidence: 0.8 },
        { itemId: "a", confidence: 0.7 },
        { itemId: "b", confidence: "high" },
      ],
      unknown: ["red scarf"],
      notes: "Tee vs tank ambiguity.",
    }), ["a", "b"]);
    assert.deepEqual(r.matches, [
      { itemId: "a", confidence: 0.9 },
      { itemId: "b", confidence: 0 },
    ]);
    assert.deepEqual(r.unknown, ["red scarf"]);
    assert.equal(r.notes, "Tee vs tank ambiguity.");
  });
  it("returns empty matches when nothing valid", () => {
    const r = parsePhotoParseJson(JSON.stringify({ matches: [], unknown: [] }), ["a"]);
    assert.deepEqual(r.matches, []);
  });
  it("rejects non-JSON", () => {
    assert.throws(() => parsePhotoParseJson("nope", ["a"]), /non-JSON/);
  });
  it("clamps confidence to 0-1", () => {
    const r = parsePhotoParseJson(JSON.stringify({ matches: [{ itemId: "a", confidence: 5 }] }), ["a"]);
    assert.equal(r.matches[0].confidence, 1);
  });
});

describe("parseOutfitPhoto handler", () => {
  it("rejects a storage path outside the user's folder", async () => {
    await assert.rejects(
      () => parseOutfitPhoto("u1", "users/other/x.jpg", {}),
      /bad storage path/
    );
  });
});
