// PC-54: pickClipboardImageType — the pure piece of the
// Paste button: from a ClipboardItem's offered types, take
// the first image type, else nothing (the handler then
// speaks the honest "no photo on the clipboard" line).
// Extracted from public/index.html like the other client tests.
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);

function extractClientFn(name, params) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + params + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + params + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(...params.split(",").map((s) => s.trim()), body);
}

const pickClipboardImageType = extractClientFn("pickClipboardImageType", "types");

describe("pickClipboardImageType", () => {
  test("finds the image among mixed types", () => {
    assert.equal(
      pickClipboardImageType(["text/plain", "image/png"]),
      "image/png"
    );
  });
  test("takes the first image type offered", () => {
    assert.equal(
      pickClipboardImageType(["image/jpeg", "image/png"]),
      "image/jpeg"
    );
  });
  test("no image → null (the handler speaks the fallback)", () => {
    assert.equal(pickClipboardImageType(["text/plain", "text/html"]), null);
    assert.equal(pickClipboardImageType([]), null);
    assert.equal(pickClipboardImageType(null), null);
    assert.equal(pickClipboardImageType(undefined), null);
  });
});
