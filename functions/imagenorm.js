"use strict";

// PC-34 image plumbing: orientation normalization + cutout mask
// statistics. Kept apart from the provider seam (birefnet.js) and
// the orchestration (extract.js) because these are pure image facts
// that outlive any provider.
//
// Why orientation is handled HERE, once: phone photos store pixels
// in sensor orientation and carry an EXIF tag saying how to rotate
// for display. Browsers honor the tag, so originals look upright in
// the app — but a provider's PNG output has no tag, so raw sideways
// pixels in means a sideways render forever. Normalizing the pixels
// (and dropping the tag) before the provider call makes every
// downstream artifact — model input, stored render, gate check —
// live in true display orientation. The founder's original file in
// Storage is never modified; this runs on the in-memory copy.

const sharp = require("sharp");

const MIME_BY_FORMAT = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Returns { buffer, mimeType, width, height } with the EXIF
// orientation baked into the pixels and the tag stripped.
// sharp().rotate() with no angle does exactly this (auto-orient
// from EXIF), for all 8 orientation values including the mirrored
// ones (2, 4, 5, 7).
async function normalizeOrientation(buffer) {
  const out = await sharp(buffer)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: out.data,
    mimeType: MIME_BY_FORMAT[out.info.format] || "image/jpeg",
    width: out.info.width,
    height: out.info.height,
  };
}

// Alpha statistics for a cutout PNG. Components are counted on a
// strided sample grid (<= 200px on the long side) — plenty to tell
// "one garment" from "confetti", and cheap at full photo sizes.
// semi counts partially-transparent FOREGROUND pixels: a healthy
// cutout has a thin semi fringe at its edges; a failed matte is
// semi almost everywhere.
async function alphaStats(pngBuffer) {
  const img = sharp(pngBuffer).ensureAlpha();
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels; // 4 after ensureAlpha
  const total = width * height;

  let fg = 0;
  let semi = 0;
  for (let i = 3; i < data.length; i += channels) {
    const a = data[i];
    if (a > 10) {
      fg++;
      if (a < 245) semi++;
    }
  }

  // Component labeling on the sampled grid.
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200));
  const gw = Math.ceil(width / step);
  const gh = Math.ceil(height / step);
  const grid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px = Math.min(width - 1, gx * step);
      const py = Math.min(height - 1, gy * step);
      const a = data[(py * width + px) * channels + 3];
      grid[gy * gw + gx] = a > 128 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(gw * gh);
  let components = 0;
  let largest = 0;
  const stack = [];
  for (let start = 0; start < grid.length; start++) {
    if (!grid[start] || seen[start]) continue;
    components++;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const cur = stack.pop();
      size++;
      const cx = cur % gw;
      const cy = (cur - cx) / gw;
      if (cx > 0 && grid[cur - 1] && !seen[cur - 1]) { seen[cur - 1] = 1; stack.push(cur - 1); }
      if (cx < gw - 1 && grid[cur + 1] && !seen[cur + 1]) { seen[cur + 1] = 1; stack.push(cur + 1); }
      if (cy > 0 && grid[cur - gw] && !seen[cur - gw]) { seen[cur - gw] = 1; stack.push(cur - gw); }
      if (cy < gh - 1 && grid[cur + gw] && !seen[cur + gw]) { seen[cur + gw] = 1; stack.push(cur + gw); }
    }
    if (size > largest) largest = size;
  }
  let sampledFg = 0;
  for (let i = 0; i < grid.length; i++) sampledFg += grid[i];

  return {
    width: meta.width || width,
    height: meta.height || height,
    fgFraction: total ? fg / total : 0,
    semiShareOfFg: fg ? semi / fg : 0,
    components,
    largestShareOfFg: sampledFg ? largest / sampledFg : 0,
  };
}

// The catastrophe floor for a cutout — deliberately loose, because
// the vision check (extractcheck.js) is the semantic gate. These
// bounds only catch empty outputs, background-grabs, fragmentation
// and total matte failure, plus the orientation assertion: the
// render's aspect must match the normalized original's, so a
// rotated output can never slip through silently.
// Returns { pass, reasons[] }.
function judgeMask(stats, expected) {
  const reasons = [];
  if (expected && expected.width > 0 && expected.height > 0) {
    const want = expected.width / expected.height;
    const got = stats.width / stats.height;
    if (Math.abs(got - want) / want > 0.02) {
      reasons.push(
        "aspect_mismatch: render " + stats.width + "x" + stats.height +
        " vs original " + expected.width + "x" + expected.height
      );
    }
  }
  if (!(stats.fgFraction >= 0.02 && stats.fgFraction <= 0.98)) {
    reasons.push("fg_fraction_out_of_range: " + stats.fgFraction.toFixed(3));
  }
  if (stats.largestShareOfFg < 0.85) {
    reasons.push("fragmented: largest component is " + stats.largestShareOfFg.toFixed(2) + " of foreground");
  }
  if (stats.semiShareOfFg > 0.7) {
    reasons.push("matte_mush: semi-transparent share of foreground " + stats.semiShareOfFg.toFixed(2));
  }
  return { pass: reasons.length === 0, reasons };
}

module.exports = { normalizeOrientation, alphaStats, judgeMask };
