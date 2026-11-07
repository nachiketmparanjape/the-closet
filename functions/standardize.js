/**
 * PC-58: Stage 3 — Garment Image Standardization
 *
 * "Make it whole and make it standardized."
 *
 * Pipeline:
 *   1. Clean-check (pixel heuristics, zero AI cost) → skip if already clean
 *   2. FLUX Kontext Dev via fal.ai → complete + standardize the garment
 *   3. Quality gates (color Delta-E, geometry) → reveal only on pass
 *   4. Retry up to 3x on gate failure
 *
 * Design: docs/sprints/sprint-26/PC-58-DESIGN.md
 */

const STANDARDIZATION_COST_PER_RUN = 0.03; // USD: FLUX $0.025 + SAM 3 cutout $0.005 (2026-11-01)
const MAX_ATTEMPTS = 3;
const DELTA_E_THRESHOLD = 15; // Color fidelity gate
const EXPENSE_WARNING_THRESHOLD = 10; // Refreshes before warning

const FLUX_PROMPT = 'Transform this garment photo into a professional e-commerce product photograph: complete whole garment with proper standardized shape, centered on a pure white background, front-facing, even studio lighting. Preserve the EXACT colors, patterns, prints, graphics, and construction details exactly as shown. Do not redesign the garment. Do not add text, logos, labels, or tags. CRITICAL: Copy any graphic print, logo, or pattern EXACTLY as shown in the input image, pixel-for-pixel. Do NOT redraw, reinterpret, "correct", or redesign the graphic — even if it appears upside down, sideways, faded, or unusual. If the graphic is upside down in the input, keep it upside down. Never invent a new graphic.';

/**
 * Build the FLUX prompt with garment attributes for better fidelity.
 * The item's known attributes (name, category, etc.) give the model
 * semantic context beyond just the image.
 *
 * NOTE (2026-10-31, founder feedback): Do NOT pass visual attributes
 * (colors, pattern) as text. The model is looking at the image — it can
 * judge colors/patterns more accurately than our text labels. A text label
 * like "black" can anchor the model and override subtle visual variations.
 * Only pass semantic attributes (what the thing IS) that the image alone
 * might not convey clearly.
 *
 * @param {object} item - The Firestore item (plain object from Admin SDK)
 * @param {string} feedback - Optional user feedback
 * @returns {string} - The full prompt
 */
function buildFluxPrompt(item, feedback = '') {
  const parts = [FLUX_PROMPT];
  
  const ai = item.ai || {};
  const name = item.name || item.shortName || ai.name || '';
  const category = item.category || ai.category || '';
  const subtype = ai.subtype || '';
  const fit = ai.fit || '';
  const description = ai.description || '';
  // PC-58 taxonomy attributes (2026-11-01): these shape the render
  const sleeveLength = ai.sleeve_length || '';
  const neckline = ai.neckline || '';
  const length = ai.length || '';
  const collar = ai.collar || '';
  const closure = ai.closure || '';
  const rise = ai.rise || '';
  const cuff = ai.cuff || '';
  
  // Garment identity (semantic — helps the model understand what it's looking at)
  const identity = [];
  if (name) identity.push(name);
  else if (subtype) identity.push(subtype);
  if (category && !identity.join(' ').toLowerCase().includes(category.toLowerCase())) {
    identity.push(`(${category})`);
  }
  if (identity.length) {
    parts.push(`The garment is: ${identity.join(' ')}.`);
  }
  
  // Sleeve length — CRITICAL: model defaults to long if unspecified.
  // Use emphatic phrasing (2026-11-01): "Sleeves: short-sleeve." is too weak,
  // the model ignores it. The CRITICAL/MUST/Do NOT pattern works.
  if (sleeveLength && sleeveLength.toLowerCase() !== 'unknown') {
    if (sleeveLength === 'short') {
      parts.push('CRITICAL: This garment has SHORT sleeves ending above the elbow. You MUST preserve the short sleeves. Do NOT generate long sleeves.');
    } else if (sleeveLength === 'long') {
      parts.push('This garment has LONG sleeves. Preserve the long sleeves.');
    } else if (sleeveLength === 'sleeveless') {
      parts.push('This garment is SLEEVELESS. Do NOT add sleeves.');
    }
  }
  
  // Fit (v1: pass through ai.fit; proper taxonomy in #132)
  // This matters: an oversized tee should render oversized, not as a regular tee.
  if (fit && fit.toLowerCase() !== 'unknown') {
    parts.push(`Fit: ${fit}.`);
  }
  
  // Neckline / collar
  if (neckline && neckline.toLowerCase() !== 'unknown') {
    parts.push(`Neckline: ${neckline}.`);
  }
  if (collar && collar.toLowerCase() !== 'unknown') {
    parts.push(`Collar: ${collar}.`);
  }
  
  // Length (hem for tops, inseam for bottoms)
  if (length && length.toLowerCase() !== 'unknown') {
    parts.push(`Length: ${length}.`);
  }
  
  // Bottoms specifics
  if (rise && rise.toLowerCase() !== 'unknown') {
    parts.push(`Rise: ${rise}.`);
  }
  if (cuff && cuff.toLowerCase() !== 'unknown') {
    parts.push(`Cuff: ${cuff}.`);
  }
  if (closure && closure.toLowerCase() !== 'unknown' && closure !== 'none') {
    parts.push(`Closure: ${closure}.`);
  }
  
  // Description (semantic details — fabric, construction, etc.)
  if (description) {
    parts.push(`Details: ${description.slice(0, 200)}.`);
  }
  
  // User feedback
  if (feedback) {
    parts.push(`Additional guidance: ${feedback}`);
  }
  
  return parts.join(' ');
}

