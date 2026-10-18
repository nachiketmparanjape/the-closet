// FB-1: feedback payload builder (extracted from public/index.html).
// Mirrors the extraction convention in tests/pc8-helpers.test.js: the
// function is multi-line and closes at a 6-space indent.
const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert");

function extractClientFn(name) {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "public", "index.html"),
    "utf8"
  );
  const m = html.match(
    new RegExp("function " + name + "\\(opts\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  return new Function("opts", m[0].replace(/^function \w+\(opts\) \{/, "").replace(/\n      \}$/, ""));
}

const buildFeedbackDoc = extractClientFn("buildFeedbackDoc");

test("buildFeedbackDoc trims and includes context", () => {
  const doc = buildFeedbackDoc({
    uid: "u1",
    text: "  the button broke  ",
    view: "outfits",
    userAgent: "TestAgent/1.0",
  });
  assert.strictEqual(doc.text, "the button broke");
  assert.strictEqual(doc.uid, "u1");
  assert.strictEqual(doc.view, "outfits");
  assert.strictEqual(doc.userAgent, "TestAgent/1.0");
  assert.ok(!("createdAt" in doc), "createdAt is stamped at write time");
});

test("buildFeedbackDoc caps text at 5000 chars", () => {
  const doc = buildFeedbackDoc({ uid: "u1", text: "x".repeat(6000), view: "wardrobe", userAgent: "" });
  assert.strictEqual(doc.text.length, 5000);
});

test("buildFeedbackDoc rejects empty text", () => {
  assert.throws(() => buildFeedbackDoc({ uid: "u1", text: "   ", view: "wardrobe", userAgent: "" }), /empty feedback/);
});

test("buildFeedbackDoc defaults view to unknown", () => {
  const doc = buildFeedbackDoc({ uid: "u1", text: "hi", userAgent: "" });
  assert.strictEqual(doc.view, "unknown");
});
