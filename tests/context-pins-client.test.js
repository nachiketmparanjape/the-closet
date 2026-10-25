// Sprint 17 fix buffer: matchingPins — which stored pins a proposal
// targets. Extracted from public/index.html like tripchat-client.test.js.
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
    new RegExp("function " + name + "\\(pins, proposal\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(pins, proposal\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function("pins", "proposal", body);
}

const matchingPins = extractClientFn("matchingPins");

const pins = [
  { id: "1", kind: "location", label: "New York" },
  { id: "2", kind: "preference", label: "runs cold" },
  { id: "3", kind: "location", label: "Boston", tripId: "t1" }, // trip-scoped
];

describe("matchingPins", () => {
  test("no label: returns all same-kind global pins (save replace)", () => {
    const v = matchingPins(pins, { kind: "location" });
    assert.deepEqual(v.map((p) => p.id), ["1"]);
  });
  test("exact label, case-insensitive", () => {
    const v = matchingPins(pins, { kind: "location", label: "new york" });
    assert.deepEqual(v.map((p) => p.id), ["1"]);
  });
  test("never touches trip-scoped pins", () => {
    const v = matchingPins(pins, { kind: "location", label: "Boston" });
    assert.deepEqual(v.map((p) => p.id), ["1"]); // fuzzy single of kind
    const v2 = matchingPins(
      [{ id: "1", kind: "location", label: "New York" },
       { id: "9", kind: "location", label: "Boston", tripId: "t1" }],
      { kind: "location", label: "Boston" }
    );
    assert.deepEqual(v2.map((p) => p.id), ["1"]);
  });
  test("ambiguous label mismatch with several pins: returns nothing", () => {
    const v = matchingPins(
      [{ id: "1", kind: "location", label: "New York" },
       { id: "2", kind: "location", label: "Tahoe" }],
      { kind: "location", label: "Denver" }
    );
    assert.deepEqual(v, []);
  });
  test("wrong kind: nothing", () => {
    assert.deepEqual(matchingPins(pins, { kind: "weather", label: "x" }), []);
  });
});

// The one fact-write path (2026-10-24): factConflicts decides which
// stored facts a save replaces — for the form AND for proposals.
function extractFactConflicts() {
  const m = html.match(
    /function factConflicts\(kind, label, scopeTripId, selfId\) \{[\s\S]*?\n      \}/
  );
  assert.ok(m, "factConflicts not found in client HTML");
  const body = m[0]
    .replace(/^function factConflicts\(kind, label, scopeTripId, selfId\) \{/, "")
    .replace(/\n      \}$/, "");
  return new Function("allPins", "kind", "label", "scopeTripId", "selfId", body);
}
const factConflicts = extractFactConflicts();

const fcPins = [
  { id: "1", kind: "location", label: "Mountain View" },
  { id: "2", kind: "location", label: "Bay Area" },
  { id: "3", kind: "preference", label: "Runs cold" },
  { id: "4", kind: "preference", label: "Likes linen" },
  { id: "5", kind: "weather", label: "Heatwave", tripId: "t1" },
];

describe("factConflicts — the one fact-write path", () => {
  test("a new place conflicts with EVERY global place (one place at a time)", () => {
    const v = factConflicts(fcPins, "location", "Denver", null, null);
    assert.deepEqual(v.map((p) => p.id), ["1", "2"]);
  });
  test("a new preference conflicts only on an exact same label", () => {
    assert.deepEqual(factConflicts(fcPins, "preference", "Denver", null, null), []);
    const v = factConflicts(fcPins, "preference", "runs cold", null, null);
    assert.deepEqual(v.map((p) => p.id), ["3"]);
  });
  test("editing never conflicts with itself; scopes stay separate", () => {
    assert.deepEqual(factConflicts(fcPins, "location", "Mountain View", null, "1").map((p) => p.id), ["2"]);
    assert.deepEqual(factConflicts(fcPins, "weather", "Storm", "t1", null).map((p) => p.id), ["5"]);
    assert.deepEqual(factConflicts(fcPins, "weather", "Storm", null, null), []);
  });
});
