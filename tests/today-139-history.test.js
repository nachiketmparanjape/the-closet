// #139: Today must not repeat a recently worn or suggested
// outfit — same top + bottom with different shoes is still the
// same outfit. The reported example: Monday's worn Campus Classic
// (cream sweatshirt + medium jeans + black sneakers) came back
// Wednesday as "Bay Breeze Classic" with the same three pieces.
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  assembleContext,
  assembleTodayHistory, withBaseKeys, todayHasAlternative,
  todayRepeatProblem, canonicalOutfitKey, baseOutfitKey,
  lastNDates, sanitizeTodayWindow, loadTodayHistory,
  sanitizeItems, sanitizeMessages,
} = require("../functions/stylist.js");

const SW = { id: "sw", name: "Cream San Francisco graphic sweatshirt", category: "Tops" };
const JN = { id: "jn", name: "Medium wash slim jeans", category: "Bottoms" };
const SN = { id: "sn", name: "Allbirds black knit sneakers", category: "Shoes" };
const OS = { id: "os", name: "White sneakers", category: "Shoes" };
const AT = { id: "at", name: "Navy crewneck", category: "Tops" };
const AB = { id: "ab", name: "Tan chinos", category: "Bottoms" };
const ITEMS = sanitizeItems([SW, JN, SN, OS, AT, AB]);
const CAMPUS = ["sw", "jn", "sn"]; // Monday's worn Campus Classic

function historyWithCampus() {
  const h = assembleTodayHistory(
    [{ articleIds: CAMPUS.slice() }],
    [{ date: "2026-11-04", picks: [{ outfit: { itemIds: CAMPUS.slice() } }] }]
  );
  return withBaseKeys(h, ITEMS);
}

describe("canonical outfit identity (#139)", () => {
  it("order and renaming cannot bypass repeat detection (ids only)", () => {
    assert.strictEqual(canonicalOutfitKey(["sn", "jn", "sw"]), canonicalOutfitKey(CAMPUS));
    assert.strictEqual(canonicalOutfitKey(["sw", "sw", "jn"]), "jn|sw");
    assert.strictEqual(canonicalOutfitKey([]), "");
  });

  it("the base is the top + bottom pair; shoes and accessories do not change it", () => {
    assert.strictEqual(baseOutfitKey(CAMPUS, ITEMS), baseOutfitKey(["sw", "jn", "os"], ITEMS));
    assert.notStrictEqual(baseOutfitKey(CAMPUS, ITEMS), baseOutfitKey(["at", "jn", "sn"], ITEMS));
    assert.strictEqual(baseOutfitKey(["sn", "os"], ITEMS), "", "shoes-only has no base");
  });
});

describe("assembleTodayHistory (#139)", () => {
  it("worn and suggested stay distinct; a worn outfit needs only its wear-event ids", () => {
    const h = assembleTodayHistory(
      [{ articleIds: CAMPUS.slice() }], // no outfitId — the saved doc may be gone
      [{ date: "2026-11-04", picks: [{ outfit: { itemIds: CAMPUS.slice() } }] }]
    );
    assert.strictEqual(h.worn.length, 1);
    assert.strictEqual(h.worn[0].kind, "worn");
    assert.deepStrictEqual(h.worn[0].ids, ["jn", "sn", "sw"]);
    assert.strictEqual(h.suggested.length, 1);
    assert.strictEqual(h.suggested[0].kind, "suggested");
    assert.strictEqual(h.suggested[0].date, "2026-11-04");
  });

  it("drops single-piece entries and dedupes within each list", () => {
    const h = assembleTodayHistory(
      [{ articleIds: ["sw"] }, { articleIds: CAMPUS.slice() }, { articleIds: CAMPUS.slice() }],
      [{ date: "2026-11-03", picks: [{ outfit: { itemIds: CAMPUS.slice() } }, { outfit: { itemIds: CAMPUS.slice() } }] }]
    );
    assert.strictEqual(h.worn.length, 1);
    assert.strictEqual(h.suggested.length, 1);
  });
});

