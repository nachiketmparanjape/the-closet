// Sprint 16 (TRIPCHAT-1): server pure functions for trip chat mode.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
  sanitizeTripContext,
  extractToolCall,
  extractToolCalls,
  mapUpdateTripPacking,
  mapSuggestTripOutfits,
  handleIndex,
  unwrapJsonReply,
  buildStylistRequest,
} = require("../functions/stylist");

describe("sanitizeTripContext", () => {
  test("returns null for non-objects and missing tripId", () => {
    assert.strictEqual(sanitizeTripContext(null), null);
    assert.strictEqual(sanitizeTripContext("x"), null);
    assert.strictEqual(sanitizeTripContext({}), null);
    assert.strictEqual(sanitizeTripContext({ tripId: "" }), null);
  });

  test("passes a valid context through, clamped", () => {
    const ctx = sanitizeTripContext({
      tripId: "abc",
      tripName: "Vancouver",
      leg: {
        location: "Vancouver",
        resolvedName: "Vancouver, Canada",
        startDate: "2026-10-29",
        endDate: "2026-11-06",
      },
      notes: "skiing maybe",
      weatherSummary: "cold and rainy",
      packing: {
        articleIds: ["a", "b", 42, "", "x".repeat(200)],
        articleReasons: { a: "warm", b: "light" },
        outfits: [{ itemIds: ["a", "b"], reasoning: "city day" }],
      },
    });
    assert.strictEqual(ctx.tripId, "abc");
    assert.strictEqual(ctx.tripName, "Vancouver");
    assert.strictEqual(ctx.leg.startDate, "2026-10-29");
    assert.strictEqual(ctx.weatherSummary, "cold and rainy");
    assert.deepStrictEqual(ctx.packing.articleIds, ["a", "b"]);
    assert.deepStrictEqual(ctx.packing.outfits, [
      { itemIds: ["a", "b"], reasoning: "city day", lookName: "", tagline: "", styleNote: "" },
    ]);
  });

  test("caps packing lists and drops malformed outfits", () => {
    const ctx = sanitizeTripContext({
      tripId: "abc",
      packing: {
        articleIds: new Array(50).fill("id").map((x, i) => x + i),
        outfits: [
          { itemIds: ["id1"] }, // single piece — dropped
          { itemIds: ["id1", "id2"], reasoning: "ok" },
        ],
      },
    });
    assert.strictEqual(ctx.packing.articleIds.length, 30);
    assert.strictEqual(ctx.packing.outfits.length, 1);
    assert.strictEqual(ctx.packing.outfits[0].reasoning, "ok");
  });

  test("rejects bad date formats", () => {
    const ctx = sanitizeTripContext({
      tripId: "abc",
      leg: { startDate: "tomorrow", endDate: "2026/11/06" },
    });
    assert.strictEqual(ctx.leg.startDate, "");
    assert.strictEqual(ctx.leg.endDate, "");
  });
});

describe("extractToolCall", () => {
  test("reads the SDK functionCalls shape", () => {
    const r = extractToolCall({
      functionCalls: [{ name: "updateTripPacking", args: { whatChanged: "warmer" } }],
      text: "",
    });
    assert.deepStrictEqual(r, {
      name: "updateTripPacking",
      args: { whatChanged: "warmer" },
    });
  });

  test("reads the raw candidates-parts shape", () => {
    const r = extractToolCall({
      candidates: [
        { content: { parts: [{ functionCall: { name: "updateTripPacking", args: {} } }] } },
      ],
    });
    assert.strictEqual(r.name, "updateTripPacking");
  });

  test("returns null when there is no call", () => {
    assert.strictEqual(extractToolCall({}), null);
    assert.strictEqual(extractToolCall(null), null);
    assert.strictEqual(extractToolCall({ functionCalls: [] }), null);
  });
});

describe("buildStylistRequest weather/trip wiring", () => {
  const items = [
    { id: "a", name: "Blue sweater", colors: [], formality: 5, warmth: 7 },
    { id: "b", name: "White tee", colors: [], formality: 3, warmth: 3 },
  ];
  const messages = [{ role: "user", text: "hello" }];

  test("measured weather carries the active-weather override rule", () => {
    const req = buildStylistRequest(items, messages, [], null, null, "72°F and sunny");
    assert.ok(req.config.systemInstruction.includes("ACTIVE-WEATHER RULE"));
    assert.strictEqual(req.config.responseMimeType, "application/json");
    assert.strictEqual(req.config.tools, undefined);
  });

  test("trip mode: tool declared, no forced JSON, trip weather is default", () => {
    const ctx = sanitizeTripContext({
      tripId: "t1",
      tripName: "Vancouver",
      leg: { resolvedName: "Vancouver, Canada", startDate: "2026-10-29", endDate: "2026-11-06" },
      weatherSummary: "cold, rainy",
      packing: { articleIds: ["a"], articleReasons: { a: "warm" }, outfits: [] },
    });
    const req = buildStylistRequest(items, messages, [], null, null, null, null, null, ctx);
    assert.ok(req.config.systemInstruction.includes("TRIP MODE"));
    assert.ok(req.config.systemInstruction.includes("WEATHER DEFAULT"));
    assert.ok(req.config.systemInstruction.includes("CURRENT PACKING PLAN"));
    assert.strictEqual(req.config.responseMimeType, undefined);
    assert.strictEqual(req.config.tools[0].functionDeclarations[0].name, "updateTripPacking");
  });
});

