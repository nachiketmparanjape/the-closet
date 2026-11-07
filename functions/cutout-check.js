/**
 * PC-60: Unified cutout check.
 *
 * One check, three layers, one verdict shape with named reasons.
 * Design: docs/sprints/sprint-29/PC-60-DESIGN.md
 *
 * Layers:
 *   1. Mask geometry (free) — fringe share, hole count, edge-touch.
 *   2. Vision judge (one Gemini call, ~$0.001) — cut on magenta + white + black.
 *   3. Semantic match (reuses embeddings, $0) — cut vs garment description.
 *
 * Verdict shape:
 *   { pass, reasons[], layers: { mask, vision, semantic }, checkedAt }
 * Reasons come from a fixed list. Scores are not verification.
 *
 * Scale note (2026-11-04): one check for every user, no per-user tuning.
 * Cost is tracked per-user via the ai_usage ledger by the caller.
 */
"use strict";

const sharp = require("sharp");

// Fixed reason list. The model picks from this list; no free text.
const REASONS = [
  "missing-part",
  "extra-object",
  "hole",
  "ragged-edge",
  "wrong-garment",
  "empty",
  "fragmented",
  "aspect-mismatch",
];

const VISION_PROMPT = `You are the quality check for a wardrobe app's photo cleanup.

Image 1 is the ORIGINAL photo of one garment. Images 2, 3, and 4 are an automatic background-removal cutout of that photo, shown on magenta, white, and black backgrounds (three views of the same cut).

Judge ONLY the cutout. Answer with ONLY a JSON object (no markdown, no prose):
{"ok": true or false, "reasons": ["reason-code", ...]}

Reasons must come from this list only: missing-part, extra-object, hole, ragged-edge, wrong-garment, empty, fragmented, aspect-mismatch.

ok = true only if ALL of these hold:
- The cut shows exactly the main garment from image 1 — the whole garment, nothing missing (no cut-off sleeves, legs, straps or edges).
- Nothing else came along: no other objects, no body parts, no furniture, no background remnants.
- No holes inside the garment (no background showing through the middle).
- Clean edges: the outline is smooth, not jagged or fringed, on all three backgrounds.
- The garment's shape, color and details match image 1.

When in doubt, answer ok = false and name the reason. A rejected cut costs nothing — the app keeps the original photo. A bad cut that passes is the real failure.`;

/**
 * Layer 1: mask geometry. Pure pixel math, free.
 * Extends imagenorm.judgeMask with fringe share, hole count, edge-touch.
 *
 * @param {Buffer} pngBuffer - The cutout PNG bytes
 * @param {object} expected - { width, height } of the original photo
 * @param {string} [category] - Item category (e.g. "Accessories"). Sunglasses
 *   and glasses have transparent lenses by design — hole detection is
 *   skipped for them (the vision judge still catches real holes).
 * @param {string} [name] - Item name/subtype. Open footwear (sandals, clogs,
 *   slides, mules) has open areas by design — same exemption.
 * @returns {{pass: boolean, reasons: string[], details: object}}
 */