describe("todayRepeatProblem (#139)", () => {
  it("the reported example: the same three pieces under a new name is a repeat", () => {
    const p = todayRepeatProblem(CAMPUS.slice(), historyWithCampus(), ITEMS);
    assert.ok(p, "no problem for the exact repeat");
    assert.match(p, /exact outfit was worn/);
  });

  it("shoes-only change is a repeat of the base; a different top is not", () => {
    const h = historyWithCampus();
    const shoesOnly = todayRepeatProblem(["sw", "jn", "os"], h, ITEMS);
    assert.ok(shoesOnly, "shoes-only change passed as fresh");
    assert.match(shoesOnly, /top \+ bottom pair/);
    assert.strictEqual(todayRepeatProblem(["at", "jn", "sn"], h, ITEMS), null);
    assert.strictEqual(todayRepeatProblem(["sw", "ab", "sn"], h, ITEMS), null);
  });

  it("a one-top-one-bottom wardrobe has no alternative, so the repeat is allowed", () => {
    const tiny = sanitizeItems([SW, JN, SN]);
    assert.strictEqual(todayHasAlternative(tiny), false);
    assert.strictEqual(todayRepeatProblem(CAMPUS.slice(), historyWithCampus(), tiny), null);
  });

  it("no history, no problem", () => {
    assert.strictEqual(todayRepeatProblem(CAMPUS.slice(), null, ITEMS), null);
    assert.strictEqual(todayRepeatProblem(CAMPUS.slice(), { worn: [], suggested: [] }, ITEMS), null);
  });

  it("an alternative exists with a second top or a second bottom", () => {
    assert.strictEqual(todayHasAlternative(sanitizeItems([SW, AT, JN])), true);
    assert.strictEqual(todayHasAlternative(sanitizeItems([SW, JN, AB])), true);
  });
});

describe("lastNDates + sanitizeTodayWindow (#139)", () => {
  it("seven local dates back from Nov 8, across the DST change", () => {
    assert.deepStrictEqual(lastNDates("2026-11-08", 7), [
      "2026-11-08", "2026-11-07", "2026-11-06", "2026-11-05",
      "2026-11-04", "2026-11-03", "2026-11-02",
    ]);
  });

  it("crosses a month boundary by calendar arithmetic", () => {
    assert.strictEqual(lastNDates("2026-11-02", 7)[6], "2026-10-27");
    assert.deepStrictEqual(lastNDates("garbage", 7), []);
  });

  it("a valid client window passes through; garbage falls back to a UTC window", () => {
    const good = sanitizeTodayWindow(
      { start: "2026-10-27T07:00:00.000Z", end: "2026-11-03T08:00:00.000Z" }, "2026-11-02");
    assert.strictEqual(good.start.toISOString(), "2026-10-27T07:00:00.000Z");
    assert.strictEqual(good.end.toISOString(), "2026-11-03T08:00:00.000Z");
    const bad = sanitizeTodayWindow({ start: "nope", end: "also nope" }, "2026-11-02");
    assert.strictEqual(bad.start.toISOString(), "2026-10-27T00:00:00.000Z");
    assert.strictEqual(bad.end.toISOString(), "2026-11-02T00:00:00.000Z");
    const reversed = sanitizeTodayWindow(
      { start: "2026-11-03T00:00:00.000Z", end: "2026-10-27T00:00:00.000Z" }, "2026-11-02");
    assert.strictEqual(reversed.start.toISOString(), "2026-10-27T00:00:00.000Z");
    const tooWide = sanitizeTodayWindow(
      { start: "2026-10-01T00:00:00.000Z", end: "2026-11-02T00:00:00.000Z" }, "2026-11-02");
    assert.strictEqual(tooWide.start.toISOString(), "2026-10-27T00:00:00.000Z");
  });
});

describe("loadTodayHistory (#139)", () => {
  it("reads the windowed wear events and the seven daily pick docs", async () => {
    const whereArgs = [];
    const wearDocs = [
      { data: () => ({ articleIds: CAMPUS.slice(), wornAt: new Date("2026-11-02T18:00:00Z") }) },
      { data: () => ({ articleIds: ["at", "ab", "sn"], wornAt: new Date("2026-10-20T18:00:00Z") }) },
    ];
    const pickDocs = {
      "2026-11-04": { exists: true, data: () => ({ picks: [{ outfit: { itemIds: CAMPUS.slice() } }] }) },
      "2026-11-03": { exists: true, data: () => ({ picks: [{ outfit: { itemIds: ["at", "ab", "sn"] } }] }) },
    };
    const db = {
      collection: (name) => ({
        doc: (id) => ({
          collection: (name2) => {
            if (name2 === "wear_events") {
              return {
                where: (field, op, value) => {
                  whereArgs.push([field, op, value]);
                  return {
                    where: (f2, op2, v2) => {
                      whereArgs.push([f2, op2, v2]);
                      return {
                        limit: () => ({
                          get: async () => ({
                            docs: wearDocs.filter((d) => {
                              const t = d.data().wornAt;
                              return t >= whereArgs[0][2] && t < whereArgs[1][2];
                            }),
                          }),
                        }),
                      };
                    },
                  };
                },
              };
            }
            return {
              doc: (date) => ({
                get: async () => pickDocs[date] || { exists: false, data: () => ({}) },
              }),
            };
          },
        }),
      }),
    };
    const h = await loadTodayHistory(db, "u1", "2026-11-04",
      { start: new Date("2026-10-29T07:00:00.000Z"), end: new Date("2026-11-05T08:00:00.000Z") });
    assert.strictEqual(h.worn.length, 1, "the out-of-window wear leaked in");
    assert.deepStrictEqual(h.worn[0].ids, ["jn", "sn", "sw"]);
    assert.strictEqual(h.suggested.length, 2, "expected the Nov 4 + Nov 3 picks");
    assert.deepStrictEqual(whereArgs[0].slice(0, 2), ["wornAt", ">="]);
    assert.deepStrictEqual(whereArgs[1].slice(0, 2), ["wornAt", "<"]);
  });
});

