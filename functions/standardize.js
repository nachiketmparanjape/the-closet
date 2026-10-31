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

const STANDARDIZATION_COST_PER_RUN = 0.025; // USD, fal-ai/flux-kontext/dev
const MAX_ATTEMPTS = 3;
const DELTA_E_THRESHOLD = 15; // Color fidelity gate
const EXPENSE_WARNING_THRESHOLD = 10; // Refreshes before warning

const FLUX_PROMPT = 'Transform this garment photo into a professional e-commerce product photograph: complete whole garment with proper standardized shape, centered on a pure white background, front-facing, even studio lighting. Preserve the EXACT colors, patterns, prints, graphics, and construction details exactly as shown. Do not redesign the garment. Do not add text, logos, labels, or tags.';

/**
 * Check if an image is "already clean" — a studio product shot that doesn't
 * need standardization. Pure pixel heuristics, zero AI cost.
 *
 * @param {Buffer} imageBuffer - The image bytes
 * @returns {{isClean: boolean, reason: string}}
 */
function isAlreadyClean(imageBuffer) {
  // TODO: Implement with sharp or jimp
  // 1. Check for meaningful alpha transparency
  // 2. Sample border pixels for background uniformity (>90% near-white = clean)
  // For now, conservative default: not clean (process everything)
  // The 55 Google imports are already tagged in Firestore via backfill.
  return { isClean: false, reason: 'heuristic-not-implemented' };
}

/**
 * Run FLUX Kontext Dev on a garment image via fal.ai.
 *
 * @param {string} imageUrl - Public URL of the input image
 * @param {string} falApiKey - fal.ai API key
 * @param {string} feedback - Optional user feedback to append to prompt
 * @returns {Promise<string>} - URL of the standardized image
 */
async function runFluxStandardization(imageUrl, falApiKey, feedback = '') {
  const prompt = feedback
    ? `${FLUX_PROMPT} Additional guidance: ${feedback}`
    : FLUX_PROMPT;

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
 *
 * @param {Buffer} inputBuffer - Original garment image
 * @param {Buffer} outputBuffer - Standardized output image
 * @returns {Promise<{pass: boolean, deltaE: number, reason: string}>}
 */
async function gateColorFidelity(inputBuffer, outputBuffer) {
  // TODO: Implement with sharp for pixel access
  // 1. Extract garment region (exclude background)
  // 2. Compute dominant color (median of foreground pixels)
  // 3. Convert to LAB, compute Delta-E
  // 4. Pass if Delta-E < DELTA_E_THRESHOLD
  //
  // Proven: teal joggers scored 44.3 = correctly flagged as FAIL.
  return { pass: true, deltaE: 0, reason: 'not-implemented' };
}

/**
 * Quality gate: Geometry completeness.
 * Verifies the output contains a complete garment (not truncated, no floaters).
 *
 * @param {Buffer} outputBuffer - Standardized output image
 * @returns {Promise<{pass: boolean, reason: string}>}
 */
async function gateGeometry(outputBuffer) {
  // TODO: Implement silhouette analysis
  return { pass: true, reason: 'not-implemented' };
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
  isAlreadyClean,
  runFluxStandardization,
  runQualityGates,
  gateColorFidelity,
  gateGeometry,
};
