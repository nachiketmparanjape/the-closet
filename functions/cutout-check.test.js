// PC-60: unified cutout check — unit tests.
const { test } = require("node:test");
const assert = require("node:assert");
const sharp = require("sharp");
const {
  parseVisionVerdict,
  checkMaskGeometry,
  REASONS,
} = require("./cutout-check");

// Helper: make a solid-color PNG with an optional transparent hole.
async function makePng(width, height, draw) {
  const { data } = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).raw().toBuffer({ resolveWithObject: true });
  if (draw) draw(data, width, height);
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("parseVisionVerdict: explicit ok:true passes", () => {
  const r = parseVisionVerdict('{"ok": true, "reasons": []}');
  assert.equal(r.pass, true);
  assert.deepEqual(r.reasons, []);
});

test("parseVisionVerdict: ok:false with valid reasons", () => {
  const r = parseVisionVerdict('{"ok": false, "reasons": ["missing-part", "hole"]}');
  assert.equal(r.pass, false);
  assert.deepEqual(r.reasons, ["missing-part", "hole"]);
});

test("parseVisionVerdict: filters reasons not in the fixed list", () => {
  const r = parseVisionVerdict('{"ok": false, "reasons": ["missing-part", "looks weird"]}');
  assert.deepEqual(r.reasons, ["missing-part"]);
});

test("parseVisionVerdict: empty/unparseable fails safe", () => {
  assert.equal(parseVisionVerdict("").pass, false);
  assert.equal(parseVisionVerdict("not json").pass, false);
  assert.equal(parseVisionVerdict('{"ok": "maybe"}').pass, false);
});

test("checkMaskGeometry: solid garment passes", async () => {
  const png = await makePng(100, 100, (data, w, h) => {
    for (let y = 20; y < 80; y++) {
      for (let x = 20; x < 80; x++) {
        const i = (y * w + x) * 4;
        data[i] = 200; data[i + 1] = 50; data[i + 2] = 50; data[i + 3] = 255;
      }
    }
  });
  const r = await checkMaskGeometry(png, { width: 100, height: 100 });
  assert.equal(r.pass, true);
  assert.deepEqual(r.reasons, []);
});

test("checkMaskGeometry: empty image fails with empty", async () => {
  const png = await makePng(100, 100, null);
  const r = await checkMaskGeometry(png, { width: 100, height: 100 });
  assert.equal(r.pass, false);
  assert.ok(r.reasons.includes("empty"));
});

test("checkMaskGeometry: large hole fails (garment)", async () => {
  const png = await makePng(100, 100, (data, w, h) => {
    for (let y = 10; y < 90; y++) {
      for (let x = 10; x < 90; x++) {
        const i = (y * w + x) * 4;
        data[i] = 200; data[i + 1] = 50; data[i + 2] = 50; data[i + 3] = 255;
      }
    }
    // Punch a 20x20 hole in the middle (6% of the 80x80 garment).
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 60; x++) {
        const i = (y * w + x) * 4;
        data[i + 3] = 0;
      }
    }
  });
  const r = await checkMaskGeometry(png, { width: 100, height: 100 }, "Tops", "Red tee");
  assert.equal(r.pass, false);
  assert.ok(r.reasons.includes("hole"));
});

test("checkMaskGeometry: hole exempt for sunglasses (lens by design)", async () => {
  const png = await makePng(100, 100, (data, w, h) => {
    for (let y = 10; y < 90; y++) {
      for (let x = 10; x < 90; x++) {
        const i = (y * w + x) * 4;
        data[i] = 50; data[i + 1] = 50; data[i + 2] = 50; data[i + 3] = 255;
      }
    }
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 60; x++) {
        const i = (y * w + x) * 4;
        data[i + 3] = 0;
      }
    }
  });
  const r = await checkMaskGeometry(png, { width: 100, height: 100 }, "Accessories", "Grey aviator sunglasses");
  assert.equal(r.pass, true);
  assert.ok(!r.reasons.includes("hole"));
});

test("checkMaskGeometry: hole exempt for open footwear (clog by design)", async () => {
  const png = await makePng(100, 100, (data, w, h) => {
    for (let y = 10; y < 90; y++) {
      for (let x = 10; x < 90; x++) {
        const i = (y * w + x) * 4;
        data[i] = 50; data[i + 1] = 100; data[i + 2] = 200; data[i + 3] = 255;
      }
    }
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 60; x++) {
        const i = (y * w + x) * 4;
        data[i + 3] = 0;
      }
    }
  });
  const r = await checkMaskGeometry(png, { width: 100, height: 100 }, "Shoes", "Blue gradient clog sandals");
  assert.equal(r.pass, true);
  assert.ok(!r.reasons.includes("hole"));
});

test("REASONS is the fixed list", () => {
  assert.deepEqual(REASONS, [
    "missing-part", "extra-object", "hole", "ragged-edge",
    "wrong-garment", "empty", "fragmented", "aspect-mismatch",
  ]);
});
