// Committed unit tests for the canonical color palette + brand key
// (PC-8 follow-up). Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));

const server = require("../functions/palette.js");

describe("canonicalName", () => {
  it("passes palette names through", () => {
    assert.equal(server.canonicalName("navy"), "navy");
    assert.equal(server.canonicalName("  Light Grey "), "light grey");
  });
  it("maps aliases", () => {
    assert.equal(server.canonicalName("Midnight Blue"), "navy");
    assert.equal(server.canonicalName("hot pink"), "pink");
    assert.equal(server.canonicalName("espresso"), "brown");
  });
  it("returns null for unknown names", () => {
    assert.equal(server.canonicalName("blorp"), null);
    assert.equal(server.canonicalName(""), null);
    assert.equal(server.canonicalName(null), null);
  });
});

describe("hexToOklch", () => {
  it("matches reference values", () => {
    const white = server.hexToOklch("#ffffff");
    assert.ok(Math.abs(white.L - 1) < 0.001);
    assert.ok(white.C < 0.001);
    const black = server.hexToOklch("#000000");
    assert.ok(black.L < 0.001);
    const red = server.hexToOklch("#ff0000");
    assert.ok(Math.abs(red.L - 0.628) < 0.01);
    assert.ok(Math.abs(red.C - 0.258) < 0.01);
    assert.ok(Math.abs(red.H - 29) < 2);
  });
  it("returns null for garbage", () => {
    assert.equal(server.hexToOklch("nope"), null);
    assert.equal(server.hexToOklch(null), null);
  });
});

describe("nearestFamily (OKLCH distance)", () => {
  it("finds the nearest anchor", () => {
    assert.equal(server.nearestFamily("#1c1c1e"), "black");
    assert.equal(server.nearestFamily("#e07b39"), "orange");
    assert.equal(server.nearestFamily("#f4f4f2"), "white");
    assert.equal(server.nearestFamily("#22304f"), "navy");
  });
  it("returns null for garbage", () => {
    assert.equal(server.nearestFamily("nope"), null);
    assert.equal(server.nearestFamily(null), null);
  });
});

describe("brandKey", () => {
  it("normalizes casing and whitespace for grouping", () => {
    assert.equal(server.brandKey("UNIQLO"), "uniqlo");
    assert.equal(server.brandKey("  Nike   SB "), "nike sb");
  });
  it("returns null for empty/missing", () => {
    assert.equal(server.brandKey(null), null);
    assert.equal(server.brandKey(""), null);
    assert.equal(server.brandKey("   "), null);
  });
  it("never touches display casing semantics (H&M stays intact as a key)", () => {
    assert.equal(server.brandKey("H&M"), "h&m");
  });
});

describe("palette sync (server <-> client)", () => {
  it("public/js/palette.js PALETTE matches functions/palette.js", () => {
    const clientSrc = fs.readFileSync(
      path.join(__dirname, "..", "public", "js", "palette.js"), "utf8"
    );
    // The client file wraps the same declarations; extract the PALETTE array.
    const m = clientSrc.match(/const PALETTE = (\[[\s\S]*?\]);/);
    assert.ok(m, "PALETTE array not found in client file");
    const clientPalette = eval(m[1]);
    assert.deepEqual(clientPalette, server.PALETTE);
    // And the alias maps match too.
    const a = clientSrc.match(/const COLOR_ALIASES = (\{[\s\S]*?\});/);
    assert.ok(a, "COLOR_ALIASES not found in client file");
    assert.deepEqual(eval("(" + a[1] + ")"), server.COLOR_ALIASES);
  });

  it("client exposes the same helpers as the server", () => {
    const clientSrc = fs.readFileSync(
      path.join(__dirname, "..", "public", "js", "palette.js"), "utf8"
    );
    for (const fn of ["canonicalName", "nearestFamily", "hexToOklch", "oklchDistance", "brandKey"]) {
      assert.ok(new RegExp("function " + fn + "\\(").test(clientSrc), fn + " missing from client");
      assert.ok(clientSrc.includes(fn + ": " + fn), fn + " not exported on window.Palette");
    }
  });
});
