// Committed unit tests for PC-11 (client friendlyError choke point).
// Run from hosting/: node --test tests/
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

require("../public/js/friendly-error.js");
const friendlyError = globalThis.friendlyError;

describe("friendlyError", () => {
  it("maps auth codes", () => {
    assert.equal(friendlyError({ code: "unauthenticated" }), "Please sign in to continue.");
    assert.equal(friendlyError({ code: "permission-denied" }), "You don't have access to that. Try signing in again.");
  });

  it("maps validation and retryable codes", () => {
    assert.equal(friendlyError({ code: "invalid-argument" }), "Something in that request wasn't right. Check and try again.");
    assert.equal(friendlyError({ code: "resource-exhausted" }), "We're being rate-limited right now. Wait a minute and try again.");
    assert.equal(friendlyError({ code: "unavailable" }), "Couldn't reach the server. Check your connection and try again.");
    assert.equal(friendlyError({ code: "deadline-exceeded" }), "That took too long. Try again.");
  });

  it("maps internal codes to the generic message", () => {
    assert.equal(friendlyError({ code: "internal" }), "Something went wrong on our end. Try again.");
  });

  it("maps Firebase Storage codes", () => {
    assert.equal(friendlyError({ code: "storage/unauthorized" }), "Please sign in to continue.");
    assert.equal(friendlyError({ code: "storage/retry-limit-exceeded" }), "Couldn't reach the server. Check your connection and try again.");
  });

  it("classifies raw network failures without leaking them", () => {
    const out = friendlyError({ message: "Failed to fetch" });
    assert.equal(out, "Couldn't reach the server. Check your connection and try again.");
    assert.ok(!/failed to fetch/i.test(out), "raw text must not leak through");
  });

  it("falls back to the generic message for unknown shapes", () => {
    assert.equal(friendlyError({ code: "weird-code" }), "Something went wrong. Try again.");
    assert.equal(friendlyError({}), "Something went wrong. Try again.");
    assert.equal(friendlyError(null), "Something went wrong. Try again.");
    assert.equal(friendlyError(undefined), "Something went wrong. Try again.");
  });

  it("never returns an empty or raw message", () => {
    for (const err of [{ code: "x" }, { message: "INTERNAL: something broke" }, null]) {
      const out = friendlyError(err);
      assert.ok(typeof out === "string" && out.length > 0);
      assert.ok(!/INTERNAL/.test(out));
    }
  });

  describe("auth codes (AUTH-1)", () => {
    it("maps popup and linking failures to human copy", () => {
      assert.equal(friendlyError({ code: "auth/popup-closed-by-user" }), "That was closed before finishing. Try again.");
      assert.equal(friendlyError({ code: "auth/popup-blocked" }), "Your browser blocked the sign-in window. Allow popups and try again.");
      assert.equal(friendlyError({ code: "auth/credential-already-in-use" }), "That account is already connected elsewhere.");
      assert.equal(friendlyError({ code: "auth/invalid-email" }), "That email address doesn't look right. Check and try again.");
    });
  });

  describe("offline", () => {
    const realNavigator = globalThis.navigator;
    const realDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    beforeEach(() => {
      // Node ships a non-writable global navigator; override it properly.
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false }, configurable: true, writable: true,
      });
    });
    afterEach(() => {
      if (realDescriptor) Object.defineProperty(globalThis, "navigator", realDescriptor);
      else delete globalThis.navigator;
    });
    it("reports offline when the browser says so", () => {
      assert.equal(friendlyError({ code: "mystery" }), "You're offline. Reconnect and try again.");
    });
  });
});
