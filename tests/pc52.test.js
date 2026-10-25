// PC-52: the stylist may PROPOSE attaching today's pick —
// never attach itself. Three layers, all pinned here:
// (1) the brief only offers the proposal under the exact
// conditions (general chat, pick available, none attached,
// none dismissed); (2) the model's field is a strict literal
// ("todayPick" or nothing); (3) askStylist's gate drops
// out-of-turn proposals (covered by the brief/parse layers
// plus the gate's identical conditions).
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { buildStylistRequest, parseStylistJson } = require("../functions/stylist.js");

const TODAY = "2026-10-24";
function req(over) {
  const a = Object.assign({
    trip: null, pins: [], todayPick: null, attachCtx: { available: true, dismissed: false },
  }, over || {});
  return buildStylistRequest([], [], null, null, null, null, null, null,
    a.trip, a.pins, TODAY, a.todayPick, null, null, a.attachCtx);
}

describe("PC-52 brief gating", () => {
  test("offers the attach proposal under the exact conditions", () => {
    const sys = req().config.systemInstruction;
    assert.ok(sys.includes("ATTACH PROPOSAL"));
    assert.ok(sys.includes('"attachProposal": "todayPick"'));
  });
  test("no section when a proposal was already dismissed here", () => {
    const sys = req({ attachCtx: { available: true, dismissed: true } }).config.systemInstruction;
    assert.ok(!sys.includes("ATTACH PROPOSAL"));
  });
  test("no section when no pick is available", () => {
    const sys = req({ attachCtx: { available: false, dismissed: false } }).config.systemInstruction;
    assert.ok(!sys.includes("ATTACH PROPOSAL"));
  });
  test("no section when the pick is already attached", () => {
    const sys = req({ todayPick: { itemIds: ["a", "b"] } }).config.systemInstruction;
    assert.ok(!sys.includes("ATTACH PROPOSAL"));
  });
  test("no section in trip conversations", () => {
    const sys = req({ trip: { tripId: "t1", leg: {}, packing: null } }).config.systemInstruction;
    assert.ok(!sys.includes("ATTACH PROPOSAL"));
  });
  test("no section without attachCtx (older callers)", () => {
    const sys = req({ attachCtx: undefined }).config.systemInstruction;
    assert.ok(!sys.includes("ATTACH PROPOSAL"));
  });
});

describe("PC-52 parse strictness", () => {
  test("only the literal todayPick survives", () => {
    const ok = parseStylistJson(JSON.stringify({ reply: "Warmer? Say the word.", outfit: null, attachProposal: "todayPick" }), TODAY);
    assert.equal(ok.attachProposal, "todayPick");
    const bad = parseStylistJson(JSON.stringify({ reply: "Hi.", outfit: null, attachProposal: "everything" }), TODAY);
    assert.equal(bad.attachProposal, null);
    const none = parseStylistJson(JSON.stringify({ reply: "Hi.", outfit: null }), TODAY);
    assert.equal(none.attachProposal, null);
  });
});
