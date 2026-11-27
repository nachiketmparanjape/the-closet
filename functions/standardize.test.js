const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  STANDARDIZATION_COST_PER_RUN,
  MAX_ATTEMPTS,
  DELTA_E_THRESHOLD,
  EXPENSE_WARNING_THRESHOLD,
  FLUX_PROMPT,
  isAlreadyClean,
  gateGeometry,
} = require('./standardize');

describe('PC-58 standardization constants', () => {
  it('has sane cost and threshold values', () => {
    assert.ok(STANDARDIZATION_COST_PER_RUN > 0 && STANDARDIZATION_COST_PER_RUN < 1);
    assert.equal(MAX_ATTEMPTS, 3);
    assert.equal(DELTA_E_THRESHOLD, 15);
    assert.equal(EXPENSE_WARNING_THRESHOLD, 10);
  });

  it('FLUX prompt includes anti-hallucination directives', () => {
    assert.ok(FLUX_PROMPT.includes('EXACT colors'));
    assert.ok(FLUX_PROMPT.includes('Do not add text, logos, labels'));
    assert.ok(FLUX_PROMPT.includes('white background'));
  });
});

describe('isAlreadyClean (heuristic)', () => {
  it('returns not-clean on unparseable input (conservative)', async () => {
    const result = await isAlreadyClean(Buffer.from('fake'));
    assert.equal(result.isClean, false);
    assert.ok(result.reason);
  });
});

describe('gateGeometry (PC-95)', () => {
  // PC-95: the old gate counted alpha only, so an opaque FLUX render
  // (no alpha channel) read as 100% coverage and always failed
  // "no-background-detected". No item passed the real gates after
  // they went live (Sprint 27). The gate now counts garment pixels
  // as opaque AND not near-white, so it works on the opaque FLUX
  // output and on a transparent cutout alike.
  const burgundy = { r: 128, g: 0, b: 32 };
  async function solidBg(width, height, bg, square) {
    // square: { size, left, top } burgundy block composited on bg, or null.
    let img = sharp({ create: { width, height, channels: 4, background: bg } });
    if (square) {
      const block = await sharp({ create: { width: square.size, height: square.height, channels: 4, background: { ...burgundy, alpha: 1 } } }).png().toBuffer();
      img = img.composite([{ input: block, left: square.left, top: square.top }]);
    }
    return img.png().toBuffer();
  }

  it('passes an opaque FLUX-like render: garment on white (the old gate failed this)', async () => {
    const buf = await solidBg(400, 400, { r: 255, g: 255, b: 255, alpha: 1 }, { size: 200, height: 200, left: 100, top: 100 });
    const res = await gateGeometry(buf);
    assert.equal(res.pass, true, res.reason);
    assert.equal(res.reason, 'geometry-ok');
  });

  it('passes a transparent cutout (garment center, clear border)', async () => {
    const buf = await solidBg(400, 400, { r: 0, g: 0, b: 0, alpha: 0 }, { size: 200, height: 200, left: 100, top: 100 });
    const res = await gateGeometry(buf);
    assert.equal(res.pass, true, res.reason);
  });

  it('fails an all-white image (garment-too-small)', async () => {
    const buf = await solidBg(400, 400, { r: 255, g: 255, b: 255, alpha: 1 }, null);
    const res = await gateGeometry(buf);
    assert.equal(res.pass, false);
    assert.equal(res.reason, 'garment-too-small');
  });

  it('fails a full-bleed garment with no background (no-background-detected)', async () => {
    const buf = await solidBg(400, 400, { r: 128, g: 0, b: 32, alpha: 1 }, null);
    const res = await gateGeometry(buf);
    assert.equal(res.pass, false);
    assert.equal(res.reason, 'no-background-detected');
  });

  it('fails a thin sliver (garment-shape-degenerate)', async () => {
    // 50x400 bar in a 400x400 frame: coverage 12.5% (past the size
    // check), aspect 0.125 (below the 0.15 bound).
    const buf = await solidBg(400, 400, { r: 255, g: 255, b: 255, alpha: 1 }, { size: 50, height: 400, left: 175, top: 0 });
    const res = await gateGeometry(buf);
    assert.equal(res.pass, false);
    assert.equal(res.reason, 'garment-shape-degenerate');
  });
});

describe('dominantColor + color anchor (PC-100)', () => {
  const { buildFluxPrompt, dominantColor } = require('./standardize');
  async function solidSquare(color, bg) {
    const block = await sharp({ create: { width: 200, height: 200, channels: 4, background: { ...color, alpha: 1 } } }).png().toBuffer();
    return sharp({ create: { width: 400, height: 400, channels: 4, background: bg } })
      .composite([{ input: block, left: 100, top: 100 }]).png().toBuffer();
  }

  it('returns the median garment color', async () => {
    const buf = await solidSquare({ r: 128, g: 0, b: 32 }, { r: 255, g: 255, b: 255, alpha: 1 });
    assert.deepEqual(await dominantColor(buf), [128, 0, 32]);
  });

  it('returns null when there are no garment pixels', async () => {
    const buf = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    assert.equal(await dominantColor(buf), null);
  });

  it('buildFluxPrompt anchors the color in emphatic wording when given', () => {
    const prompt = buildFluxPrompt({ name: 'Burgundy sweatshirt', category: 'Tops' }, '', [112, 60, 68]);
    assert.ok(prompt.includes('CRITICAL: The garment\'s main color is RGB(112, 60, 68).'));
    assert.ok(prompt.includes('Match this color EXACTLY'));
    assert.ok(prompt.includes('do not make it redder'));
  });

  it('buildFluxPrompt is unchanged without an anchor', () => {
    const prompt = buildFluxPrompt({ name: 'Burgundy sweatshirt', category: 'Tops' }, '');
    assert.equal(prompt.includes('main color is RGB'), false);
  });
});
