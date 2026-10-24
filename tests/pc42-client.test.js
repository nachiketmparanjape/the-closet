// Shop-check photo step (PC-42, rebuilt 2026-10-24): the full photo
// is the default selection; a Crop button offers a selection box
// that can be dragged to any part of the image and resized from
// its corners. Guards + the pure box math, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractClientFn(name, arg) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + arg + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(arg, body);
}

test("the photo step exists: full photo default, Crop offered, selection box", () => {
  assert.ok(html.includes('id="shopCropOverlay"'), "overlay missing");
  assert.ok(html.includes('id="shopCropStage"'), "stage missing");
  assert.ok(html.includes('id="shopCropBox"'), "selection box missing");
  assert.ok(html.includes('id="shopCropBtn"'), "crop button missing");
  assert.ok(html.includes("Use full photo"), "full-photo default missing");
  assert.ok(html.includes("Use this crop"), "use-crop button missing");
  assert.ok(!html.includes('id="shopCropZoom"'), "the zoom slider is retired");
});

test("both photo inputs route through the photo step", () => {
  const routes = html.match(/if \(file\) openShopCropper\(file\);/g) || [];
  assert.equal(routes.length, 2, "expected both inputs to open the photo step");
  assert.ok(html.includes("function openShopCropper(file)"), "photo step missing");
});

test("the crop renders via canvas at the 1600px cap as JPEG", () => {
  assert.ok(html.includes("1600 / Math.max(r.sw, r.sh)"), "longest-side cap missing");
  assert.ok(html.includes("canvas.toBlob"), "toBlob missing");
  assert.ok(html.includes('"image/jpeg", 0.9'), "jpeg export missing");
});

test("cancelling the photo step disarms the trip tag like the sheet cancel", () => {
  assert.ok(html.includes("function abandonCrop()"), "abandon handler missing");
});

const clampCropBox = extractClientFn("clampCropBox", "b");
const cropRectPixels = extractClientFn("cropRectPixels", "b, iw, ih");
const fitContainRect = extractClientFn("fitContainRect", "cw, ch, iw, ih");

test("fitContainRect letterboxes any aspect whole and centered", () => {
  // Ridiculous tall screenshot in a phone frame: whole, narrow, centered.
  const tall = fitContainRect(340, 340, 400, 4000);
  assert.equal(tall.h, 340);
  assert.equal(tall.w, 34);
  assert.equal(tall.x, 153);
  // Panorama: full width, short, centered vertically.
  const wide = fitContainRect(340, 340, 4000, 400);
  assert.equal(wide.w, 340);
  assert.equal(wide.h, 34);
  assert.equal(wide.y, 153);
  // Ordinary portrait photo fills by width.
  const norm = fitContainRect(340, 425, 800, 1000);
  assert.deepEqual(norm, { x: 0, y: 0, w: 340, h: 425 });
});

test("the stage frame is forced: half the screen, at most 1.25x wide-tall", () => {
  assert.ok(html.includes("window.innerHeight * 0.5"), "screen-half cap missing");
  assert.ok(html.includes("w * 1.25"), "frame aspect clamp missing");
});

test("clampCropBox keeps the box inside the image with a minimum size", () => {
  assert.deepEqual(clampCropBox({ x: 0, y: 0, w: 1, h: 1 }), { x: 0, y: 0, w: 1, h: 1 });
  const c = clampCropBox({ x: 0.95, y: -0.2, w: 0.5, h: 0.001 });
  assert.equal(c.x, 0.5);
  assert.equal(c.y, 0);
  assert.equal(c.h, 0.08);
});

test("cropRectPixels maps fractions to natural pixels, clamped to the frame", () => {
  assert.deepEqual(cropRectPixels({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, 2000, 1000),
    { sx: 200, sy: 200, sw: 1000, sh: 250 });
  const r = cropRectPixels({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 1000, 1000);
  assert.equal(r.sx + r.sw, 1000);
  assert.equal(r.sy + r.sh, 1000);
});
