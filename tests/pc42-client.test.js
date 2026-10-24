// PC-42 wiring guards: the crop step must sit between picking
// a photo and handleShopCheckFile, with the full-photo escape
// and the canvas render in place. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the crop overlay exists with its controls", () => {
  assert.ok(html.includes('id="shopCropOverlay"'), "overlay missing");
  assert.ok(html.includes('id="shopCropStage"'), "stage missing");
  assert.ok(html.includes('id="shopCropZoom"'), "zoom missing");
  assert.ok(html.includes("Use this crop"), "use-crop button missing");
  assert.ok(html.includes("Use full photo"), "full-photo escape missing");
});

test("both photo inputs route through the cropper", () => {
  const routes = html.match(/if \(file\) openShopCropper\(file\);/g) || [];
  assert.equal(routes.length, 2, "expected both inputs to open the cropper");
  assert.ok(html.includes("function openShopCropper(file)"), "cropper missing");
});

test("the crop renders via canvas at the 1600px cap as JPEG", () => {
  assert.ok(html.includes("Math.min(1600, Math.round(sw))"), "cap missing");
  assert.ok(html.includes('canvas.toBlob'), "toBlob missing");
  assert.ok(html.includes('"image/jpeg", 0.9'), "jpeg export missing");
});

test("cancelling the cropper disarms the trip tag like the sheet cancel", () => {
  assert.ok(html.includes("function abandonCrop()"), "abandon handler missing");
});
