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
const toastStdFailureOnce = extractClientFn("toastStdFailureOnce", "itemId, name, lastError, ref");
const toastNewStdFailures = extractClientFn("toastNewStdFailures", "items, activeItemId, nowMs");

function installFakes() {
  const toasts = [];
  global.showToast = function (m) { toasts.push(m); };
  global.standardizeFailureToast = standardizeFailureToast;
  global.toastStdFailureOnce = toastStdFailureOnce;
  global.stdFailureToasted = {};
  global.prevStdStatus = {};
  return toasts;
}

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

describe("toastStdFailureOnce (Sprint 39: one toast per failure, any path)", function () {
  test("the first sighting toasts; the same failure seen again stays quiet", function () {
    const toasts = installFakes();
    toastStdFailureOnce("it1", "Navy crew-neck tee", "systematic_gate_failure: color(ΔE=20.4)", null);
    toastStdFailureOnce("it1", "Navy crew-neck tee", "systematic_gate_failure: color(ΔE=20.4)", null);
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /Navy crew-neck tee/);
    assert.doesNotMatch(toasts[0], /ΔE|systematic_gate_failure/);
  });

  test("a different reason or a different item is a new failure and toasts", function () {
    const toasts = installFakes();
    toastStdFailureOnce("it1", "Navy crew-neck tee", "systematic_gate_failure: color(ΔE=20.4)", null);
    toastStdFailureOnce("it1", "Navy crew-neck tee", "systematic_gate_failure: color(ΔE=21.1)", null);
    toastStdFailureOnce("it2", "Black tee", "systematic_gate_failure: color(ΔE=20.4)", null);
    assert.equal(toasts.length, 3);
  });

  test("after 10 minutes the same failure may announce itself again", function () {
    const toasts = installFakes();
    global.stdFailureToasted = { "it1|systematic_gate_failure: color": Date.now() - 11 * 60 * 1000 };
    toastStdFailureOnce("it1", "Navy crew-neck tee", "systematic_gate_failure: color", null);
    assert.equal(toasts.length, 1);
  });

  test("a ref rides along when the caller has one", function () {
    const toasts = installFakes();
    toastStdFailureOnce("it1", "Navy crew-neck tee", "standardization_timeout: x", "req_9758");
    assert.match(toasts[0], /\(Ref: req_9758\)/);
  });
});

describe("toastNewStdFailures (Sprint 39: the snapshot is the witness)", function () {
  function failedItem(id, name, lastAttemptAt, lastError) {
    return { id: id, name: name, shortName: name, standardization: { status: "failed", lastAttemptAt: lastAttemptAt, lastError: lastError || "systematic_gate_failure: color(ΔE=20.4)" } };
  }
  test("a fresh background failure toasts once, and not again on the next snapshot", function () {
    const toasts = installFakes();
    const now = Date.now();
    const items = [failedItem("it1", "Navy crew-neck tee", new Date(now - 60 * 1000).toISOString())];
    toastNewStdFailures(items, null, now);
    toastNewStdFailures(items, null, now + 1000);
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /Navy crew-neck tee/);
  });

  test("an old failure is not re-announced on reload", function () {
    const toasts = installFakes();
    const now = Date.now();
    const items = [failedItem("it1", "Navy crew-neck tee", new Date(now - 20 * 60 * 1000).toISOString())];
    toastNewStdFailures(items, null, now);
    assert.equal(toasts.length, 0);
  });

  test("the open dialog's item never toasts — its page already shows the reason", function () {
    const toasts = installFakes();
    const now = Date.now();
    const items = [failedItem("it1", "Navy crew-neck tee", new Date(now - 60 * 1000).toISOString())];
    toastNewStdFailures(items, "it1", now);
    assert.equal(toasts.length, 0);
  });

  test("a processing item, and a failure with no attempt time, stay quiet", function () {
    const toasts = installFakes();
    const now = Date.now();
    const items = [
      { id: "it1", name: "Navy tee", standardization: { status: "processing" } },
      { id: "it2", name: "Black tee", standardization: { status: "failed", lastError: "x" } },
    ];
    toastNewStdFailures(items, null, now);
    assert.equal(toasts.length, 0);
  });
});

describe("source pins", function () {
  test("both standardize catch sites toast the named failure, not the generic error", function () {
    const calls = html.match(/toastStdFailureOnce\(itemId, failName,/g) || [];
    assert.equal(calls.length, 2, "Generate catch + Refresh catch must both use the shared once-toast");
  });

  test("the snapshot listener announces background failures", function () {
    assert.ok(/toastNewStdFailures\(allItems,/.test(html), "watchItems must call toastNewStdFailures on every snapshot");
  });

  test("the Generate catch resolves the name from the item, then the open dialog", function () {
    assert.ok(
      /var failName = \(item && \(item\.shortName \|\| item\.name\)\)/.test(html),
      "Generate catch must name the item it is generating for"
    );
  });
});
