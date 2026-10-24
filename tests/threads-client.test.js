// UX-18 W4: thread serialization (client pure function), extracted
// from public/index.html like the other client tests.
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

const serializeMessages = extractClientFn("serializeMessages", "list");

describe("serializeMessages (UX-18 W4 threads)", () => {
  test("drops thinking placeholders — a stale 'Thinking…' never persists", () => {
    const out = serializeMessages([
      { role: "user", text: "hi", at: 1 },
      { role: "model", text: "Thinking…", thinking: true, at: 2 },
    ]);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].text, "hi");
  });
  test("keeps the fields the transcript renders from", () => {
    const outfit = { itemIds: ["a", "b"], lookName: "X" };
    const out = serializeMessages([
      { role: "model", text: "try this", at: 5, outfit, pinProposal: { kind: "location", label: "Tahoe" }, pinState: "pending", tripOutfits: [{ itemIds: ["a", "b"] }], tripSaveCtx: "t1", refLabels: [{ kind: "article", label: "Tee" }] },
      { role: "divider", text: "Continuing from Tuesday", at: 9 },
      { role: "note", text: "Conversations are saved now", at: 10 },
    ]);
    assert.strictEqual(out.length, 3);
    assert.deepStrictEqual(out[0].outfit, outfit);
    assert.strictEqual(out[0].pinState, "pending");
    assert.strictEqual(out[0].tripSaveCtx, "t1");
    assert.strictEqual(out[1].role, "divider");
    assert.strictEqual(out[2].role, "note");
  });
  test("tolerates junk input", () => {
    assert.deepStrictEqual(serializeMessages(null), []);
    assert.deepStrictEqual(serializeMessages([null, { role: "user" }]).length, 1);
  });
});
