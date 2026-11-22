// PC-65 guards: the same item set proposed twice in a thread is
// the SAME outfit — one card, the first name, the first
// confidence. The founder's thread showed one 3-piece combo
// carded three times under three names with scores 8/9/8.
// Client: outfitSetKey is extracted and exercised for real;
// source assertions pin the render-time substitution. Server:
// the SYSTEM rule is pinned.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const stylistSrc = fs.readFileSync(path.join(__dirname, "..", "functions", "stylist.js"), "utf8");

function extractFn(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " not found in index.html");
  let depth = 0, i = html.indexOf("{", start);
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}

const outfitSetKey = new Function(extractFn("outfitSetKey") + "\nreturn outfitSetKey;")();

test("set identity is order-insensitive and set-sensitive", () => {
  assert.equal(outfitSetKey(["a", "b", "c"]), outfitSetKey(["c", "a", "b"]));
  assert.notEqual(outfitSetKey(["a", "b", "c"]), outfitSetKey(["a", "b", "d"]));
  assert.notEqual(outfitSetKey(["a", "b"]), outfitSetKey(["a", "b", "c"]));
  assert.equal(outfitSetKey([]), "");
  assert.equal(outfitSetKey(null), "");
});

test("renderChat dedupes by set and renders the strip for repeats", () => {
  assert.ok(html.includes("var firstWithSet = seenOutfitSets[setKey];"), "renderChat does not consult the seen-set map");
  assert.ok(html.includes("chatList.appendChild(renderSameOutfitStrip(m, firstWithSet));"), "repeat does not render the strip");
  assert.ok(html.includes("seenOutfitSets[setKey] = m.outfit;"), "first occurrence is not registered");
});

test("the strip expands the FIRST outfit object — original name and confidence", () => {
  assert.ok(html.includes("wrap.appendChild(renderOutfitCard({ outfit: firstOutfit }));"), "strip does not render the first outfit");
  assert.ok(html.includes('"Same outfit as “"'), "strip label missing");
});

test("the server prompt carries the same-outfit identity rule", () => {
  assert.ok(stylistSrc.includes("SAME OUTFIT, SAME IDENTITY (PC-65)"), "prompt rule missing");
  assert.ok(stylistSrc.includes("never give it a new lookName or different scores"), "rule content missing");
});
