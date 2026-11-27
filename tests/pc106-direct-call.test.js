// PC-106: the auto-standardize trigger never fired, so the app now calls
// the standardizeItem callable directly after every item creation.
// requestStandardization is fire-and-forget: a send failure never blocks
// the UI and never throws — the standardize sweeper heals items whose
// direct call never sent. Run from hosting/:
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

// requestStandardization calls callStandardize by bare name, so both
// live on global; callStandardize reads the global `functions` object.
const callStandardize = extractClientFn("callStandardize", "itemId, opts");
global.callStandardize = callStandardize;
const requestStandardization = extractClientFn("requestStandardization", "itemId");
global.requestStandardization = requestStandardization;

function fakeCallable(calls, failWith) {
  global.functions = {
    httpsCallable: function (name, opts) {
      assert.equal(name, "standardizeItem");
      assert.equal(opts.timeout, 300000);
      return function (payload) {
        calls.push(payload);
        if (failWith) return Promise.reject(failWith);
        return Promise.resolve({ data: { pendingReview: true } });
      };
    },
  };
}

describe("requestStandardization", function () {
  test("calls the standardizeItem callable with the item id and no force", async function () {
    const calls = [];
    fakeCallable(calls);
    await requestStandardization("it-1");
    // The call is fire-and-forget, but the underlying callable promise
    // resolves in the same tick chain — wait one turn for the catch to settle.
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { itemId: "it-1" });
  });

  test("a rejected callable never throws — the sweeper is the backstop", async function () {
    const calls = [];
    fakeCallable(calls, new Error("offline"));
    await requestStandardization("it-2");
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 1, "the call still went out");
  });

  test("no item id means no call", async function () {
    const calls = [];
    fakeCallable(calls);
    await requestStandardization(null);
    await requestStandardization("");
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 0);
  });

  test("pin: all four creation paths call it (parse, two single-adds, shop add)", function () {
    const sites = html.match(/requestStandardization\(docRef\.id\)/g) || [];
    assert.equal(sites.length, 4, "one call per creation path, none lost in a refactor");
    const innerStart = html.indexOf("function applyParseGarmentDecisionsInner");
    const innerEnd = html.indexOf("function saveOutfitParse", innerStart);
    assert.ok(innerStart > 0 && innerEnd > innerStart);
    assert.ok(
      html.slice(innerStart, innerEnd).includes("requestStandardization(docRef.id)"),
      "the parse path (which also serves chat add) must call it"
    );
  });
});
