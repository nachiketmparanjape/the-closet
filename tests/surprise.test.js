// Sprint 14: surprise-me rewear weighting (client pure function).
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
  return new Function(arg, body);
}

const surpriseWeight = extractClientFn("surpriseWeight", "lastWornMs");

describe("surpriseWeight", () => {
  test("never worn → max weight (365)", () => {
    assert.strictEqual(surpriseWeight(null), 365);
    assert.strictEqual(surpriseWeight(0), 365);
    assert.strictEqual(surpriseWeight(undefined), 365);
  });
  test("weight grows with days since worn", () => {
    const day = 86400000;
    const w1 = surpriseWeight(Date.now() - day);
    const w30 = surpriseWeight(Date.now() - 30 * day);
    assert.ok(w30 > w1, "30 days should outweigh 1 day");
    assert.ok(Math.abs(w1 - 1) < 0.01, "1 day ≈ 1, got " + w1);
    assert.ok(Math.abs(w30 - 30) < 0.5, "30 days ≈ 30, got " + w30);
  });
  test("floor of 1 for just-worn", () => {
    assert.strictEqual(surpriseWeight(Date.now()), 1);
  });
});
