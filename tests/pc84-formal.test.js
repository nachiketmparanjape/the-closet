// PC-84 guards: "More formal" revises the card's outfit instead of
// returning a fresh one. Sprint 33 root cause: the server's ITERATION
// section named the direction examples "warmer/cooler/dressier/…" —
// "more formal" (the exact words the More formal chip sends) did not
// map onto any of them, so the model read the request as a fresh
// formal pick and even described the base outfit as containing pieces
// it did not have ("rugged flannel"). Sprint 33 fix: the direction
// list names "more formal" explicitly, a direction change must keep
// MOST of the previous pick, and the reply may only describe the base
// from its listed handles. ROUND 2 STILL FAILED: 0 of 4 pieces kept.
// The deployed prompt WAS live (deploy-update.js uploads source) —
// the rule left "must change" to the model's judgment, and for a
// casual→formal jump it judged every slot must change. Sprint 34
// fix: the floor is countable (AT LEAST HALF, with the count named)
// AND enforced server-side — a short outfit triggers one repair
// naming the kept count; a repair that still misses the floor leaves
// the best valid outfit standing instead of going text-only.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const {
  assembleContext, sanitizeItems, sanitizeMessages, sanitizePins,
  iterationKeepProblem,
} = require("../functions/stylist.js");

const ITEMS = sanitizeItems([
  { id: "a", name: "Olive field jacket", category: "Outerwear" },
  { id: "b", name: "White tee", category: "Tops" },
  { id: "c", name: "Dark jeans", category: "Bottoms" },
]);
const MSGS = sanitizeMessages([{ role: "user", text: "Make this outfit more formal" }]);

function systemText(input) {
  const out = assembleContext(Object.assign({
    items: ITEMS, messages: MSGS, styleProfile: [],
    references: { articles: [], outfits: [] }, weatherContext: null,
    vibe: null, vibeProfile: null, tripContext: null,
    pins: sanitizePins([]), today: "2026-11-23", todayPick: null,
  }, input));
  assert.ok(out.config && out.config.systemInstruction, "no system instruction");
  return out.config.systemInstruction;
}

describe("PC-84: formal revision", () => {
  const sys = systemText({ previousPick: { itemIds: ["a", "b", "c"] } });

  it("names the previous pick as the iteration base", () => {
    assert.ok(sys.includes("ITERATION"), "iteration section missing");
    assert.ok(sys.includes("Olive field jacket"), "base handles missing");
  });

  it("names 'more formal' as a direction change", () => {
    assert.ok(sys.includes("more formal/dressier"), "formal direction missing from iteration rules");
  });

  it("a direction change keeps most of the base", () => {
    assert.ok(sys.includes("keeps AT LEAST HALF of the previous pick's pieces"), "countable keep floor missing");
    assert.ok(sys.includes("with 4 pieces, at least 2 stay"), "floor count example missing");
  });

  it("the reply may only describe the base from its handles", () => {
    assert.ok(sys.includes("never name a piece it does not contain"), "don't-invent rule missing");
  });

  it("without a previous pick there is no iteration section", () => {
    const bare = systemText({ previousPick: null });
    assert.ok(!bare.includes("ITERATION — the user is refining"), "iteration leaks without a base");
  });
});

describe("PC-84: the keep floor is counted, not judged", () => {
  const BASE = ["a", "b", "c", "d"]; // the Round 2 Estate Minimalist set, 4 pieces

  it("0 of 4 kept is a problem naming the counts", () => {
    const p = iterationKeepProblem(["x", "y"], BASE, "Make this outfit more formal");
    assert.ok(p, "0 kept must fail the floor");
    assert.ok(p.includes("0 of 4"), "problem must name the kept count");
    assert.ok(p.includes("at least 2"), "problem must name the floor");
  });

  it("2 of 4 kept passes; 3 of 4 passes", () => {
    assert.equal(iterationKeepProblem(["a", "b", "x", "y"], BASE, "Make this outfit more formal"), null);
    assert.equal(iterationKeepProblem(["a", "b", "c", "x"], BASE, "Make this outfit more formal"), null);
  });

  it("1 of 4 kept fails — the Round 2 shape, one slot over the line", () => {
    assert.ok(iterationKeepProblem(["a", "x", "y", "z"], BASE, "Make this outfit warmer"));
  });

  it("an explicit fresh pick is exempt even at 0 kept", () => {
    assert.equal(iterationKeepProblem(["x", "y"], BASE, "Give me another option"), null);
    assert.equal(iterationKeepProblem(["x", "y"], BASE, "Try again"), null);
  });

  it("no floor without a real base or a mapped outfit", () => {
    assert.equal(iterationKeepProblem(["x", "y"], ["a"], "Make this outfit more formal"), null);
    assert.equal(iterationKeepProblem([], BASE, "Make this outfit more formal"), null);
    assert.equal(iterationKeepProblem(null, BASE, "Make this outfit more formal"), null);
  });
});