describe("RECENT HISTORY brief (#139)", () => {
  it("names the worn and suggested outfits by handle with the repeat rule", () => {
    const out = assembleContext({
      items: ITEMS, messages: sanitizeMessages([{ role: "user", text: "dress me" }]),
      styleProfile: [], previousPick: null, references: { articles: [], outfits: [] },
      weatherContext: null, vibe: null, vibeProfile: null, tripContext: null,
      pins: [], today: "2026-11-04", todayPick: null, todayHistory: historyWithCampus(),
    });
    const sys = out.config.systemInstruction;
    assert.ok(sys.includes("RECENT HISTORY"), "brief section missing");
    assert.ok(sys.includes("Worn recently:"), "worn line missing");
    assert.ok(sys.includes('[i1] "Cream San Francisco graphic sweatshirt"'), "worn handles missing");
    assert.ok(sys.includes("Already suggested (Nov 4):"), "suggested line missing its date");
    assert.match(sys, /same top \+ bottom pair/);
  });

  it("no history, no brief section", () => {
    const out = assembleContext({
      items: ITEMS, messages: sanitizeMessages([{ role: "user", text: "dress me" }]),
      styleProfile: [], previousPick: null, references: { articles: [], outfits: [] },
      weatherContext: null, vibe: null, vibeProfile: null, tripContext: null,
      pins: [], today: "2026-11-04", todayPick: null, todayHistory: null,
    });
    assert.ok(!out.config.systemInstruction.includes("RECENT HISTORY"));
  });

  it("entries whose core pieces are gone from the wardrobe are skipped", () => {
    const gone = assembleTodayHistory(
      [{ articleIds: ["gone-top", "gone-bottom", "sn"] }], []);
    const out = assembleContext({
      items: ITEMS, messages: sanitizeMessages([{ role: "user", text: "dress me" }]),
      styleProfile: [], previousPick: null, references: { articles: [], outfits: [] },
      weatherContext: null, vibe: null, vibeProfile: null, tripContext: null,
      pins: [], today: "2026-11-04", todayPick: null, todayHistory: withBaseKeys(gone, ITEMS),
    });
    assert.ok(!out.config.systemInstruction.includes("RECENT HISTORY"));
  });
});

describe("client Today generation (#139)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  it("the generation flags itself and sends its local window", () => {
    const start = html.indexOf("function generateTodayPick(previousPick, reasonNote)");
    assert.ok(start > -1, "generateTodayPick missing");
    const body = html.slice(start, start + 4000);
    assert.ok(body.includes("todayGeneration: true"), "no todayGeneration flag — history would load for chat too");
    assert.ok(body.includes("todayWindow: todayHistoryWindow()"), "no local window sent");
    assert.ok(body.includes("Give me another option for today"), "Another has no explicit distinct-outfit intent");
  });

  it("todayHistoryWindow spans seven local midnights and covers now", () => {
    const m = html.match(/function todayHistoryWindow\(\) \{[\s\S]*?\n      \}/);
    assert.ok(m, "todayHistoryWindow missing");
    const body = m[0]
      .replace(/^function todayHistoryWindow\(\) \{/, "")
      .replace(/\n      \}$/, "");
    const fn = new Function(body);
    const w = fn();
    const startMs = Date.parse(w.start);
    const endMs = Date.parse(w.end);
    assert.ok(Number.isFinite(startMs) && Number.isFinite(endMs), "window bounds are not ISO dates");
    const span = endMs - startMs;
    assert.ok(span >= 7 * 86400000 && span <= 7 * 86400000 + 3600000,
      "window is not seven local days (DST makes one day 25h): " + span);
    const s = new Date(w.start);
    const e = new Date(w.end);
    assert.strictEqual(s.getHours(), 0, "window does not start at local midnight");
    assert.strictEqual(e.getHours(), 0, "window does not end at local midnight");
    assert.ok(startMs <= Date.now() && Date.now() < endMs, "window does not cover now");
  });
});
