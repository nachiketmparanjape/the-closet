// Sprint 13: vibe handle + learned vibe profile (server side).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { sanitizeVibe, sanitizeVibeProfile, buildStylistRequest, VIBE_TAGS } = require("../functions/stylist.js");

const ITEMS = [{ id: "a1", name: "Tee", category: "Tops", styleTags: ["streetwear"] }];
const MSGS = [{ role: "user", text: "dress me" }];

describe("sanitizeVibe", () => {
  it("accepts exact vocabulary hits, case-insensitive", () => {
    assert.equal(sanitizeVibe("Streetwear"), "streetwear");
  });
  it("rejects non-vocabulary input", () => {
    assert.equal(sanitizeVibe("dressy"), null);
    assert.equal(sanitizeVibe(""), null);
    assert.equal(sanitizeVibe(null), null);
    assert.equal(sanitizeVibe(42), null);
  });
});

describe("sanitizeVibeProfile", () => {
  it("keeps known tags clamped 0..1 and computes confidence", () => {
    const vp = sanitizeVibeProfile({
      tags: { minimalist: 0.8, streetwear: 1.5, bogus: 0.9 },
      evidence: { minimalist: 30, streetwear: 10 },
    });
    assert.equal(vp.tags.minimalist, 0.8);
    assert.equal(vp.tags.streetwear, 1); // clamped
    assert.ok(!("bogus" in vp.tags));
    assert.equal(vp.confidence, 1); // 40/40
  });
  it("returns null when unusable", () => {
    assert.equal(sanitizeVibeProfile(null), null);
    assert.equal(sanitizeVibeProfile({}), null);
    assert.equal(sanitizeVibeProfile({ tags: { bogus: 0.5 } }), null);
  });
});

describe("buildStylistRequest vibe blocks", () => {
  it("adds the requested-vibe block and skips the profile when vibe is set", () => {
    const vp = { tags: { minimalist: 0.8 }, confidence: 0.9 };
    const { config } = buildStylistRequest(ITEMS, MSGS, [], null, null, null, "streetwear", vp);
    const sys = config.systemInstruction;
    assert.ok(sys.includes("REQUESTED VIBE"));
    assert.ok(sys.includes("streetwear"));
    assert.ok(!sys.includes("WEARER VIBE PROFILE"));
  });
  it("adds the profile block only at confidence >= 0.3", () => {
    const low = { tags: { minimalist: 0.8 }, confidence: 0.2 };
    const { config: c1 } = buildStylistRequest(ITEMS, MSGS, [], null, null, null, null, low);
    assert.ok(!c1.systemInstruction.includes("WEARER VIBE PROFILE"));
    const ok = { tags: { minimalist: 0.8 }, confidence: 0.5 };
    const { config: c2 } = buildStylistRequest(ITEMS, MSGS, [], null, null, null, null, ok);
    assert.ok(c2.systemInstruction.includes("WEARER VIBE PROFILE"));
    assert.ok(c2.systemInstruction.includes("minimalist"));
  });
  it("adds neither block by default", () => {
    const { config } = buildStylistRequest(ITEMS, MSGS, [], null, null, null);
    assert.ok(!config.systemInstruction.includes("REQUESTED VIBE"));
    assert.ok(!config.systemInstruction.includes("WEARER VIBE PROFILE"));
  });
  it("keeps the 12-tag vocabulary in sync with the client list", () => {
    assert.equal(VIBE_TAGS.length, 12);
    assert.ok(VIBE_TAGS.includes("streetwear"));
  });
});
