const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  STANDARDIZATION_COST_PER_RUN,
  MAX_ATTEMPTS,
  DELTA_E_THRESHOLD,
  EXPENSE_WARNING_THRESHOLD,
  FLUX_PROMPT,
  isAlreadyClean,
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

describe('isAlreadyClean (placeholder)', () => {
  it('returns conservative default until heuristics are implemented', () => {
    const result = isAlreadyClean(Buffer.from('fake'));
    assert.equal(result.isClean, false);
    assert.ok(result.reason);
  });
});
