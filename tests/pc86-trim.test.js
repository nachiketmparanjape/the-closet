// PC-86: the context-bar trim was a no-op when the shown text ended
// in "…" (a pin label like "I like timeless …"). truncateAtWord
// popped the trailing "…" and re-added it, so the text never shrank,
// the loop spun to its 60-step guard, and the CSS ellipsis cut
// mid-word ("Mountain Vie…"). Run from hosting/:
// node --test "tests/*.test.js"
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

const truncateAtWord = extractClientFn("truncateAtWord", "text");
global.truncateAtWord = truncateAtWord;
// The zero-width branch is not hit here, but the extracted function
// references window.requestAnimationFrame — stub it defensively.
global.window = { requestAnimationFrame: function (fn) { fn(); } };
const trimContextText = extractClientFn("trimContextText", "el, suffix, tried");

// A stand-in for the .cl-text span: scrollWidth tracks the text at
// 6px per character, and textContent writes are counted.
function fakeEl(text, clientWidth) {
  var value = text;
  var sets = 0;
  var el = { clientWidth: clientWidth };
  Object.defineProperty(el, "textContent", {
    get: function () { return value; },
    set: function (v) { value = v; sets++; },
  });
  Object.defineProperty(el, "scrollWidth", { get: function () { return value.length * 6; } });
  el.sets = function () { return sets; };
  return el;
}

const FULL = "Today's pick · Estate Minimalist  ·  Mountain View  ·  I like timeless …  ·  +2 more";
const SUFFIX = "  ·  +2 more";

describe("trimContextText (PC-86)", () => {
  test("a trailing-ellipsis line actually shrinks to fit, at a word boundary", () => {
    const el = fakeEl(FULL, 346);
    trimContextText(el, SUFFIX);
    assert.strictEqual(el.textContent, "Today's pick · Estate Minimalist …  ·  +2 more");
    assert.ok(el.scrollWidth <= el.clientWidth, "still overflowing after trim");
    assert.strictEqual(el.sets(), 5, "expected 5 trim steps, not a guard-limited spin");
  });

  test("a line that already fits is left alone", () => {
    const el = fakeEl("Today's pick · Estate Minimalist  ·  Mountain View", 346);
    trimContextText(el, "");
    assert.strictEqual(el.textContent, "Today's pick · Estate Minimalist  ·  Mountain View");
    assert.strictEqual(el.sets(), 0);
  });
});

describe("PC-86 wiring (source pins)", () => {
  test("the trim loop stops on no progress instead of spinning to the guard", () => {
    assert.ok(html.includes("if (next === base) break;"), "no-progress break missing from trimContextText");
  });
});
