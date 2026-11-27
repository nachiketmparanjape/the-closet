// PC-106: the standardize sweeper heals items whose direct call never
// sent. Pure-logic tests: which items qualify, and the per-user cap.
// The live run (REST scan + in-process pipeline) is verified by
// --dry-run and by a live test item, not here. Run from hosting/:
// node --test functions/standardize-sweeper.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { needsStandardization, pickBatch, GRACE_MS, PER_USER_CAP } = require("../scripts/standardize-sweeper");

const NOW = Date.parse("2026-11-27T05:00:00Z");
const OLD = new Date(NOW - 60 * 60 * 1000).toISOString(); // 1h old
const FRESH = new Date(NOW - 2 * 60 * 1000).toISOString(); // 2m old

function item(overrides) {
  return Object.assign({ photos: [{ url: "https://example.com/x.jpg" }], createdAt: OLD }, overrides);
}

describe("needsStandardization", function () {
  it("an old item with no status and a photo qualifies", function () {
    assert.equal(needsStandardization(item({}), NOW), true);
  });

  it("a fresh item is left alone — its direct call may still be in flight", function () {
    assert.equal(needsStandardization(item({ createdAt: FRESH }), NOW), false);
  });

  it("the grace boundary is 10 minutes", function () {
    assert.equal(GRACE_MS, 10 * 60 * 1000);
    const justInside = new Date(NOW - GRACE_MS + 1000).toISOString();
    const justOutside = new Date(NOW - GRACE_MS - 1000).toISOString();
    assert.equal(needsStandardization(item({ createdAt: justInside }), NOW), false);
    assert.equal(needsStandardization(item({ createdAt: justOutside }), NOW), true);
  });

  it("any existing status disqualifies — even failed (the founder retries those by hand)", function () {
    for (const status of ["processing", "failed", "ready", "already_clean", "pending_review", "rejected"]) {
      assert.equal(needsStandardization(item({ standardization: { status } }), NOW), false, status);
    }
  });

  it("an item with no photos does not qualify", function () {
    assert.equal(needsStandardization(item({ photos: [] }), NOW), false);
    assert.equal(needsStandardization(item({ photos: null }), NOW), false);
  });

  it("an item with no createdAt is treated as old", function () {
    const noCreated = item({});
    delete noCreated.createdAt;
    assert.equal(needsStandardization(noCreated, NOW), true);
  });
});

describe("pickBatch", function () {
  it("caps each user at 5, preserving scan order", function () {
    assert.equal(PER_USER_CAP, 5);
    const candidates = [];
    for (let i = 0; i < 7; i++) candidates.push({ uid: "u1", itemId: "a" + i });
    for (let i = 0; i < 3; i++) candidates.push({ uid: "u2", itemId: "b" + i });
    const picked = pickBatch(candidates);
    assert.deepEqual(picked.map((c) => c.itemId), ["a0", "a1", "a2", "a3", "a4", "b0", "b1", "b2"]);
  });

  it("passes a small batch through untouched", function () {
    const candidates = [{ uid: "u1", itemId: "x" }];
    assert.deepEqual(pickBatch(candidates), candidates);
  });
});