async function checkMaskGeometry(pngBuffer, expected, category, name) {
  const reasons = [];
  const details = {};
  try {
    const { data, info } = await sharp(pngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
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
    const fgFraction = total ? fg / total : 0;
    const fringeShare = fg ? semi / fg : 0;
    details.fgFraction = Math.round(fgFraction * 1000) / 1000;
    details.fringeShare = Math.round(fringeShare * 1000) / 1000;

    if (fg === 0) {
      reasons.push("empty");
      return { pass: false, reasons, details };
    }

    // Fringe: healthy cut has thin fringe (<5%); failed matte is semi everywhere (>20%).
    if (fringeShare > 0.20) reasons.push("ragged-edge");

    // Hole count: background regions fully enclosed by foreground.
    // Sample on a grid for speed.
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
    // Flood fill from borders to find enclosed background.
    const seen = new Uint8Array(gw * gh);
    const stack = [];
    for (let x = 0; x < gw; x++) {
      if (!grid[x] && !seen[x]) { seen[x] = 1; stack.push(x); }
      const b = (gh - 1) * gw + x;
      if (!grid[b] && !seen[b]) { seen[b] = 1; stack.push(b); }
    }
    for (let y = 0; y < gh; y++) {
      if (!grid[y * gw] && !seen[y * gw]) { seen[y * gw] = 1; stack.push(y * gw); }
      const r = y * gw + gw - 1;
      if (!grid[r] && !seen[r]) { seen[r] = 1; stack.push(r); }
    }
    while (stack.length) {
      const cur = stack.pop();
      const cx = cur % gw;
      const cy = (cur - cx) / gw;
      const neighbors = [];
      if (cx > 0) neighbors.push(cur - 1);
      if (cx < gw - 1) neighbors.push(cur + 1);
      if (cy > 0) neighbors.push(cur - gw);
      if (cy < gh - 1) neighbors.push(cur + gw);
      for (const n of neighbors) {
        if (!grid[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    // Count enclosed background components (holes).
    // Only flag holes larger than 1% of the garment area — small holes are
    // lens transparency (sunglasses), mesh, or sampling noise, not real gaps.
    // (Calibration 2026-11-04: grey aviator sunglasses false-failed on a lens hole.)
    let holes = 0;
    const holeSeen = new Uint8Array(gw * gh);
    let fgCells = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i]) fgCells++;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] || seen[i] || holeSeen[i]) continue;
      // Measure this hole's size.
      let holeSize = 0;
      const hs = [i];
      holeSeen[i] = 1;
      while (hs.length) {
        const cur = hs.pop();
        holeSize++;
        const cx = cur % gw;
        const cy = (cur - cx) / gw;
        const neighbors = [];
        if (cx > 0) neighbors.push(cur - 1);
        if (cx < gw - 1) neighbors.push(cur + 1);
        if (cy > 0) neighbors.push(cur - gw);
        if (cy < gh - 1) neighbors.push(cur + gw);
        for (const n of neighbors) {
          if (!grid[n] && !seen[n] && !holeSeen[n]) { holeSeen[n] = 1; hs.push(n); }
        }
      }
      if (fgCells > 0 && holeSize / fgCells > 0.01) holes++;
    }
    details.holes = holes;
    // Sunglasses/glasses have transparent lenses by design; open footwear
    // (sandals, clogs, slides, mules) has open areas by design. A "hole"
    // in these is not a defect. Skip hole detection for them; the vision
    // judge (layer 2) still catches real holes in these items.
    // (Calibration 2026-11-04: aviator sunglasses + clog sandals false-failed.)
    const isAccessory = /accessor|sunglass|glasses|eyewear/i.test(category || "");
    const isOpenFootwear = /sandal|clog|slide|mule|croc/i.test(name || "");
    if (holes > 0 && !isAccessory && !isOpenFootwear) reasons.push("hole");

    // Aspect mismatch: cut shape must match original photo shape.
    if (expected && expected.width > 0 && expected.height > 0) {
      const want = expected.width / expected.height;
      const got = width / height;
      if (Math.abs(got - want) / want > 0.02) reasons.push("aspect-mismatch");
    }

    // Edge-touch: garment touching the border on 2+ sides suggests cropping.
    let touches = 0;
    let topTouch = false, bottomTouch = false, leftTouch = false, rightTouch = false;
    for (let x = 0; x < width; x++) {
      if (data[(0 * width + x) * channels + 3] > 128) topTouch = true;
      if (data[((height - 1) * width + x) * channels + 3] > 128) bottomTouch = true;
    }
    for (let y = 0; y < height; y++) {
      if (data[(y * width + 0) * channels + 3] > 128) leftTouch = true;
      if (data[(y * width + width - 1) * channels + 3] > 128) rightTouch = true;
    }
    touches = [topTouch, bottomTouch, leftTouch, rightTouch].filter(Boolean).length;
    details.borderTouches = touches;
    if (touches >= 2) reasons.push("missing-part"); // likely cropped by frame

    return { pass: reasons.length === 0, reasons, details };
  } catch (e) {
    return { pass: false, reasons: ["empty"], details: { error: e.message } };
  }
}

