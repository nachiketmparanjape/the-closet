// PC-103: after a failed standardization the item page's main photo
// went blank while the tile still showed the cutout. The round's
// "rejected render" attribution was disproven (no client code reads
// it). Three real defects, all fixed here:
//   (1) the open dialog holds a stale activeItem (set once in
//       openItem, never refreshed from the live snapshot);
//   (2) itemPhoto has no onerror recovery — one failed load stays
//       blank forever;
//   (3) the Generate catch wrote {status:"failed"} with no lastError,
//       so the dialog showed the default note even when the server
//       knew the reason — and "processing_interrupted" (the server's
//       value for a run killed by the function timeout) matched no
//       note branch at all.
// Run from hosting/: node --test "tests/*.test.js"
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractClientFn(name, args) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + args + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + args + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(args.split(",").map((a) => a.trim()).filter(Boolean), body);
}

const standardizationFailureNote = extractClientFn("standardizationFailureNote", "lastError");

describe("standardizationFailureNote: processing_interrupted is a timeout", function () {
  test("the killed-run value maps to the timeout sentence", function () {
    assert.equal(
      standardizationFailureNote("processing_interrupted"),
      "The AI version took too long and timed out. Try again."
    );
  });

  test("the plain timeout still maps the same way", function () {
    assert.equal(
      standardizationFailureNote("standardization_timeout: color(ΔE=28.0)"),
      "The AI version took too long and timed out. Try again."
    );
  });
});

describe("source pins", function () {
  test("the snapshot listener refreshes the open dialog's photo + standardization UI", function () {
    assert.ok(
      html.includes("activeItem = fresh;"),
      "watchItems must adopt the fresh doc as activeItem"
    );
    assert.ok(
      html.includes('showDisplayPhoto(itemPhoto, activeItem, (itemPhoto && itemPhoto.dataset.view) || "dots");'),
      "the refresh must re-render the photo in the user's current view"
    );
    assert.ok(
      /PC-103: refresh the open item dialog from the fresh/.test(html),
      "the refresh must carry its PC-103 comment"
    );
  });

  test("the dialog photo retries once, then falls back to the original (Sprint 39: the rule lives in showDisplayPhoto now)", function () {
    assert.ok(
      html.includes("function handleDisplayPhotoError(imgEl, item)"),
      "one photo-error rule for every display photo"
    );
    assert.ok(
      html.includes('imgEl.src = src + sep + "cb=" + Date.now();'),
      "first failure retries the same URL, cache-busted"
    );
    assert.ok(
      html.includes('imgEl.dataset.loadFailedFor = orig;'),
      "the fallback consumes the original's own retry, so a dead original goes to the placeholder instead of looping"
    );
    assert.ok(
      html.includes('if (orig && orig !== src) {'),
      "second failure falls back to the original photo"
    );
    assert.ok(
      html.includes("function handleDisplayPhotoLoad(imgEl)"),
      "a successful load must reset the retry state"
    );
    assert.ok(
      html.includes('imgEl.onerror = function () { handleDisplayPhotoError(imgEl, item); };'),
      "showDisplayPhoto wires the error handler on every photo it sets"
    );
  });

  test("the Generate catch carries the server's reason into the local failed state", function () {
    assert.ok(
      html.includes('lastError: (err && err.message) || ""'),
      "local failed state must carry lastError, not just status"
    );
  });
});
