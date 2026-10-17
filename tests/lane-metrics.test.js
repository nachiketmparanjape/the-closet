// Unit tests for the lane-metrics pure computation (Sprint 8).
// Fixtures mirror the real Firestore shapes (decoded); the fetch/auth
// layer in scripts/lane-metrics.js is intentionally untested here.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  computeMetrics, tagAcceptance, colorAcceptance, wearThrough,
  ratingCompletion, calibrationGap, suggestionAcceptance,
} = require("../scripts/lane-metrics.js");

const items = [
  { _id: "i1", ai: { category: "Tops", brand: "Nike", subtype: "tee", pattern: "solid", fit: "regular", formality: "casual", fabric_guess: "cotton", colors: ["black", "white"] },
    category: "Tops", brand: "Nike", subtype: "tee", pattern: "solid", fit: "slim", formality: "casual", fabricGuess: "cotton",
    colors: [{ name: "black", source: "ai" }, { name: "white", source: "ai" }] },
  { _id: "i2", ai: { category: "Bottoms", brand: "Uniqlo", colors: ["blue"] },
    category: "Pants", brand: "Uniqlo", colors: [{ name: "blue", source: "ai" }] },
  { _id: "i3", category: "Shoes" }, // no ai blob: skipped
  { _id: "i3", category: "Shoes" }, // no ai blob: skipped
];

describe("tagAcceptance", () => {
  it("compares ai suggestions to final fields, skipping unsuggested fields", () => {
    const r = tagAcceptance(items);
    // i1: 6/7 accept (fit differs); i2: 1/2 accept (category differs)
    assert.equal(r.n, 9);
    assert.ok(Math.abs(r.rate - 7 / 9) < 1e-9);
    assert.ok(Math.abs(r.fields.category - 0.5) < 1e-9);
    assert.equal(r.fields.brand, 1);
  });
  it("returns null rate with no ai data", () => {
    assert.equal(tagAcceptance([{ _id: "x" }]).rate, null);
  });
  it("skips vintage items that never had the field written", () => {
    const r = tagAcceptance([{ _id: "i4", ai: { category: "Tops", brand: "Gap" }, category: "Tops" }]);
    assert.equal(r.n, 1); // only category scored
    assert.equal(r.rate, 1);
    assert.equal(r.fields.brand, undefined);
  });
});

describe("colorAcceptance", () => {
  it("counts ai-suggested colors still present", () => {
    const r = colorAcceptance(items);
    assert.equal(r.n, 3);
    assert.equal(r.rate, 1);
  });
});

describe("wearThrough", () => {
  const outfits = [
    { _id: "o1", versionGroup: "o1" },
    { _id: "o2", versionGroup: "o2" },
  ];
  it("counts version groups with any worn version", () => {
    const r = wearThrough(outfits, [{ _id: "w1", outfitId: "o1" }]);
    assert.equal(r.rate, 0.5);
    assert.equal(r.worn, 1);
  });
  it("is null with no outfits", () => {
    assert.equal(wearThrough([], []).rate, null);
  });
});

describe("ratingCompletion", () => {
  it("counts wears with a user rating", () => {
    const r = ratingCompletion(
      [{ _id: "w1" }, { _id: "w2" }],
      [{ rater: "user", wearEventId: "w1", score: 8 }]
    );
    assert.equal(r.rate, 0.5);
  });
  it("is null with no wears", () => {
    assert.equal(ratingCompletion([], []).rate, null);
  });
});

describe("calibrationGap", () => {
  it("averages |confidence - mean user score| over rated outfits", () => {
    const r = calibrationGap(
      [{ _id: "o1", appConfidence: 9 }, { _id: "o2", appConfidence: 6 }],
      [
        { rater: "user", targetKind: "outfit", targetId: "o1", score: 7 },
        { rater: "user", targetKind: "outfit", targetId: "o1", score: 5 },
      ]
    );
    assert.equal(r.n, 1);
    assert.ok(Math.abs(r.gap - 3) < 1e-9); // |9 - 6|
  });
});

describe("suggestionAcceptance", () => {
  it("matches app suggestions against the style profile", () => {
    const r = suggestionAcceptance(
      [{ rater: "app", suggestedPreference: "likes monochrome" }],
      { preferences: [{ text: "likes monochrome", source: "app" }] }
    );
    assert.equal(r.rate, 1);
  });
  it("is null with no suggestions", () => {
    assert.equal(suggestionAcceptance([], null).rate, null);
  });
});

describe("computeMetrics", () => {
  it("returns all five lanes", () => {
    const m = computeMetrics({ items, outfits: [], wears: [], ratings: [], styleProfile: null });
    for (const lane of ["catalogue", "outfits", "loop", "stylist", "personalization"]) {
      assert.ok(m[lane], lane);
    }
  });
});
