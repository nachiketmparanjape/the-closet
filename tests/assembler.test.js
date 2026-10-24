// UX-18 W1: the one assembler + its manifest. The manifest must describe
// the brief as built — these tests pin the resolutions both share.
// Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const {
  assembleContext, buildManifest, resolveIterBase, computeActivePins,
  sanitizeItems, sanitizeMessages, sanitizePins, sanitizeTripContext,
} = require("../functions/stylist.js");

const ITEMS = sanitizeItems([
  { id: "a", name: "Navy crewneck", category: "Tops" },
  { id: "b", name: "Tan chinos", category: "Bottoms" },
  { id: "c", name: "White sneakers", category: "Shoes" },
]);
const MSGS = sanitizeMessages([{ role: "user", text: "dress me" }]);
const PINS = sanitizePins([
  { kind: "location", label: "Tahoe", detail: "", validUntil: "2999-01-01" },
  { kind: "preference", label: "Runs cold", detail: "", validUntil: null },
  { kind: "location", label: "Old place", detail: "", validUntil: "2000-01-01" },
]);

function baseInput(extra) {
  return Object.assign({
    items: ITEMS, messages: MSGS, styleProfile: [], previousPick: null,
    references: { articles: [], outfits: [] }, weatherContext: null,
    vibe: null, vibeProfile: null, tripContext: null, pins: PINS,
    today: "2026-10-24", todayPick: null,
  }, extra || {});
}

describe("resolveIterBase", () => {
  it("previous pick wins over today's pick", () => {
    const r = resolveIterBase({ itemIds: ["a"] }, { itemIds: ["b"] });
    assert.deepEqual(r.base.itemIds, ["a"]);
    assert.equal(r.isToday, false);
  });
  it("today's pick is the base when no previous pick", () => {
    const r = resolveIterBase(null, { itemIds: ["b"] });
    assert.deepEqual(r.base.itemIds, ["b"]);
    assert.equal(r.isToday, true);
  });
  it("no picks → no base", () => {
    assert.equal(resolveIterBase(null, null).base, null);
    assert.equal(resolveIterBase(null, { itemIds: [] }).base, null);
  });
});

describe("computeActivePins", () => {
  it("drops expired pins", () => {
    const active = computeActivePins(PINS, null, "2026-10-24");
    assert.deepEqual(active.map((p) => p.label), ["Tahoe", "Runs cold"]);
  });
  it("in a trip, global location pins drop; preference + trip pins stay", () => {
    const trip = sanitizeTripContext({ tripId: "t1", tripName: "HK", leg: {}, packing: { articleIds: [] } });
    const active = computeActivePins(PINS, trip, "2026-10-24");
    assert.deepEqual(active.map((p) => p.label), ["Runs cold"]);
  });
});

describe("assembleContext + manifest", () => {
  it("general mode: JSON config, manifest lists what was loaded", () => {
    const out = assembleContext(baseInput({
      styleProfile: ["No skinny fits"],
      todayPick: { itemIds: ["a", "b"], lookName: "Rain-Ready", reasoning: "wet" },
      weatherContext: "55°F, rain",
    }));
    assert.equal(out.config.responseMimeType, "application/json");
    assert.equal(out.manifest.wardrobe, 3);
    assert.equal(out.manifest.styleNotes, 1);
    assert.equal(out.manifest.weather, "55°F, rain");
    assert.equal(out.manifest.todayPick.attached, true);
    assert.equal(out.manifest.todayPick.lookName, "Rain-Ready");
    assert.equal(out.manifest.previousPick.fromToday, true);
    assert.deepEqual(out.manifest.pins.map((p) => p.label), ["Tahoe", "Runs cold"]);
    assert.equal(out.manifest.trip, null);
  });
  it("the brief itself carries today's pick when attached (manifest agrees)", () => {
    const out = assembleContext(baseInput({
      todayPick: { itemIds: ["a", "b"], lookName: "Rain-Ready" },
    }));
    const sys = out.config.systemInstruction;
    assert.match(sys, /TODAY'S PICK/);
    assert.equal(out.manifest.todayPick.attached, true);
  });
  it("no pick attached → no TODAY'S PICK block, manifest says so", () => {
    const out = assembleContext(baseInput({}));
    assert.doesNotMatch(out.config.systemInstruction, /TODAY'S PICK/);
    assert.equal(out.manifest.todayPick.attached, false);
  });
  it("trip mode: tools attached, manifest scopes pins like the brief", () => {
    const trip = sanitizeTripContext({
      tripId: "t1", tripName: "Hong Kong",
      leg: { location: "Hong Kong", startDate: "2026-11-23", endDate: "2026-11-29" },
      packing: { articleIds: ["a"], articleReasons: {}, outfits: [] },
    });
    const out = assembleContext(baseInput({ tripContext: trip }));
    assert.ok(Array.isArray(out.config.tools));
    assert.equal(out.manifest.trip.name, "Hong Kong");
    assert.deepEqual(out.manifest.pins.map((p) => p.label), ["Runs cold"]);
  });
  it("learned taste applies only when confident and no style word named", () => {
    const vp = { confidence: 0.8, tags: { streetwear: 0.9, classic: 0.4 } };
    const on = buildManifest(baseInput({ vibeProfile: vp }), []);
    assert.equal(on.learnedTaste.applied, true);
    assert.deepEqual(on.learnedTaste.top, ["streetwear", "classic"]);
    const named = buildManifest(baseInput({ vibeProfile: vp, vibe: "preppy" }), []);
    assert.equal(named.learnedTaste.applied, false);
    assert.equal(named.styleWord, "preppy");
    const shy = buildManifest(baseInput({ vibeProfile: { confidence: 0.1, tags: { streetwear: 0.9 } } }), []);
    assert.equal(shy.learnedTaste.applied, false);
  });
  it("messagesRead respects the reading window", () => {
    // buildManifest counts what it is handed; the sanitizer normally
    // pre-slices, so hand it a raw long list to pin the window math.
    const many = Array.from({ length: 30 }, (_, i) => ({ role: "user", text: "m" + i }));
    const m = buildManifest(baseInput({ messages: many }), []);
    assert.equal(m.messagesTotal, 30);
    assert.equal(m.messagesRead, 20); // MAX_MESSAGES until W5 raises it to 50
  });
});
