// #138: Today state owns an explicit local date. A session left
// open across midnight must never show, wear, or persist
// yesterday's pick as today's. The seven-day walk below mirrors
// the issue's diagnostic: distinct preseeded picks for Nov 2–8,
// 2026 (Nov 8 is the DST change in America/Los_Angeles), one
// open session, restoreToday called per day as renderToday does.
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

// --- Fake clock: local calendar parts, controllable per day. ---
let fakeY = 2026, fakeM = 10, fakeD = 2, fakeNowMs = 1000;
function FakeDate() {}
FakeDate.prototype.getFullYear = function () { return fakeY; };
FakeDate.prototype.getMonth = function () { return fakeM; };
FakeDate.prototype.getDate = function () { return fakeD; };
FakeDate.prototype.getHours = function () { return 9; };
FakeDate.now = function () { return fakeNowMs; };
global.Date = FakeDate;

function setDay(d) {
  fakeD = d;
  fakeNowMs = 1000 + d;
}

const localTodayStr = extractClientFn("localTodayStr", "");
const todayCacheKey = extractClientFn("todayCacheKey", "");
const reconcileTodayDate = extractClientFn("reconcileTodayDate", "");
const resetTodayStateFor = extractClientFn("resetTodayStateFor", "date");
const restoreToday = extractClientFn("restoreToday", "");
const persistToday = extractClientFn("persistToday", "");
const watchTodayPicks = extractClientFn("watchTodayPicks", "user");
const generateTodayPick = extractClientFn("generateTodayPick", "previousPick, reasonNote");

// The extracted functions call each other by bare name, so they
// must live on the global object (new Function bodies run there).
global.localTodayStr = localTodayStr;
global.todayCacheKey = todayCacheKey;
global.reconcileTodayDate = reconcileTodayDate;
global.resetTodayStateFor = resetTodayStateFor;
global.restoreToday = restoreToday;
global.persistToday = persistToday;
global.watchTodayPicks = watchTodayPicks;
global.generateTodayPick = generateTodayPick;

// --- Fake Firestore: docs, listeners, write log. ---
function makeDb() {
  const docs = {};
  const listeners = {};
  const writes = [];
  const unsubs = [];
  function docRef(path) {
    return {
      onSnapshot: function (cb) {
        (listeners[path] = listeners[path] || []).push(cb);
        return function () {
          unsubs.push(path);
          const i = (listeners[path] || []).indexOf(cb);
          if (i > -1) listeners[path].splice(i, 1);
        };
      },
      set: function (data) {
        writes.push({ path, data });
        docs[path] = Object.assign({}, docs[path] || {}, data);
        return Promise.resolve();
      },
      get: function () {
        const d = docs[path];
        return Promise.resolve(d ? { exists: true, data: function () { return d; } } : { exists: false, data: function () { return {}; } });
      },
    };
  }
  function collection(name) {
    return {
      doc: function (id) {
        return {
          collection: function (name2) {
            return { doc: function (id2) { return docRef(name + "/" + id + "/" + name2 + "/" + id2); } };
          },
        };
      },
    };
  }
  return {
    collection,
    writes,
    unsubs,
    listeners,
    fire: function (path, data) {
      (listeners[path] || []).slice().forEach(function (cb) {
        cb({ exists: true, data: function () { return data; } });
      });
    },
    subscribedPaths: function () { return Object.keys(listeners).filter((p) => listeners[p].length); },
  };
}

function makeStorage() {
  const map = {};
  return {
    getItem: function (k) { return k in map ? map[k] : null; },
    setItem: function (k, v) { map[k] = String(v); },
  };
}

function freshState() {
  return { picks: [], idx: 0, generating: false, wornSet: {}, loaded: false, error: false, renderToken: 0, waitingSince: 0, date: null, kickAt: 0 };
}

function setup() {
  const db = makeDb();
  const storage = makeStorage();
  global.db = db;
  global.window = { localStorage: storage };
  global.currentUser = { uid: "u1" };
  global.todayState = freshState();
  global.todayPicksUnsub = null;
  global.maybeRenderToday = function () {};
  global.renderChatTodayStrip = function () {};
  global.healAcceptedAttach = function () {};
  global.activeThreadKey = "general";
  global.stylistMessages = [];
  global.firebase = { firestore: { FieldValue: { serverTimestamp: function () { return "TS"; } } } };
  global.functions = {};
  global.renderToday = function () {};
  global.getWeatherSummary = function () { return Promise.resolve("Sunny"); };
  global.stylistItems = function () { return []; };
  global.detectVibeTag = function () { return null; };
  setDay(2);
  return { db, storage };
}

