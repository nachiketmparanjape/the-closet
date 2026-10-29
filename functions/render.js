"use strict";

// PC-36 render normalization — the Stage C standard as a
// production module (Stage C itself was a one-off script).
// Every render, from either engine, lands on the same
// canvas so photo distance never decides display size:
// a 1000x1250 transparent canvas, the garment trimmed
// of transparent borders, its longest side filling 92%
// of the frame, centered. The orientation verdict is
// baked in here (rotation in degrees clockwise, as
// sharp takes it); the manual rotate buttons remain
// the override layer on top of the baked file.
//
// Rotation names (the pipeline's vocabulary) map to
// sharp angles: cw90 -> 90, ccw90 -> 270 (sharp turns
// clockwise, so counter-clockwise 90 is 270), flip180
// -> 180. This matches the Stage B calibration.

const { codedError } = require("./errors");
const sharp = require("sharp");

const CANVAS_W = 1000;
const CANVAS_H = 1250;
const FILL = 0.92;

const ROTATION_TO_ANGLE = {
  none: 0,
  cw90: 90,
  ccw90: 270,
  flip180: 180,
};

async function normalizeRender(cutoutBuffer, sharpAngle) {
  let pipeline = sharp(cutoutBuffer);
  if (sharpAngle) pipeline = pipeline.rotate(sharpAngle);
  const trimmed = await pipeline.trim().png().toBuffer();
  const tmd = await sharp(trimmed).metadata();
  if (!tmd.width || !tmd.height) {
    throw codedError(
      "RENDER_FAILED",
      "normalizeRender: cutout is empty after trim"
    );
  }
  // trim() on a fully transparent image does not fail —
  // it returns a degenerate canvas. An empty cutout must
  // fail loudly here (the mask gate would also reject
  // it, but a blank 1000x1250 canvas must never be
  // produced as if it were a render).
  const { data, info } = await sharp(trimmed)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let hasOpaque = false;
  if (info.channels === 4) {
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) {
        hasOpaque = true;
        break;
      }
    }
  } else {
    hasOpaque = true; // no alpha channel: opaque by construction
  }
  if (!hasOpaque) {
    throw codedError(
      "RENDER_FAILED",
      "normalizeRender: cutout has no opaque pixels"
    );
  }
  const scale = Math.min(
    (CANVAS_W * FILL) / tmd.width,
    (CANVAS_H * FILL) / tmd.height
  );
  const w = Math.max(1, Math.round(tmd.width * scale));
  const h = Math.max(1, Math.round(tmd.height * scale));
  const resized = await sharp(trimmed).resize(w, h).png().toBuffer();
  const padX = CANVAS_W - w;
  const padY = CANVAS_H - h;
  const png = await sharp(resized)
    .extend({
      top: Math.floor(padY / 2),
      bottom: padY - Math.floor(padY / 2),
      left: Math.floor(padX / 2),
      right: padX - Math.floor(padX / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return { png, width: CANVAS_W, height: CANVAS_H, garmentW: w, garmentH: h };
}

module.exports = { normalizeRender, CANVAS_W, CANVAS_H, FILL, ROTATION_TO_ANGLE };
