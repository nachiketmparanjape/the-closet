// Committed unit tests for PC-11 (server error catalog).
// Run from hosting/: node --test tests/
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
// The server modules live under functions/ with their own node_modules.
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { CATALOG, fail, codedError, newCorrelationId } = require("../functions/errors.js");
const { HttpsError } = require("firebase-functions/v2/https");

describe("error catalog", () => {
  it("every entry has a category, grpc code, and client-safe message", () => {
    for (const [key, entry] of Object.entries(CATALOG)) {
      assert.ok(entry.category, key);
      assert.ok(["auth", "validation", "dependency", "internal"].includes(entry.category), key);
      assert.ok(typeof entry.grpc === "string" && entry.grpc, key);
      assert.ok(typeof entry.message === "string" && entry.message.length > 0, key);
      // client-safe: no internals, no stack traces, no placeholders
      assert.ok(!/stack|undefined|null|TODO|FIXME/i.test(entry.message), key + ": " + entry.message);
    }
  });

  it("covers the four categories", () => {
    const cats = new Set(Object.values(CATALOG).map((e) => e.category));
    assert.deepEqual([...cats].sort(), ["auth", "dependency", "internal", "validation"]);
  });
});

describe("fail()", () => {
  it("throws HttpsError with the catalog code and message", () => {
    assert.throws(() => fail("NOT_SIGNED_IN"), (e) => {
      return e instanceof HttpsError &&
        e.code === "unauthenticated" &&
        e.message === CATALOG.NOT_SIGNED_IN.message;
    });
  });

  it("fails closed to INTERNAL on an unknown key", () => {
    assert.throws(() => fail("NO_SUCH_KEY"), (e) => {
      return e instanceof HttpsError &&
        e.code === "internal" &&
        e.message === CATALOG.INTERNAL.message;
    });
  });
});

describe("codedError()", () => {
  it("carries the catalog key with an internal-only detail", () => {
    const err = codedError("AI_UNAVAILABLE", "vertex 503 at 12:01");
    assert.equal(err.key, "AI_UNAVAILABLE");
    assert.equal(err.message, "vertex 503 at 12:01");
    assert.ok(err instanceof Error);
  });

  it("unknown keys become INTERNAL", () => {
    assert.equal(codedError("NOPE").key, "INTERNAL");
  });
});

describe("newCorrelationId()", () => {
  it("returns unique, formatted ids", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    assert.match(a, /^req_[0-9a-f]{16}$/);
    assert.notEqual(a, b);
  });
});
