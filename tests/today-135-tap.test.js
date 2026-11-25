// #135: every piece in Today's pick is tappable — it opens the
// existing item-detail sheet for that exact item, so two similar
// jeans open their own records. Missing pieces render an
// unavailable state with no action. Run from hosting/:
// node --test "tests/*.test.js"
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractClientFn(name, arg) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + arg + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(arg, body);
}

function fakeEl(tag) {
  const el = {
    tag: tag,
    children: [],
    attrs: {},
    classes: [],
    listeners: {},
    textContent: "",
    appendChild: function (c) { this.children.push(c); return c; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
    addEventListener: function (type, fn) { this.listeners[type] = fn; },
  };
  el.classList = { add: function (c) { el.classes.push(c); } };
  return el;
}

const ITEMS = {
  jeansA: { id: "jeansA", name: "Dark wash slim jeans", shortName: "Dark wash jeans", photos: [{ url: "a.jpg" }] },
  jeansB: { id: "jeansB", name: "Medium wash slim jeans", shortName: "Medium wash jeans", photos: [{ url: "b.jpg" }] },
};

function setup(opened) {
  global.document = { createElement: function (tag) { return fakeEl(tag); } };
  global.itemById = function (id) { return ITEMS[id] || null; };
  global.itemPhotos = function (it) { return it.photos || []; };
  global.showDisplayPhoto = function () {};
  global.resolveRenderUrl = function () {};
  global.openItem = function (it) { opened.push(it); };
}

const todayPickFigure = extractClientFn("todayPickFigure", "id");

describe("todayPickFigure (#135)", () => {
  test("a real piece is a keyboard-accessible button that opens its own record", () => {
    const opened = [];
    setup(opened);
    const fig = todayPickFigure("jeansA");
    assert.strictEqual(fig.attrs.role, "button");
    assert.strictEqual(fig.attrs["aria-label"], "View Dark wash jeans");
    assert.strictEqual(fig.tabIndex, 0);
    assert.ok(fig.classes.includes("today-piece"));
    fig.listeners.click();
    assert.deepStrictEqual(opened, [ITEMS.jeansA]);
    fig.listeners.keydown({ key: "Enter", preventDefault: function () {} });
    fig.listeners.keydown({ key: " ", preventDefault: function () {} });
    assert.strictEqual(opened.length, 3, "Enter and Space both open the item");
    fig.listeners.keydown({ key: "Tab", preventDefault: function () {} });
    assert.strictEqual(opened.length, 3, "other keys do not open the item");
  });

  test("two similar jeans open their own distinct records", () => {
    const opened = [];
    setup(opened);
    const figA = todayPickFigure("jeansA");
    const figB = todayPickFigure("jeansB");
    assert.strictEqual(figA.attrs["aria-label"], "View Dark wash jeans");
    assert.strictEqual(figB.attrs["aria-label"], "View Medium wash jeans");
    figA.listeners.click();
    figB.listeners.click();
    assert.deepStrictEqual(opened, [ITEMS.jeansA, ITEMS.jeansB]);
  });

  test("a missing piece is unavailable, with no action", () => {
    const opened = [];
    setup(opened);
    const fig = todayPickFigure("gone");
    assert.ok(fig.classes.includes("today-piece-missing"));
    assert.ok(!fig.classes.includes("today-piece"));
    assert.match(fig.attrs["aria-label"], /no longer in your wardrobe/);
    assert.strictEqual(fig.children[fig.children.length - 1].textContent, "Unknown item");
    assert.deepStrictEqual(Object.keys(fig.listeners), [], "no tap handler on a missing piece");
    assert.strictEqual(opened.length, 0);
  });

  test("renderTodaySlot uses the helper, not an inline figure loop", () => {
    const start = html.indexOf("function renderTodaySlot(slot)");
    assert.ok(start > -1, "renderTodaySlot missing");
    const end = html.indexOf("function todayZeroCard()", start);
    const body = html.slice(start, end);
    assert.ok(body.includes("todayPickFigure(id)"), "pick photos do not go through todayPickFigure");
    assert.ok(!body.includes('document.createElement("figure")'), "inline figure building still in renderTodaySlot");
  });

  test("the tappable piece has a pointer cursor and a visible focus ring", () => {
    assert.ok(html.includes(".today-pick-photos .today-piece { cursor: pointer; }"), "pointer cursor missing");
    assert.ok(html.includes(".today-pick-photos .today-piece:focus-visible"), "focus ring missing");
  });
});
