// PC-19: perceptual-hash dedup. Pure functions are extracted from
// public/index.html (multi-line, 6-space closing indent); the canvas
// wrapper computePHash is browser-only and not unit-tested.
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

function extractClientSrc(name, arg) {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "public", "index.html"),
    "utf8"
  );
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  return m[0];
}

function extractClientFn(name, arg) {
  const src = extractClientSrc(name, arg);
  const body = src.replace(/^function \w+\(\w+(, \w+)*\) \{/, "").replace(/\n      \}$/, "");
  return new Function(arg.split(",").map((s) => s.trim()), body);
}

const phashFromGray = extractClientFn("phashFromGray", "g");
const phashDistance = extractClientFn("phashDistance", "a, b");

function uniformGray(v) {
  return new Array(1024).fill(v);
}

describe("phashFromGray", () => {
  test("uniform image hashes to zero (no AC energy)", () => {
    assert.strictEqual(phashFromGray(uniformGray(128)), "0000000000000000");
  });
  test("returns a 16-char hex string", () => {
    const g = uniformGray(128);
    for (let i = 0; i < 512; i++) g[i] = 200; // left half bright
    const h = phashFromGray(g);
    assert.match(h, /^[0-9a-f]{16}$/);
    assert.notStrictEqual(h, "0000000000000000");
  });
  test("deterministic for the same input", () => {
    const g = uniformGray(100);
    for (let i = 0; i < 1024; i += 3) g[i] = 180;
    assert.strictEqual(phashFromGray(g), phashFromGray(g.slice()));
  });
});

describe("phashDistance", () => {
  test("identical hashes have distance 0", () => {
    assert.strictEqual(phashDistance("abcdef0123456789", "abcdef0123456789"), 0);
  });
  test("counts differing bits", () => {
    // ...0001 vs ...0000 -> 1 bit
    assert.strictEqual(phashDistance("0000000000000001", "0000000000000000"), 1);
    // ff vs 00 in the top byte -> 8 bits
    assert.strictEqual(phashDistance("ff00000000000000", "0000000000000000"), 8);
  });
  test("rejects malformed input", () => {
    assert.strictEqual(phashDistance(null, "0000000000000000"), 99);
    assert.strictEqual(phashDistance("xyz", "0000000000000000"), 99);
  });
  test("near-duplicate photo-like images are within threshold", () => {
    function photo(seed) {
      const g = [];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          g.push(128 + 60 * Math.sin(x / 4 + seed) + 40 * Math.cos(y / 6 + seed * 2) + 25 * Math.sin((x + y) / 9));
        }
      }
      return g;
    }
    const p1 = photo(1);
    const p2 = p1.map((v, i) => v + ((i % 7) - 3)); // small noise
    const p3 = photo(2); // a different image
    const dDupe = phashDistance(phashFromGray(p1), phashFromGray(p2));
    const dDiff = phashDistance(phashFromGray(p1), phashFromGray(p3));
    assert.ok(dDupe <= 5, "dupe: expected <= 5, got " + dDupe);
    assert.ok(dDiff > 5, "different: expected > 5, got " + dDiff);
  });
});
