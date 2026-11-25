// #136: a labeled Home entry in the primary navigation opens the
// Today screen. It follows the Today-home setting exactly like the
// wordmark does: hidden when the setting is off, never an
// unavailable destination. Run from hosting/:
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
  return new Function(args.split(", ").map((a) => a.trim()).filter(Boolean), body);
}

const syncTodayChrome = extractClientFn("syncTodayChrome", "");

function setup(on, todayVisible) {
  const els = {
    todayHomeBtn: { hidden: true },
    tabHome: { hidden: true },
    todayView: { hidden: !todayVisible },
  };
  const switched = [];
  global.document = { getElementById: function (id) { return els[id] || null; } };
  global.todayHomeOn = function () { return on; };
  global.switchView = function (v) { switched.push(v); };
  return { els, switched };
}

describe("Home tab (#136)", () => {
  test("the tabs carry a labeled Home entry for Today, first", () => {
    const m = html.match(/<div class="tabs"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(m, "tabs bar missing");
    const tabs = m[1];
    assert.ok(tabs.includes('data-view="today"'), "no Home tab with data-view today");
    assert.ok(tabs.includes(">Home</button>"), "Home label missing");
    assert.ok(tabs.indexOf('data-view="today"') < tabs.indexOf('data-view="wardrobe"'), "Home is not the first tab");
    assert.ok(tabs.includes('id="tabHome"'), "Home tab has no id for the chrome sync");
    assert.ok(tabs.includes('role="tab"'), "Home tab is not a tab");
  });

  test("with Today home on, the Home tab and the wordmark both show", () => {
    const { els, switched } = setup(true, true);
    syncTodayChrome();
    assert.strictEqual(els.tabHome.hidden, false);
    assert.strictEqual(els.todayHomeBtn.hidden, false);
    assert.deepStrictEqual(switched, [], "no view switch when the setting is on");
  });

  test("with Today home off, the Home tab hides and Today routes away", () => {
    const { els, switched } = setup(false, true);
    syncTodayChrome();
    assert.strictEqual(els.tabHome.hidden, true);
    assert.strictEqual(els.todayHomeBtn.hidden, true);
    assert.deepStrictEqual(switched, ["wardrobe"]);
  });

  test("with Today home off and another view open, no view switch", () => {
    const { els, switched } = setup(false, false);
    syncTodayChrome();
    assert.strictEqual(els.tabHome.hidden, true);
    assert.deepStrictEqual(switched, []);
  });

  test("switchView marks the Home tab selected on Today (trip maps to Trips)", () => {
    const start = html.indexOf("function switchView(view)");
    assert.ok(start > -1, "switchView missing");
    const body = html.slice(start, start + 1200);
    assert.ok(body.includes('t.getAttribute("data-view") === (view === "trip" ? "trips" : view)'),
      "tab selection does not map data-view to the view");
    assert.ok(body.includes('t.setAttribute("aria-selected"'), "selected state is not exposed accessibly");
  });

  test("the bottom bar shares space evenly, so a sixth entry fits a phone", () => {
    const m = html.match(/\.tab \{[^}]*\}/);
    assert.ok(m, ".tab rule missing");
    assert.ok(m[0].includes("flex: 1"), "tabs do not share space evenly");
    assert.ok(m[0].includes("min-height: 44px"), "44px touch target missing");
  });
});
