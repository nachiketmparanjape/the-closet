// PC-43 wiring guards: the heal only works if every piece of
// the chain survives edits — flag at both save paths, the
// healer, its trigger in the items snapshot, and the grid's
// "Naming…" state. String-level, same style as the layout
// invariants.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("bulk save flags a failed describe", () => {
  assert.ok(html.includes("if (!r.ai) doc.needsAi = true;"), "bulk flag missing");
});

test("single save flags no-AI + no-user-name", () => {
  assert.ok(html.includes("if (!aiSuggestion && !doc.name) doc.needsAi = true;"), "single flag missing");
});

test("the healer exists and runs off the items snapshot", () => {
  assert.ok(html.includes("function maybeHealUnnamedItems()"), "healer missing");
  assert.ok(html.includes("function healOneItem(it)"), "healOneItem missing");
  assert.ok(html.includes("maybeHealUnnamedItems();"), "snapshot trigger missing");
  assert.ok(html.includes('it.name === "Untitled item" && !it.ai'), "legacy zombie predicate missing");
});

test("the grid shows Naming… instead of the placeholder", () => {
  assert.ok(html.includes('"Naming…"'), "Naming… label missing");
  assert.ok(html.includes("item.needsAi === true"), "card predicate missing");
});
