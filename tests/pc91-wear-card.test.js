// PC-91: Today does not surface a wear logged today.
// Round 3 (2026-11-25) repro: Pacific Fog logged as worn today
// (detail "Worn 1x · Nov 25", feature "WORN ✓"), but Today's wear
// card still read "Saturday you wore: Matinee Utility" after reload.
// Cause, proven from the code: the rate card in renderTodayThread
// took the first wear with `ds < todayStr` — today's wear was
// excluded by the filter itself, not by a stale cache. A reload
// could not fix it. Second defect in the same card: the label
// carried no date ("Saturday"), so the Nov 14 wear read as this
// Saturday (Nov 14 and Nov 21 are both Saturdays).
// Fix: pickWearCard prefers today's wear, else the latest pre-today
// wear (the rating job stays); wearCardWhenLabel always carries a
// date. Run from hosting/: node --test "tests/*.test.js"
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

const pickWearCard = extractClientFn("pickWearCard", "wears, todayStr, outfitById");
const wearCardWhenLabel = extractClientFn("wearCardWhenLabel", "dateStr, todayStr, yesterdayStrVal");

const TODAY = "2026-11-25";
const YESTERDAY = "2026-11-24";
const outfits = {
  pacific: { id: "o-pacific", name: "Pacific Fog" },
  matinee: { id: "o-matinee", name: "Matinee Utility" },
  estate: { id: "o-estate", name: "Estate Minimalist" },
};
function byId(id) {
  for (const k in outfits) { if (outfits[k].id === id) return outfits[k]; }
  return null;
}

describe("pickWearCard", function () {
  test("Round 3 repro: today's wear beats the older wear", function () {
    // Most-recent-first, as the wear_events query returns them.
    const found = pickWearCard([
      { dateStr: TODAY, outfitId: "o-pacific" },
      { dateStr: "2026-11-14", outfitId: "o-matinee" },
    ], TODAY, byId);
    assert.ok(found);
    assert.equal(found.outfit.name, "Pacific Fog");
    assert.equal(found.dateStr, TODAY);
  });

  test("no wear today: latest pre-today wear, for the rating job", function () {
    const found = pickWearCard([
      { dateStr: "2026-11-14", outfitId: "o-matinee" },
      { dateStr: "2026-11-10", outfitId: "o-estate" },
    ], TODAY, byId);
    assert.ok(found);
    assert.equal(found.outfit.name, "Matinee Utility");
  });

  test("only today's wear: it is the card", function () {
    const found = pickWearCard([{ dateStr: TODAY, outfitId: "o-pacific" }], TODAY, byId);
    assert.ok(found);
    assert.equal(found.outfit.name, "Pacific Fog");
  });

  test("no wears at all: no card", function () {
    assert.equal(pickWearCard([], TODAY, byId), null);
  });

  test("today's wear whose outfit is gone falls back to the older wear", function () {
    const found = pickWearCard([
      { dateStr: TODAY, outfitId: "o-deleted" },
      { dateStr: "2026-11-14", outfitId: "o-matinee" },
    ], TODAY, byId);
    assert.ok(found);
    assert.equal(found.outfit.name, "Matinee Utility");
  });

  test("a wear with no outfitId is skipped, not a dead end", function () {
    const found = pickWearCard([
      { dateStr: TODAY, outfitId: null },
      { dateStr: "2026-11-14", outfitId: "o-matinee" },
    ], TODAY, byId);
    assert.ok(found);
    assert.equal(found.outfit.name, "Matinee Utility");
  });

  test("a future-dated wear is ignored, like the old filter did", function () {
    const found = pickWearCard([{ dateStr: "2026-11-26", outfitId: "o-pacific" }], TODAY, byId);
    assert.equal(found, null);
  });
});

describe("wearCardWhenLabel", function () {
  test("today reads Today, yesterday reads Yesterday", function () {
    assert.equal(wearCardWhenLabel(TODAY, TODAY, YESTERDAY), "Today");
    assert.equal(wearCardWhenLabel(YESTERDAY, TODAY, YESTERDAY), "Yesterday");
  });

  test("an older wear carries weekday and date — Nov 14 is a Saturday", function () {
    const label = wearCardWhenLabel("2026-11-14", TODAY, YESTERDAY);
    assert.match(label, /Saturday/);
    assert.match(label, /Nov 14/);
  });
});

describe("renderTodayThread wiring (source pins)", function () {
  test("the old pre-today-only selector is gone", function () {
    assert.ok(!html.includes("if (ds < todayStr && w.outfitId) found"),
      "the old filter must not remain in the rate card");
  });
  test("the rate card calls the picker and the label helper", function () {
    assert.ok(html.includes("pickWearCard(wears, todayStr"));
    assert.ok(html.includes("wearCardWhenLabel(found.dateStr, todayStr, yesterdayStr())"));
  });
});
