// PC-63 guards: raw [iNN] item handles (prompt-local references)
// must never render in chat prose. Founder screenshots 2026-11-21
// showed "[i42]" / "[i32]" in main-chat stylist replies — the
// follow-up sheet stripped them, the main chat renderer did not.
// The stripper is extracted from the client and exercised for
// real; source assertions pin both renderers to the shared helper.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractFn(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " not found in index.html");
  let depth = 0, i = html.indexOf("{", start);
  const bodyStart = i;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}

const stripItemHandles = new Function(
  extractFn("stripItemHandles") + "\nreturn stripItemHandles;"
)();

test("handles are stripped mid-sentence and at line ends", () => {
  assert.equal(
    stripItemHandles("using your grey sweater [i42] and your medium wash slim jeans [i32] to keep it going."),
    "using your grey sweater and your medium wash slim jeans to keep it going."
  );
  assert.equal(stripItemHandles("Try the grey sweater [i42]"), "Try the grey sweater");
  assert.equal(stripItemHandles("[i7] That one works."), "That one works.");
});

test("bold-wrapped mentions keep the name, lose the handle", () => {
  assert.equal(stripItemHandles("**Grey sweater [i45]** pairs well"), "**Grey sweater** pairs well");
});

test("text without handles is untouched; non-handle brackets survive", () => {
  assert.equal(stripItemHandles("A plain reply with no references."), "A plain reply with no references.");
  assert.equal(stripItemHandles("Sizes run [i]regular here"), "Sizes run [i]regular here");
  assert.equal(stripItemHandles(""), "");
  assert.equal(stripItemHandles(null), "");
});

test("the main chat renderer strips handles for model messages only", () => {
  assert.ok(
    html.includes('t.textContent = m.role === "model" ? stripItemHandles(m.text) : m.text;'),
    "renderChat does not route model text through stripItemHandles"
  );
});

test("the follow-up sheet renderer uses the same shared helper", () => {
  assert.ok(html.includes("t = stripItemHandles(t);"), "renderReplyText does not use stripItemHandles");
});
