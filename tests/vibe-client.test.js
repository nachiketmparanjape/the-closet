// Sprint 13: vibe detection + profile math (client pure functions).
// Extracted from public/index.html like tests/phash.test.js.
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
  // STYLE_TAGS / VIBE_SYNONYMS are module-scope; inline the vocab for the
  // pure functions under test.
  const vocab =
    "var STYLE_TAGS = " +
    JSON.stringify([
      "classic", "minimalist", "preppy", "streetwear", "vintage",
      "bohemian", "edgy", "romantic", "sporty", "rugged",
      "refined", "avant-garde",
    ]) +
    ";";
  return new Function(
    arg.split(",").map((s) => s.trim()),
    vocab + body.replace(/VIBE_SYNONYMS/g, "VIBE_SYNONYMS")
  );
}

// detectVibeTag references VIBE_SYNONYMS — provide it via a wrapper.
function makeDetect() {
  const synMatch = html.match(/var VIBE_SYNONYMS = \{[\s\S]*?\n      \};/);
  assert.ok(synMatch, "VIBE_SYNONYMS not found");
  const src = html.match(/function detectVibeTag\(text\) \{[\s\S]*?\n      \}/)[0];
  const body = src
    .replace(/^function detectVibeTag\(text\) \{/, "")
    .replace(/\n      \}$/, "");
  const vocab =
    "var STYLE_TAGS = " +
    JSON.stringify([
      "classic", "minimalist", "preppy", "streetwear", "vintage",
      "bohemian", "edgy", "romantic", "sporty", "rugged",
      "refined", "avant-garde",
    ]) +
    ";" +
    synMatch[0].replace(/^var /, "var ");
  return new Function(["text"], vocab + body);
}

const detectVibeTag = makeDetect();
const vibeIntentWithoutMatch = (() => {
  const src = html.match(/function vibeIntentWithoutMatch\(text\) \{[\s\S]*?\n      \}/)[0];
  const body = src
    .replace(/^function vibeIntentWithoutMatch\(text\) \{/, "")
    .replace(/\n      \}$/, "")
    .replace(/detectVibeTag\(text\)/g, "DETECT(text)");
  const detectSrc = html.match(/function detectVibeTag\(text\) \{[\s\S]*?\n      \}/)[0];
  const synMatch = html.match(/var VIBE_SYNONYMS = \{[\s\S]*?\n      \};/)[0];
  const vocab =
    "var STYLE_TAGS = " +
    JSON.stringify([
      "classic", "minimalist", "preppy", "streetwear", "vintage",
      "bohemian", "edgy", "romantic", "sporty", "rugged",
      "refined", "avant-garde",
    ]) +
    ";" +
    synMatch.replace(/^var /, "var ") +
    detectSrc.replace("function detectVibeTag", "function DETECT");
  return new Function(["text"], vocab + body);
})();
const vibeProfileUpdate = extractClientFn("vibeProfileUpdate", "profile, deltas");
const vibeConfidence = extractClientFn("vibeConfidence", "profile");
const vibeTopTags = extractClientFn("vibeTopTags", "profile, n");

describe("detectVibeTag", () => {
  test("matches literal tags", () => {
    assert.equal(detectVibeTag("dress me streetwear tonight"), "streetwear");
    assert.equal(detectVibeTag("Something MINIMALIST for dinner"), "minimalist");
  });
  test("matches synonyms to exactly one tag", () => {
    assert.equal(detectVibeTag("grunge look"), "edgy");
    assert.equal(detectVibeTag("dressy outfit"), "refined");
    assert.equal(detectVibeTag("boho chic"), "bohemian");
  });
  test("returns null when nothing matches", () => {
    assert.equal(detectVibeTag("what should I wear today"), null);
    assert.equal(detectVibeTag(""), null);
  });
});

describe("vibeIntentWithoutMatch", () => {
  test("flags vibe intent with no vocabulary hit", () => {
    assert.equal(vibeIntentWithoutMatch("give me a dark vibe"), true);
    assert.equal(vibeIntentWithoutMatch("dress me streetwear"), false);
    assert.equal(vibeIntentWithoutMatch("what's the weather"), false);
  });
});

describe("vibeProfileUpdate", () => {
  test("applies deltas with clamping and counts evidence", () => {
    const p = vibeProfileUpdate(null, { minimalist: 0.06, bogus: 1 });
    assert.equal(p.tags.minimalist, 0.06);
    assert.ok(!("bogus" in p.tags));
    assert.equal(p.evidence.minimalist, 1);
  });
  test("clamps at 1 and decays existing scores", () => {
    const p = vibeProfileUpdate(
      { tags: { edgy: 0.99 }, evidence: { edgy: 5 } },
      { edgy: 0.06 }
    );
    assert.equal(p.tags.edgy, 1);
    const p2 = vibeProfileUpdate({ tags: { edgy: 0.5 }, evidence: {} }, {});
    assert.ok(p2.tags.edgy < 0.5 && p2.tags.edgy > 0.49);
  });
  test("negative deltas floor at 0", () => {
    const p = vibeProfileUpdate({ tags: { preppy: 0.02 }, evidence: {} }, { preppy: -0.06 });
    assert.equal(p.tags.preppy, 0);
  });
});

describe("vibeConfidence", () => {
  test("scales with evidence, caps at 1", () => {
    assert.equal(vibeConfidence(null), 0);
    assert.equal(vibeConfidence({ tags: {}, evidence: { a: 20 } }), 0.5);
    assert.equal(vibeConfidence({ tags: {}, evidence: { a: 400 } }), 1);
  });
});

describe("vibeTopTags", () => {
  test("returns top n sorted desc", () => {
    const top = vibeTopTags({ tags: { a: 0.2, b: 0.9, c: 0.5 }, evidence: {} }, 2);
    assert.deepEqual(top.map((e) => e.tag), ["b", "c"]);
  });
});
