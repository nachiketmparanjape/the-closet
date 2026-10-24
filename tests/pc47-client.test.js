// PC-47 wiring guards: wear sorting exists beside Browse,
// aggregates wear_events (not per-item guesses), and the
// never-worn action routes into the stylist with the piece
// as a structured reference. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the sort control offers Browse + the three wear modes", () => {
  assert.ok(html.includes('id="wardrobeSort"'), "sort select missing");
  for (const v of ["browse", "most", "least", "never"]) {
    assert.ok(html.includes('value="' + v + '"'), "mode missing: " + v);
  }
});

test("wear stats aggregate one wear_events query by articleIds", () => {
  assert.ok(html.includes("function ensureWearStats()"), "loader missing");
  assert.ok(html.includes('collection("wear_events").limit(1000)'), "aggregate query missing");
  assert.ok(html.includes("(w.articleIds || []).forEach"), "aggregation missing");
});

test("Browse keeps the category wall; wear modes bypass it", () => {
  assert.ok(html.includes('filter === "All" && !query && wardrobeSortMode === "browse"'), "wall condition not gated");
});

test("never-worn cards carry the badge and the build-a-look action", () => {
  assert.ok(html.includes('"Never worn"'), "badge missing");
  assert.ok(html.includes("Build a look around this"), "action missing");
  assert.ok(html.includes("function buildLookAround(item)"), "action fn missing");
  assert.ok(html.includes("chatRefs.articles.push"), "reference not attached");
  assert.ok(html.includes('chatInput.value = "Build a look around this piece."'), "composer not seeded");
});
