// Committed unit tests for describe.js parsing (Sprint 5: subtype, style tags).
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));

const { parseModelJson, STYLE_TAGS } = require("../functions/describe.js");

describe("parseModelJson — Sprint 5 fields", () => {
  it("parses subtype and style tags", () => {
    const r = parseModelJson(JSON.stringify({
      subtype: "oxford shirt",
      style_tags: ["preppy", "classic"],
    }));
    assert.equal(r.subtype, "oxford shirt");
    assert.deepEqual(r.style_tags, ["preppy", "classic"]);
  });

  it("drops off-vocabulary style tags and caps at 3", () => {
    const r = parseModelJson(JSON.stringify({
      style_tags: ["preppy", "bogus", "classic", "minimalist", "streetwear", "preppy"],
    }));
    assert.deepEqual(r.style_tags, ["preppy", "classic", "minimalist"]);
  });

  it("defaults subtype/style tags when absent", () => {
    const r = parseModelJson(JSON.stringify({}));
    assert.equal(r.subtype, null);
    assert.deepEqual(r.style_tags, []);
  });

  it("exposes the controlled vocabulary", () => {
    assert.ok(Array.isArray(STYLE_TAGS) && STYLE_TAGS.length > 0);
    assert.ok(STYLE_TAGS.indexOf("preppy") !== -1);
  });
});

describe("parseModelJson — NAMING-1 shortName", () => {
  it("prefers the model's short_name, capped by the shared rule", () => {
    const r = parseModelJson(JSON.stringify({
      name: "Off-white running hat with a dark green brim",
      short_name: "Off-white running hat with dark green brim",
    }));
    assert.equal(r.shortName, "Off-white running hat");
  });
  it("derives from the name when short_name is missing or prose", () => {
    const r = parseModelJson(JSON.stringify({
      name: "White bear graphic crew-neck tee, featuring a large chest print and dropped shoulders",
    }));
    assert.equal(r.shortName, "White bear graphic crew-neck tee");
  });
});
