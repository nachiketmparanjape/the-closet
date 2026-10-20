// Sprint 16 (TRIPCHAT-1): client-side tool-call validation.
// Extracted from public/index.html like tests/vibe-client.test.js.
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);

function extractClientFn(name) {
  const m = html.match(
    new RegExp("function " + name + "\\(tc, items\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(tc, items\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function("tc", "items", body);
}

const validatePackingToolArgs = extractClientFn("validatePackingToolArgs");
const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("validatePackingToolArgs", () => {
  test("keeps known ids, drops unknown and duplicates", () => {
    const v = validatePackingToolArgs(
      {
        articles: [
          { id: "a", reason: "warm" },
          { id: "zzz", reason: "unknown" },
          { id: "a", reason: "dup" },
          { id: "b", reason: "" },
        ],
        outfits: [],
        whatChanged: "packed warmer",
      },
      items
    );
    assert.deepStrictEqual(v.articleIds, ["a", "b"]);
    assert.strictEqual(v.articleReasons.a, "warm");
    assert.strictEqual(v.whatChanged, "packed warmer");
  });

  test("outfits keep only packed pieces and need 2+", () => {
    const v = validatePackingToolArgs(
      {
        articles: [{ id: "a" }, { id: "b" }],
        outfits: [
          { itemIds: ["a", "zzz"], reasoning: "dropped" },
          { itemIds: ["a", "b"], reasoning: "kept" },
        ],
      },
      items
    );
    assert.strictEqual(v.outfits.length, 1);
    assert.deepStrictEqual(v.outfits[0].itemIds, ["a", "b"]);
  });

  test("refuses empty or malformed calls", () => {
    assert.strictEqual(validatePackingToolArgs(null, items), null);
    assert.strictEqual(validatePackingToolArgs({}, items), null);
    assert.strictEqual(
      validatePackingToolArgs({ articles: [{ id: "nope" }] }, items),
      null
    );
  });
});