describe("handleIndex", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  test("maps [iN] to a 0-based index", () => {
    assert.strictEqual(handleIndex("[i1]", items), 0);
    assert.strictEqual(handleIndex("[i3]", items), 2);
  });
  test("rejects out-of-range and handle-free strings", () => {
    assert.strictEqual(handleIndex("[i0]", items), -1);
    assert.strictEqual(handleIndex("[i4]", items), -1);
    assert.strictEqual(handleIndex("[x2]", items), -1);
    assert.strictEqual(handleIndex("banana", items), -1);
    assert.strictEqual(handleIndex(null, items), -1);
  });
  test("accepts the handle forms the model actually sends", () => {
    // The strict anchored match rejected every one of these in
    // production (2026-10-21): the plan mapped to zero pieces and
    // trip chat answered "came back empty."
    assert.strictEqual(handleIndex("i2", items), 1);
    assert.strictEqual(handleIndex("[i2] \"Some name\"", items), 1);
    assert.strictEqual(handleIndex("the [i3] one", items), 2);
  });
});

describe("unwrapJsonReply", () => {
  test("unwraps the non-trip JSON envelope the model sometimes sends in trip mode", () => {
    assert.strictEqual(
      unwrapJsonReply('{"reply": "Capsule wardrobe — mix and match.", "outfit": null}'),
      "Capsule wardrobe — mix and match."
    );
  });
  test("leaves plain prose and non-envelope JSON alone", () => {
    assert.strictEqual(unwrapJsonReply("Packing updated — added the fleece."), "Packing updated — added the fleece.");
    assert.strictEqual(unwrapJsonReply('{"something": "else"}'), '{"something": "else"}');
    assert.strictEqual(unwrapJsonReply(""), "");
    assert.strictEqual(unwrapJsonReply(null), null);
  });
});

describe("mapSuggestTripOutfits", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  test("maps handles to ids, restricted to plan pieces", () => {
    const out = mapSuggestTripOutfits({ outfits: [
      { handles: ["[i1]", "[i2]"], reasoning: "packed pair", lookName: "Harbour Luxe", tagline: "Salt air, clean lines", styleNote: "Harbour money, dock hands." },
      { handles: ["[i3]", "[i4]"], reasoning: "d is not packed" },
    ] }, items, ["a", "b", "c"]);
    assert.strictEqual(out.length, 1);
    assert.deepStrictEqual(out[0].itemIds, ["a", "b"]);
    assert.strictEqual(out[0].reasoning, "packed pair");
    assert.strictEqual(out[0].lookName, "Harbour Luxe");
    assert.strictEqual(out[0].tagline, "Salt air, clean lines");
    assert.strictEqual(out[0].styleNote, "Harbour money, dock hands.");
  });
  test("dedupes identical combinations, drops sub-2-piece outfits, caps at 4", () => {
    const out = mapSuggestTripOutfits({ outfits: [
      { handles: ["[i1]", "[i2]"] },
      { handles: ["[i2]", "[i1]"] },
      { handles: ["[i1]"] },
      { handles: ["[i1]", "[i3]"] },
      { handles: ["[i2]", "[i3]"] },
      { handles: ["[i1]", "[i2]", "[i3]"] },
      { handles: ["[i3]", "[i2]", "[i1]"] },
    ] }, items, []);
    assert.strictEqual(out.length, 4);
  });
  test("no plan restriction when plan ids are unknown", () => {
    const out = mapSuggestTripOutfits({ outfits: [{ handles: ["i4", "[i2]"] }] }, items, []);
    assert.deepStrictEqual(out[0].itemIds, ["d", "b"]);
  });
});

describe("extractToolCalls", () => {
  test("returns all calls from the SDK shape, in order", () => {
    const calls = extractToolCalls({
      functionCalls: [
        { name: "pinContext", args: { kind: "preference" } },
        { name: "updateTripPacking", args: { articles: [] } },
      ],
    });
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[0].name, "pinContext");
    assert.strictEqual(calls[1].name, "updateTripPacking");
  });
  test("returns all calls from the raw parts shape", () => {
    const calls = extractToolCalls({
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: "updateTripPacking", args: {} } },
              { functionCall: { name: "pinContext", args: {} } },
            ],
          },
        },
      ],
    });
    assert.deepStrictEqual(calls.map((c) => c.name), ["updateTripPacking", "pinContext"]);
  });
  test("returns [] when there are no calls", () => {
    assert.deepStrictEqual(extractToolCalls({}), []);
    assert.deepStrictEqual(extractToolCalls(null), []);
  });
});

describe("mapUpdateTripPacking", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  test("maps [iN] handles to ids, drops bad handles, keeps >=2-piece outfits", () => {
    const m = mapUpdateTripPacking(
      {
        articles: [
          { handle: "[i1]", reason: "warm" },
          { handle: "[i2]" },
          { handle: "[i9]" }, // out of range, dropped
          { handle: "[i2]" }, // dup, dropped
        ],
        outfits: [
          { handles: ["[i1]", "[i2]"], reasoning: "nice" },
          { handles: ["[i1]"] }, // <2 pieces, dropped
          { handles: ["[i1]", "[i3]"] }, // [i3] not packed → becomes [i1] only → dropped
        ],
        whatChanged: "slimmed",
      },
      items
    );
    assert.ok(m);
    assert.deepStrictEqual(m.articles.map((a) => a.id), ["a", "b"]);
    assert.strictEqual(m.outfits.length, 1);
    assert.deepStrictEqual(m.outfits[0].itemIds, ["a", "b"]);
    assert.strictEqual(m.whatChanged, "slimmed");
  });
  test("returns null when no articles survive", () => {
    assert.strictEqual(mapUpdateTripPacking({ articles: [{ handle: "a-uuid" }] }, items), null);
    assert.strictEqual(mapUpdateTripPacking({}, items), null);
  });
});
