// PC-45: explain-the-no. The two pure helpers decide (a)
// which rejections earn a PROPOSED style rule and (b) how a
// reason is phrased for the one-turn regeneration nudge.
// The discipline under test: situational reasons (weather,
// colors, vague style) steer the next pick but NEVER become
// rules; durable taste (a piece, the user's own words, a
// formality lean) may propose — confirmation is the user's.
// Extracted from public/index.html like the other client tests.
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);

// The helpers live as one block: REJECT_CHIPS + the two
// functions, ending where the sheet state begins.
const start = html.indexOf("var REJECT_CHIPS");
const end = html.indexOf("var rejectReason");
assert.ok(start > 0 && end > start, "PC-45 helper block not found");
const block = html.slice(start, end);
const { ruleForRejection, rejectionWords } = new Function(
  block + "\nreturn { ruleForRejection, rejectionWords };"
)();

describe("ruleForRejection", () => {
  test("a piece earns a Skip rule", () => {
    assert.equal(
      ruleForRejection({ pieceName: "Wide-leg trousers" }),
      "Skip Wide-leg trousers"
    );
  });
  test("the user's own words beat templates (capitalized, trimmed)", () => {
    assert.equal(
      ruleForRejection({ chip: "formal", text: "  no more   turtlenecks " }),
      "No more turtlenecks"
    );
  });
  test("formality chips template a rule", () => {
    assert.equal(ruleForRejection({ chip: "formal" }), "Lean more casual than formal");
    assert.equal(ruleForRejection({ chip: "casual" }), "Lean sharper, less casual");
  });
  test("situational reasons never propose a rule", () => {
    assert.equal(ruleForRejection({ chip: "warm" }), null);
    assert.equal(ruleForRejection({ chip: "cold" }), null);
    assert.equal(ruleForRejection({ chip: "colors" }), null);
    assert.equal(ruleForRejection({ chip: "style" }), null);
    assert.equal(ruleForRejection({ text: "ab" }), null);
    assert.equal(ruleForRejection({}), null);
    assert.equal(ruleForRejection(null), null);
  });
});

describe("rejectionWords", () => {
  test("phrases each reason kind for the regeneration nudge", () => {
    assert.equal(rejectionWords({ pieceName: "Linen blazer" }), "it's the Linen blazer");
    assert.equal(rejectionWords({ chip: "warm" }), "it was too warm");
    assert.equal(rejectionWords({ chip: "formal", text: "meeting day" }), "it was too formal — meeting day");
    assert.equal(rejectionWords({ text: "just off" }), "just off");
    assert.equal(rejectionWords(null), "");
    assert.equal(rejectionWords({}), "");
  });
});
