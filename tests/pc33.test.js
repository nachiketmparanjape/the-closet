// PC-33: trip steering + the pin tense rule. Pins are the
// present-tense layer; trips own the future. Pinned here:
// (1) the trip-proposal sanitizer (destination + real future
// timing or nothing); (2) the suppression — a reply carrying
// a trip proposal never also carries a location/weather pin
// proposal for the same fact (preferences survive);
// (3) the brief offers steering in general chat only, and
// goes silent once dismissed; (4) the tense rule is in the
// pin-proposal brief.
const { describe, test } = require("node:test");
const assert = require("node:assert");
const {
  buildStylistRequest, parseStylistJson, sanitizeTripProposal,
} = require("../functions/stylist.js");

const TODAY = "2026-10-24";

describe("sanitizeTripProposal", () => {
  test("accepts a destination with future dates", () => {
    const p = sanitizeTripProposal(
      { destination: "Glacier National Park", startDate: "2026-10-28", endDate: "2026-11-01", name: "Glacier" },
      TODAY
    );
    assert.deepEqual(p, {
      destination: "Glacier National Park",
      startDate: "2026-10-28",
      endDate: "2026-11-01",
      name: "Glacier",
    });
  });
  test("drops proposals without destination or timing", () => {
    assert.equal(sanitizeTripProposal({ startDate: "2026-10-28" }, TODAY), null);
    assert.equal(sanitizeTripProposal({ destination: "Glacier" }, TODAY), null);
    assert.equal(sanitizeTripProposal(null, TODAY), null);
  });
  test("drops past or malformed start dates (future only)", () => {
    assert.equal(sanitizeTripProposal({ destination: "Glacier", startDate: "2026-10-20" }, TODAY), null);
    assert.equal(sanitizeTripProposal({ destination: "Glacier", startDate: "next week" }, TODAY), null);
    assert.equal(sanitizeTripProposal({ destination: "Glacier", startDate: "2026-13-40" }, TODAY), null);
  });
  test("a bad end date drops only the end date", () => {
    const p = sanitizeTripProposal(
      { destination: "Glacier", startDate: "2026-10-28", endDate: "2026-10-27" }, TODAY);
    assert.equal(p.startDate, "2026-10-28");
    assert.equal(p.endDate, undefined);
  });
});

describe("suppression (parse level)", () => {
  const reply = JSON.stringify({
    reply: "For Glacier next week, layer up.",
    outfit: null,
    tripProposal: { destination: "Glacier National Park", startDate: "2026-10-28" },
    pinProposal: { action: "save", kind: "location", label: "Glacier National Park" },
  });
  test("a trip proposal suppresses a location pin proposal", () => {
    const r = parseStylistJson(reply, TODAY);
    assert.ok(r.tripProposal);
    assert.equal(r.pinProposal, null);
  });
  test("a preference proposal survives alongside a trip proposal", () => {
    const r = parseStylistJson(JSON.stringify({
      reply: "Noted.",
      outfit: null,
      tripProposal: { destination: "Glacier National Park", startDate: "2026-10-28" },
      pinProposal: { action: "save", kind: "preference", label: "packs light" },
    }), TODAY);
    assert.ok(r.tripProposal);
    assert.ok(r.pinProposal);
    assert.equal(r.pinProposal.kind, "preference");
  });
});

describe("brief", () => {
  function sys(over) {
    const a = Object.assign({ trip: null, steerCtx: undefined }, over || {});
    return buildStylistRequest([], [], null, null, null, null, null, null,
      a.trip, [], TODAY, null, null, null, null, a.steerCtx).config.systemInstruction;
  }
  test("general chat gets the steering contract + the tense rule", () => {
    const s = sys();
    assert.ok(s.includes("TRIP PROPOSAL"));
    assert.ok(s.includes("PRESENT-TENSE ONLY"));
  });
  test("dismissed steering goes silent", () => {
    assert.ok(!sys({ steerCtx: { dismissed: true } }).includes("TRIP PROPOSAL"));
  });
  test("trip conversations get neither steering nor the general tense brief", () => {
    const s = sys({ trip: { tripId: "t1", leg: {}, packing: null } });
    assert.ok(!s.includes("TRIP PROPOSAL"));
  });
});
