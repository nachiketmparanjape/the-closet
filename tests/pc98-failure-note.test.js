// PC-98: the failed standardization note named no reason — the
// founder retried the same systematic color failure twice, blind.
// standardizationFailureNote translates the raw lastError into one
// plain sentence naming the reason (and, for a systematic failure,
// what would help instead of the same retry). Run from hosting/:
// node --test "tests/*.test.js"
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

describe("standardizationFailureNote", function () {
  test("the founder's case: systematic color + geometry names both and says what helps", function () {
    const note = standardizationFailureNote("systematic_gate_failure: color(ΔE=28.0), geometry (same gates failed twice)");
    assert.match(note, /wrong color and shape/);
    assert.match(note, /stopped retrying/);
    assert.match(note, /daylight photo/);
  });

  test("systematic color alone names the color and the stop", function () {
    const note = standardizationFailureNote("systematic_gate_failure: color(ΔE=24.3) (same gates failed twice)");
    assert.match(note, /wrong color/);
    assert.match(note, /stopped retrying/);
    assert.doesNotMatch(note, /shape/);
  });

  test("a one-off gate failure still invites a retry (a new draw may pass)", function () {
    const note = standardizationFailureNote("quality_gates_failed: color(ΔE=19.2)");
    assert.match(note, /wrong color/);
    assert.match(note, /Try again/);
    assert.doesNotMatch(note, /stopped retrying/);
  });

  test("a one-off geometry failure names the shape", function () {
    const note = standardizationFailureNote("quality_gates_failed: geometry");
    assert.match(note, /wrong shape/);
    assert.match(note, /Try again/);
  });

  test("a timeout names the timeout", function () {
    assert.match(
      standardizationFailureNote("standardization_timeout: color(ΔE=28.0)"),
      /took too long and timed out/
    );
  });

  test("a missing photo names the missing photo", function () {
    assert.match(standardizationFailureNote("no_photo"), /no photo to work from/);
  });

  test("a service problem says so, without jargon", function () {
    assert.match(standardizationFailureNote("FLUX failed: 500"), /AI service had a problem/);
    assert.doesNotMatch(standardizationFailureNote("FLUX failed: 500"), /FLUX/);
  });

  test("an unknown error falls back to the old text", function () {
    assert.equal(
      standardizationFailureNote("something odd happened"),
      "The AI version didn't come out right. You can try again."
    );
    assert.equal(
      standardizationFailureNote(null),
      "The AI version didn't come out right. You can try again."
    );
  });

  test("no raw error text ever leaks into a note", function () {
    const note = standardizationFailureNote("systematic_gate_failure: color(ΔE=28.0), geometry (same gates failed twice)");
    assert.doesNotMatch(note, /ΔE|systematic_gate_failure|quality_gates/);
  });
});

describe("source pins", function () {
  test("the failed branch uses the translator, not a fixed string", function () {
    assert.ok(
      /note\.textContent = standardizationFailureNote\(std\.lastError\);/.test(html),
      "failed branch must call standardizationFailureNote(std.lastError)"
    );
    assert.equal(
      html.includes("The AI version didn't come out right. You can try again.\";\n          note.hidden = false;"),
      false,
      "the old fixed failed-branch text must be gone"
    );
  });
});
