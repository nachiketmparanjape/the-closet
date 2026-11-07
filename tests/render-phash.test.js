// PC-36: server render hash — must be the SAME hash
// space as PC-19's client hash (same DCT algorithm),
// so the <= 5 threshold keeps its meaning.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
// sharp lives in functions/node_modules (the deployed
// surface); resolve it as if from a functions module.
const sharp = require("module").createRequire(
  __dirname + "/../functions/phash.js"
)("sharp");
const { phashFromGray, phashDistance, renderHash } = require("../functions/phash");

function extractClientFn(name) {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "public", "index.html"),
    "utf8"
  );
  const m = html.match(
    new RegExp("function " + name + "\\(g\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(/^function \w+\(\w+\) \{/, "")
    .replace(/\n      \}$/, "");
  return new Function("g", body);
}

describe("phashFromGray port", () => {
  test("matches the client function on random inputs", () => {
    const client = extractClientFn("phashFromGray");
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let t = 0; t < 5; t++) {
      const g = new Array(1024);
      for (let i = 0; i < 1024; i++) g[i] = Math.floor(rnd() * 256);
      assert.strictEqual(phashFromGray(g), client(g));
    }
  });
});

describe("renderHash", () => {
  async function solidRender(r, g, b) {
    return sharp({
      create: { width: 200, height: 200, channels: 4, background: { r, g, b, alpha: 1 } },
    })
      .png()
      .toBuffer();
  }
  test("uniform white hashes to zero", async () => {
    assert.strictEqual(await renderHash(await solidRender(255, 255, 255)), "0000000000000000");
  });
  test("deterministic, and different renders differ", async () => {
    // Uniform images hash to zero by design (no AC
    // energy), so the "different" case must differ in
    // structure: left half black vs uniform white.
    const blackHalf = await sharp({
      create: { width: 100, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const leftHalf = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: blackHalf, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const white = await solidRender(255, 255, 255);
    const ha1 = await renderHash(leftHalf);
    const ha2 = await renderHash(leftHalf);
    const hb = await renderHash(white);
    assert.strictEqual(ha1, ha2);
    assert.strictEqual(phashDistance(ha1, ha1), 0);
    assert.notStrictEqual(ha1, "0000000000000000");
    assert.notStrictEqual(ha1, hb);
  });
  test("distance is symmetric and counts bits", () => {
    assert.strictEqual(phashDistance("ff00000000000000", "0000000000000000"), 8);
    assert.strictEqual(
      phashDistance("0000000000000000", "ff00000000000000"),
      phashDistance("ff00000000000000", "0000000000000000")
    );
    assert.strictEqual(phashDistance("bad", "0000000000000000"), 99);
  });
});
