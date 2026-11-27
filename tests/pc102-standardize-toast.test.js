// PC-102: a background standardization failure's toast looked like
// the foreground action had failed. Round 5: the sweatshirt's
// generation failed while the founder was uploading a new piece,
// and the generic toast ("Something went wrong on our end. Try
// again. (Ref: req_9758)") read as the upload failing — yet the
// upload had succeeded. The toast now names the piece and the
// action it belongs to, so it can never be mistaken for the thing
// the founder is doing right now.
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

const standardizeFailureToast = extractClientFn("standardizeFailureToast", "name, err");

describe("standardizeFailureToast", function () {
  test("the Round 5 case: names the piece, keeps the ref", function () {
    const toast = standardizeFailureToast("Burgundy yellow sweatshirt", { details: { ref: "req_9758" } });
    assert.equal(toast, "The Burgundy yellow sweatshirt's AI version didn't come out right. (Ref: req_9758)");
  });

  test("without a ref there is no parenthetical", function () {
    const toast = standardizeFailureToast("Navy crew-neck tee", {});
    assert.equal(toast, "The Navy crew-neck tee's AI version didn't come out right.");
    assert.doesNotMatch(toast, /Ref:/);
  });

  test("without a name it stays grammatical, never 'null'", function () {
    assert.equal(
      standardizeFailureToast(null, { details: { ref: "req_1" } }),
      "The AI version didn't come out right. (Ref: req_1)"
    );
    assert.doesNotMatch(standardizeFailureToast(null, {}), /null|undefined/);
  });

  test("never the generic text that reads as the foreground action failing", function () {
    const toast = standardizeFailureToast("Burgundy yellow sweatshirt", { details: { ref: "req_9758" } });
    assert.doesNotMatch(toast, /Something went wrong on our end/);
    assert.doesNotMatch(toast, /Try again\./);
  });

  test("no raw error text ever leaks into the toast", function () {
    const toast = standardizeFailureToast("Burgundy yellow sweatshirt", {
      message: "systematic_gate_failure: color(ΔE=20.6)",
      details: { ref: "req_9758" },
    });
    assert.doesNotMatch(toast, /systematic_gate_failure|ΔE/);
  });
});

describe("source pins", function () {
  test("both standardize catch sites toast the named failure, not the generic error", function () {
    const calls = html.match(/showToast\(standardizeFailureToast\(failName, err\)\);/g) || [];
    assert.equal(calls.length, 2, "Generate catch + Refresh catch must both use the named toast");
  });

  test("the Generate catch resolves the name from the item, then the open dialog", function () {
    assert.ok(
      /var failName = \(item && \(item\.shortName \|\| item\.name\)\)/.test(html),
      "Generate catch must name the item it is generating for"
    );
  });
});