function seedDay(storage, day, label) {
  storage.setItem("closetTodayPicks:u1:2026-11-" + String(day).padStart(2, "0"),
    JSON.stringify({ picks: [{ outfit: { lookName: label, itemIds: ["a", "b"] }, note: null }], idx: 0 }));
}

const flush = () => new Promise((r) => setImmediate(r));

describe("Today date ownership (#138)", () => {
  test("seven consecutive days resolve to their own daily records", () => {
    const { db, storage } = setup();
    for (let d = 2; d <= 8; d++) seedDay(storage, d, "Cached day " + (d - 1));
    watchTodayPicks(global.currentUser);
    for (let d = 2; d <= 8; d++) {
      setDay(d);
      restoreToday();
      const day = "2026-11-" + String(d).padStart(2, "0");
      assert.strictEqual(global.todayState.date, day, "state owns the wrong date on day " + d);
      assert.strictEqual(global.todayState.picks[0].outfit.lookName, "Cached day " + (d - 1),
        "day " + d + " shows another day's pick");
      assert.deepStrictEqual(db.subscribedPaths(), ["users/u1/today_picks/" + day],
        "listener not rebound to day " + d);
    }
    assert.strictEqual(db.unsubs.length, 6, "expected one unsubscribe per rollover, got " + db.unsubs.length);
  });

  test("a stale listener callback cannot restore yesterday's pick", () => {
    const { db } = setup();
    watchTodayPicks(global.currentUser);
    db.fire("users/u1/today_picks/2026-11-02", { picks: [{ outfit: { lookName: "Day 2 pick", itemIds: ["a"] } }], idx: 0 });
    assert.strictEqual(global.todayState.picks[0].outfit.lookName, "Day 2 pick");
    setDay(3);
    db.fire("users/u1/today_picks/2026-11-02", { picks: [{ outfit: { lookName: "STALE", itemIds: ["z"] } }], idx: 0 });
    assert.strictEqual(global.todayState.picks[0].outfit.lookName, "Day 2 pick", "stale callback overwrote the pick");
    reconcileTodayDate();
    db.fire("users/u1/today_picks/2026-11-03", { picks: [{ outfit: { lookName: "Day 3 pick", itemIds: ["c"] } }], idx: 0 });
    assert.strictEqual(global.todayState.picks[0].outfit.lookName, "Day 3 pick");
  });

  test("prior-day state cannot be persisted into today's record", () => {
    const { db, storage } = setup();
    seedDay(storage, 2, "Cached day 1");
    seedDay(storage, 8, "Cached day 7");
    restoreToday();
    assert.strictEqual(global.todayState.picks[0].outfit.lookName, "Cached day 1");
    setDay(8);
    persistToday();
    assert.deepStrictEqual(db.writes, [], "yesterday's pick was written into today's record");
    reconcileTodayDate();
    restoreToday();
    assert.strictEqual(global.todayState.picks[0].outfit.lookName, "Cached day 7");
    persistToday();
    assert.strictEqual(db.writes.length, 1, "today's pick was not persisted after reconcile");
    assert.strictEqual(db.writes[0].path, "users/u1/today_picks/2026-11-08");
    assert.strictEqual(db.writes[0].data.picks[0].outfit.lookName, "Cached day 7");
  });

  test("a generation that completes after midnight is dropped, never saved", async () => {
    const { db } = setup();
    let resolveStylist;
    global.callAskStylist = function () {
      return new Promise(function (res) { resolveStylist = res; });
    };
    global.todayState.date = "2026-11-02";
    generateTodayPick(null, null);
    await flush(); await flush(); await flush();
    assert.strictEqual(global.todayState.generating, true, "generation did not start");
    setDay(3);
    resolveStylist({ data: { outfit: { itemIds: ["a", "b"], lookName: "Midnight pick" }, reply: "done" } });
    await flush(); await flush(); await flush();
    assert.deepStrictEqual(global.todayState.picks, [], "midnight-crossing generation landed as a pick");
    assert.strictEqual(global.todayState.generating, false, "generation flag stuck after the drop");
    assert.ok(!db.writes.some((w) => w.path === "users/u1/today_picks/2026-11-03"),
      "midnight-crossing generation was persisted under the new day");
  });

  test("the daily actions reconcile before they act", () => {
    const src = html;
    assert.ok(src.includes("function todayWear() {\n        // #138: reconcile first"), "todayWear does not reconcile");
    assert.ok(src.includes("function todayAnother() {\n        reconcileTodayDate();"), "todayAnother does not reconcile");
    assert.ok(src.includes("function submitRejection(withReason) {\n        // #138: reconcile first"), "submitRejection does not reconcile");
    assert.ok(src.includes("if (!document.hidden && !document.getElementById(\"todayView\").hidden) renderToday();"),
      "visibility resume does not re-render Today");
  });
});
