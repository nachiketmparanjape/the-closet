// Regression test for the 2026-10-15 storage.rules delete bug.
//
// The bug: a single `allow write` covered create/update/delete, and the
// `request.resource.size` / `request.resource.contentType` checks fail
// closed on delete (request.resource is absent) — denying every deletion.
// The fix splits `allow delete` (owner-only) from `allow create, update`
// (owner-only + image validations).
//
// A full behavioral test needs the Storage emulator (requires Java, not
// available on this VM). This test guards the structure so the two can't
// be silently recombined.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const rules = fs.readFileSync(
  path.join(__dirname, "..", "storage.rules"), "utf8"
);

describe("storage.rules", () => {
  it("has a standalone allow delete without request.resource checks", () => {
    const m = rules.match(/allow delete: if ([^;]+);/);
    assert.ok(m, "no standalone `allow delete` rule found");
    assert.ok(!/request\.resource/.test(m[1]),
      "delete rule must not reference request.resource (absent on delete)");
    assert.ok(/request\.auth\.uid == userId/.test(m[1]),
      "delete rule must stay owner-only");
  });

  it("keeps image validation on create/update", () => {
    const m = rules.match(/allow create, update: if ([^;]+);/);
    assert.ok(m, "no `allow create, update` rule found");
    assert.ok(/request\.resource\.size/.test(m[1]), "size check missing");
    assert.ok(/request\.resource\.contentType/.test(m[1]), "contentType check missing");
  });

  it("does not use a combined `allow write` with resource checks", () => {
    const m = rules.match(/allow write: if ([^;]+);/);
    if (m) {
      assert.ok(!/request\.resource/.test(m[1]),
        "`allow write` must not carry request.resource checks (breaks delete)");
    }
  });
});
