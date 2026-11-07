// PC-36: render normalization — the Stage C standard
// (1000x1250 canvas, 92% fill, centered, transparent).
const { test, describe } = require("node:test");
const assert = require("node:assert");
// sharp lives in functions/node_modules (the deployed
// surface); resolve it as if from a functions module.
const sharp = require("module").createRequire(
  __dirname + "/../functions/render.js"
)("sharp");
const { normalizeRender, CANVAS_W, CANVAS_H } = require("../functions/render");

async function opaqueRect(w, h, canvasW, canvasH) {
  // An opaque red rect of w x h, centered on a transparent canvas.
  const rect = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const left = Math.floor((canvasW - w) / 2);
  const top = Math.floor((canvasH - h) / 2);
  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: rect, left, top }])
    .png()
    .toBuffer();
}

async function alphaBbox(png) {
  const raw = await sharp(png).raw().toBuffer();
  const meta = await sharp(png).metadata();
  let minX = meta.width, minY = meta.height, maxX = -1, maxY = -1;
  for (let y = 0; y < meta.height; y++) {
    for (let x = 0; x < meta.width; x++) {
      const a = raw[(y * meta.width + x) * meta.channels + 3];
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function near(actual, expected, tol) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${actual} within ${tol} of ${expected}`
  );
}

describe("normalizeRender", () => {
  test("wide garment fills 92% of the width, centered", async () => {
    const cut = await opaqueRect(200, 100, 400, 300);
    const { png, width, height, garmentW, garmentH } = await normalizeRender(cut, 0);
    assert.strictEqual(width, CANVAS_W);
    assert.strictEqual(height, CANVAS_H);
    assert.strictEqual(garmentW, 920);
    assert.strictEqual(garmentH, 460);
    const box = await alphaBbox(png);
    near(box.x, 40, 3);
    near(box.y, 395, 3);
    near(box.w, 920, 3);
    near(box.h, 460, 3);
  });
  test("rotation 90 turns a wide garment tall before fitting", async () => {
    const cut = await opaqueRect(200, 100, 400, 300);
    const { garmentW, garmentH, png } = await normalizeRender(cut, 90);
    // 100x200 after the turn; scale min(920/100, 1150/200) = 5.75
    assert.strictEqual(garmentW, 575);
    assert.strictEqual(garmentH, 1150);
    const box = await alphaBbox(png);
    near(box.x, 212, 3);
    near(box.y, 50, 3); // (1250 - 1150) / 2: centered, not flush
  });
  test("empty cutout throws", async () => {
    const empty = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    await assert.rejects(normalizeRender(empty, 0));
  });
});
