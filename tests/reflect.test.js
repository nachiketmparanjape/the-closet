// Committed unit tests for reflect.js parsing (Sprint 5: evidence + kinds).
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));

const { parseReflectionJson } = require("../functions/reflect.js");

describe("parseReflectionJson (Sprint 5)", () => {
  it("parses reflection + explicit preference with evidence", () => {
    const r = parseReflectionJson(JSON.stringify({
      reflection: "You rated it high.",
      suggestedPreference: "prefers relaxed fits for dinners",
      evidence: "8/10 and 9/10 on relaxed-fit dinners (Oct 12, Oct 14)",
      preferenceKind: "pattern",
    }));
    assert.equal(r.reflection, "You rated it high.");
    assert.equal(r.suggestedPreference, "prefers relaxed fits for dinners");
    assert.equal(r.preferenceKind, "pattern");
    assert.ok(r.evidence.includes("8/10"));
  });

  it("drops a preference with no kind (malformed suggestion)", () => {
    const r = parseReflectionJson(JSON.stringify({
      reflection: "Fine.",
      suggestedPreference: "likes blue",
      evidence: null,
      preferenceKind: null,
    }));
    assert.equal(r.suggestedPreference, null);
    assert.equal(r.evidence, null);
    assert.equal(r.preferenceKind, null);
  });

  it("drops a preference with an unknown kind", () => {
    const r = parseReflectionJson(JSON.stringify({
      reflection: "Fine.",
      suggestedPreference: "likes blue",
      preferenceKind: "vibes",
    }));
    assert.equal(r.suggestedPreference, null);
  });

  it("keeps a null suggestion clean", () => {
    const r = parseReflectionJson(JSON.stringify({
      reflection: "One-off bad day.",
      suggestedPreference: null,
      evidence: null,
      preferenceKind: null,
    }));
    assert.equal(r.suggestedPreference, null);
    assert.equal(r.reflection, "One-off bad day.");
  });

  it("rejects non-JSON and empty reflections", () => {
    assert.throws(() => parseReflectionJson("nope"), /non-JSON/);
    assert.throws(() => parseReflectionJson(JSON.stringify({ reflection: "" })), /no reflection/);
  });
});
