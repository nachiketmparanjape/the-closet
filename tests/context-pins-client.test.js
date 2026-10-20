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