/**
 * Layer 2: vision judge. One Gemini call with the cut on 3 backgrounds.
 *
 * @param {Buffer} originalBuffer - Original photo bytes
 * @param {Buffer} cutoutBuffer - Cutout PNG bytes
 * @param {Function} callModel - (parts) => Promise<text>
 * @returns {{pass: boolean, reasons: string[], checkError: boolean}}
 */
async function checkVision(originalBuffer, cutoutBuffer, callModel) {
  try {
    // Composite the cutout on magenta, white, black.
    const backgrounds = ["#FF00FF", "#FFFFFF", "#000000"];
    const views = [];
    for (const bg of backgrounds) {
      const composited = await sharp({
        create: { width: 512, height: 512, channels: 3, background: bg },
      })
        .composite([{ input: cutoutBuffer, gravity: "center" }])
        .jpeg()
        .toBuffer();
      views.push(composited);
    }
    const parts = [
      { inlineData: { mimeType: "image/jpeg", data: originalBuffer.toString("base64") } },
      ...views.map((v) => ({ inlineData: { mimeType: "image/jpeg", data: v.toString("base64") } })),
      { text: VISION_PROMPT },
    ];
    const text = await callModel(parts);
    const parsed = parseVisionVerdict(text);
    return parsed;
  } catch (e) {
    // Model failure fails safe: reject with checkError.
    return { pass: false, reasons: [], checkError: true };
  }
}

/**
 * Parse the vision judge's verdict. Strict: anything that is not an
 * explicit ok:true with valid reasons is a rejection.
 */
function parseVisionVerdict(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { pass: false, reasons: [], checkError: true };
  }
  let parsed;
  try {
    parsed = JSON.parse(text.trim());
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch (e2) { /* fall through */ }
    }
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.ok !== "boolean") {
    return { pass: false, reasons: [], checkError: true };
  }
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.filter((r) => REASONS.includes(r))
    : [];
  return { pass: parsed.ok === true, reasons, checkError: false };
}

/**
 * Run the full unified check.
 *
 * @param {object} opts
 * @param {Buffer} opts.originalBuffer - Original photo bytes
 * @param {Buffer} opts.cutoutBuffer - Cutout PNG bytes
 * @param {object} opts.expected - { width, height } of the original
 * @param {Function} [opts.callModel] - Vision judge model call (omit to skip layer 2)
 * @param {number} [opts.semanticSimilarity] - Cosine similarity vs description (omit to skip layer 3)
 * @param {string} [opts.category] - Item category (for the accessory hole exemption)
 * @param {string} [opts.name] - Item name (for the open-footwear hole exemption)
 * @returns {{pass: boolean, reasons: string[], layers: object, checkedAt: string}}
 */
async function runCutoutCheck({ originalBuffer, cutoutBuffer, expected, callModel, semanticSimilarity, category, name }) {
  const mask = await checkMaskGeometry(cutoutBuffer, expected, category, name);
  let vision = { pass: true, reasons: [], checkError: false, skipped: true };
  if (typeof callModel === "function") {
    vision = await checkVision(originalBuffer, cutoutBuffer, callModel);
  }
  let semantic = { pass: true, reasons: [], skipped: true };
  if (typeof semanticSimilarity === "number") {
    if (semanticSimilarity < 0.70) {
      semantic = { pass: false, reasons: ["wrong-garment"], skipped: false };
    } else if (semanticSimilarity < 0.80) {
      // Between 0.70-0.80: vision judge decides (embedding is a signal, not a verdict).
      semantic = { pass: vision.pass, reasons: vision.pass ? [] : ["wrong-garment"], skipped: false, deferred: true };
    } else {
      semantic = { pass: true, reasons: [], skipped: false };
    }
  }

  const allReasons = [...new Set([...mask.reasons, ...vision.reasons, ...semantic.reasons])];
  const pass = mask.pass && vision.pass && semantic.pass;
  return {
    pass,
    reasons: allReasons,
    layers: { mask, vision, semantic },
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  runCutoutCheck,
  checkMaskGeometry,
  checkVision,
  parseVisionVerdict,
  REASONS,
};
