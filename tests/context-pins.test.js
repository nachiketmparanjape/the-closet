// Sprint 17 (CONTEXT PINS): server-side unit tests — pin sanitization,
// proposal parsing, prompt injection, and the trip-mode pin tool.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizePins,
  sanitizePinProposal,
  parseStylistJson,
  buildStylistRequest,
} = require("../functions/stylist");

describe("sanitizePins", () => {
  test("keeps valid pins, clamps, drops junk", () => {
    const pins = sanitizePins([
      { kind: "location", label: "Tahoe", detail: "visiting", validUntil: "2026-10-25" },
      { kind: "preference", label: "runs cold" },
      { kind: "bogus", label: "nope" },
      { kind: "location", label: "" },
      { kind: "weather", label: "x".repeat(200) },
      { kind: "location", label: "Bad date", validUntil: "soon" },
      null,
      "garbage",
    ]);
    assert.equal(pins.length, 4);
    assert.equal(pins[0].label, "Tahoe");
    assert.equal(pins[0].validUntil, "2026-10-25");
    assert.ok(pins[2].label.length <= 80);
    assert.equal(pins[3].validUntil, ""); // malformed date dropped, pin kept
    assert.ok(!pins.some((p) => p.kind === "bogus"));
  });
  test("returns [] for non-arrays", () => {
    assert.deepEqual(sanitizePins(null), []);
    assert.deepEqual(sanitizePins("x"), []);
  });
});

describe("sanitizePinProposal", () => {
  test("accepts a good proposal, rejects junk", () => {
    const good = sanitizePinProposal({
      kind: "location", label: "Tahoe", detail: "until Sunday",
      weatherSummary: "snowing", validUntil: "2026-10-25",
    });
    assert.ok(good);
    assert.equal(good.kind, "location");
    assert.equal(good.label, "Tahoe");
    assert.equal(sanitizePinProposal({ kind: "location", label: "" }), null);
    assert.equal(sanitizePinProposal({ kind: "mood", label: "x" }), null);
    assert.equal(sanitizePinProposal(null), null);
  });
  test("action defaults to save; remove is preserved", () => {
    assert.equal(sanitizePinProposal({ kind: "location", label: "NY" }).action, "save");
    assert.equal(
      sanitizePinProposal({ kind: "location", label: "NY", action: "remove" }).action, "remove");
    assert.equal(
      sanitizePinProposal({ kind: "location", label: "NY", action: "nuke" }).action, "save");
  });
  test("a past validUntil is dropped (model date fumble), future kept", () => {
    const p = sanitizePinProposal(
      { kind: "location", label: "NY", validUntil: "2024-06-21" }, "2026-10-19");
    assert.equal(p.validUntil, "");
    const q = sanitizePinProposal(
      { kind: "location", label: "NY", validUntil: "2026-10-26" }, "2026-10-19");
    assert.equal(q.validUntil, "2026-10-26");
  });
});

describe("pin prompt injection", () => {
  const pins = [
    { kind: "location", label: "Tahoe", detail: "visiting", validUntil: "2999-01-01" },
    { kind: "preference", label: "runs cold", validUntil: "" },
    { kind: "weather", label: "home", validUntil: "2000-01-01" }, // expired
  ];
  const today = "2026-10-19"; // Monday
  const sys = buildStylistRequest([], [], null, null, null, null, null, null, null, pins, today)
    .config.systemInstruction;
  test("active pins are injected, expired ones are not", () => {
    assert.ok(sys.includes("CURRENT CONTEXT"));
    assert.ok(sys.includes("Tahoe"));
    assert.ok(sys.includes("runs cold"));
    assert.ok(!sys.includes('"home"'));
  });
  test("TODAY line names the user's local date and weekday", () => {
    assert.ok(sys.includes("TODAY is Monday, 2026-10-19"));
    assert.ok(sys.includes("never guess a year"));
  });
  test("expiry filters by the client date, not the server clock", () => {
    const edge = buildStylistRequest([], [], null, null, null, null, null, null, null,
      [{ kind: "location", label: "Tahoe", validUntil: "2026-10-19" }], "2026-10-19")
      .config.systemInstruction;
    assert.ok(edge.includes("Tahoe"));
  });
  test("pin weather outranks measured, conversation still wins", () => {
    assert.ok(sys.includes("outranks the measured"));
    assert.ok(sys.includes("Conversation-stated weather still outranks it"));
  });
  test("normal mode gets the proposal contract, incl. retraction", () => {
    assert.ok(sys.includes("CONTEXT PIN PROPOSAL"));
    assert.ok(sys.includes("pinProposal"));
    assert.ok(sys.includes("\"remove\""));
    assert.ok(sys.includes("no longer holds"));
  });
  test("trip mode gets the pinContext tool", () => {
    const req = buildStylistRequest([], [], null, null, null, null, null, null,
      { tripId: "t1", leg: {}, packing: null }, pins);
    const decls = req.config.tools[0].functionDeclarations.map((d) => d.name);
    assert.ok(decls.includes("pinContext"));
    assert.ok(decls.includes("updateTripPacking"));
    assert.ok(req.config.systemInstruction.includes("PIN PROPOSAL"));
  });
});

describe("parseStylistJson", () => {
  test("extracts an optional pinProposal", () => {
    const r = parseStylistJson(JSON.stringify({
      reply: "Got it.",
      outfit: null,
      pinProposal: { kind: "preference", label: "runs cold" },
    }));
    assert.equal(r.reply, "Got it.");
    assert.ok(r.pinProposal);
    assert.equal(r.pinProposal.label, "runs cold");
    const r2 = parseStylistJson(JSON.stringify({ reply: "Hi.", outfit: null }));
    assert.equal(r2.pinProposal, null);
  });
});