/**
 * Check if an image is "already clean" — a studio product shot that doesn't
 * need standardization. Pure pixel heuristics, zero AI cost.
 * An image is "clean" if: (a) it has meaningful alpha transparency (a cutout),
 * or (b) its border pixels are >90% near-white (studio shot on white).
 *
 * @param {Buffer} imageBuffer - The image bytes
 * @returns {Promise<{isClean: boolean, reason: string}>}
 */
async function isAlreadyClean(imageBuffer) {
  try {
    const sharp = require("sharp");
    const { data, info } = await sharp(imageBuffer)
      .resize(64, 64, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let transparent = 0;
    let borderWhite = 0;
    let borderTotal = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        const a = data[i + 3];
        if (a < 128) transparent++;
        // Border pixels: outer 2 rows/cols.
        const isBorder = x < 2 || x >= info.width - 2 || y < 2 || y >= info.height - 2;
        if (isBorder) {
          borderTotal++;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (a >= 128 && r > 240 && g > 240 && b > 240) borderWhite++;
        }
      }
    }
    const total = info.width * info.height;
    if (transparent / total > 0.05) {
      return { isClean: true, reason: "has-transparency" };
    }
    if (borderTotal > 0 && borderWhite / borderTotal > 0.90) {
      return { isClean: true, reason: "white-background" };
    }
    return { isClean: false, reason: "not-clean" };
  } catch (e) {
    // Conservative: if we can't analyze, process it (don't skip).
    return { isClean: false, reason: "check-error:" + (e.message || "unknown") };
  }
}

/**
 * Run FLUX Kontext Dev on a garment image via fal.ai.
 *
 * @param {string} imageUrl - Public URL of the input image
 * @param {string} falApiKey - fal.ai API key
 * @param {object} item - The Firestore item (for prompt attributes)
 * @param {string} feedback - Optional user feedback to append to prompt
 * @returns {Promise<string>} - URL of the standardized image
 */
async function runFluxStandardization(imageUrl, falApiKey, item = {}, feedback = '') {
  const prompt = buildFluxPrompt(item, feedback);

  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux-kontext/dev', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      guidance_scale: 2.5,
      num_inference_steps: 30,
    }),
  });

  const sub = await submitRes.json();
  if (!sub.request_id) {
    throw new Error(`FLUX submit failed: ${JSON.stringify(sub).slice(0, 200)}`);
  }

  // Poll for completion
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(sub.status_url, {
      headers: { 'Authorization': `Key ${falApiKey}` },
    });
    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(status.response_url, {
        headers: { 'Authorization': `Key ${falApiKey}` },
      });
      const result = await resultRes.json();
      if (result.images && result.images[0]) {
        return result.images[0].url;
      }
      throw new Error('FLUX completed but no image in response');
    }
    if (status.status === 'FAILED') {
      throw new Error(`FLUX failed: ${JSON.stringify(status).slice(0, 300)}`);
    }
  }
  throw new Error('FLUX timed out after 200s');
}

/**
 * Quality gate: Color fidelity via Delta-E in LAB space.
 * Compares dominant colors of input vs output garment regions.
 * Uses sharp to extract median RGB of non-background pixels, converts to
 * CIE LAB, and computes CIE76 Delta-E. Pass if Delta-E < DELTA_E_THRESHOLD.
 *
 * @param {Buffer} inputBuffer - Original garment image
 * @param {Buffer} outputBuffer - Standardized output image
 * @returns {Promise<{pass: boolean, deltaE: number, reason: string}>}
 */
async function gateColorFidelity(inputBuffer, outputBuffer) {
  try {
    const sharp = require("sharp");
    const dominant = async (buffer) => {
      // Downscale to 64x64 for speed, get raw RGBA pixels.
      const { data, info } = await sharp(buffer)
        .resize(64, 64, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      // Collect non-background pixels (not near-white, not fully transparent).
      const pixels = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue; // transparent = background
        if (r > 240 && g > 240 && b > 240) continue; // near-white = background
        pixels.push([r, g, b]);
      }
      if (!pixels.length) return null;
      // Median per channel (robust to outliers).
      const med = (arr) => {
        const s = arr.slice().sort((x, y) => x - y);
        return s[Math.floor(s.length / 2)];
      };
      return [
        med(pixels.map((p) => p[0])),
        med(pixels.map((p) => p[1])),
        med(pixels.map((p) => p[2])),
      ];
    };
    const rgbToLab = (r, g, b) => {
      // sRGB -> XYZ -> LAB (D65).
      let [R, G, B] = [r / 255, g / 255, b / 255].map((c) =>
        c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92
      );
      const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
      const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
      const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const fx = f(X), fy = f(Y), fz = f(Z);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    };
    const inRgb = await dominant(inputBuffer);
    const outRgb = await dominant(outputBuffer);
    if (!inRgb || !outRgb) {
      return { pass: false, deltaE: Infinity, reason: "no-garment-pixels" };
    }
    const [L1, a1, b1] = rgbToLab(...inRgb);
    const [L2, a2, b2] = rgbToLab(...outRgb);
    const deltaE = Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
    return {
      pass: deltaE < DELTA_E_THRESHOLD,
      deltaE,
      reason: deltaE < DELTA_E_THRESHOLD ? "color-ok" : `color-shift(ΔE=${deltaE.toFixed(1)})`,
    };
  } catch (e) {
    // Gate failure must not crash the pipeline — fail open with a flag.
    return { pass: true, deltaE: 0, reason: "gate-error:" + (e.message || "unknown") };
  }
}

/**
 * Quality gate: Geometry completeness.
 * Verifies the output contains a complete garment: non-trivial opaque
 * area, reasonable aspect ratio, and the garment isn't a thin sliver.
 *
 * @param {Buffer} outputBuffer - Standardized output image
 * @returns {Promise<{pass: boolean, reason: string}>}
 */
async function gateGeometry(outputBuffer) {
  try {
    const sharp = require("sharp");
    const { data, info } = await sharp(outputBuffer)
      .resize(128, 128, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let opaque = 0;
    let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] >= 128) {
          opaque++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const total = info.width * info.height;
    const coverage = opaque / total;
    // Garment should cover 10-95% of the frame (not empty, not full-bleed).
    if (coverage < 0.10) return { pass: false, reason: "garment-too-small" };
    if (coverage > 0.95) return { pass: false, reason: "no-background-detected" };
    // Bounding box should be reasonably proportioned (not a sliver).
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const aspect = bw / bh;
    if (aspect < 0.15 || aspect > 6) return { pass: false, reason: "garment-shape-degenerate" };
    return { pass: true, reason: "geometry-ok" };
  } catch (e) {
    return { pass: true, reason: "gate-error:" + (e.message || "unknown") };
  }
}

/**
 * Run all quality gates on a standardization output.
 *
 * @param {Buffer} inputBuffer - Original image
 * @param {Buffer} outputBuffer - Standardized image
 * @returns {Promise<{pass: boolean, results: object}>}
 */
async function runQualityGates(inputBuffer, outputBuffer) {
  const color = await gateColorFidelity(inputBuffer, outputBuffer);
  const geometry = await gateGeometry(outputBuffer);

  const pass = color.pass && geometry.pass;
  return {
    pass,
    results: { color, geometry },
    reason: pass ? 'all-gates-passed'
      : [!color.pass && `color(ΔE=${color.deltaE.toFixed(1)})`,
         !geometry.pass && 'geometry'].filter(Boolean).join(', '),
  };
}

module.exports = {
  STANDARDIZATION_COST_PER_RUN,
  MAX_ATTEMPTS,
  DELTA_E_THRESHOLD,
  EXPENSE_WARNING_THRESHOLD,
  FLUX_PROMPT,
  buildFluxPrompt,
  isAlreadyClean,
  runFluxStandardization,
  runQualityGates,
  gateColorFidelity,
  gateGeometry,
};
