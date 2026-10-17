# Stylist benchmark — baseline (Sprint 6)

**Date:** 2026-10-16/17. **Model:** gemini-3.8-flash (global endpoint), temp 0.3,
thinking budget 1024. **Results file:** `tests/benchmark/results/baseline-sprint6-fixed.json`
(6/6 scenarios completed; an earlier run `baseline-sprint6.json` exposed the
bracketed-handle parser bug, fixed before this run).

## Verdicts (founder-judged checks)

| Scenario | Pick | Result |
|---|---|---|
| color-harmony-business-casual | Navy Oxford + Khaki chinos + Brown loafers | PASS — classic answer, not tee+sneakers |
| pattern-clash | Striped Breton + Black jeans (not plaid) | PASS — explicit pattern reasoning |
| duplicate-names | Black tee (c2) + Grey joggers | PASS — handle disambiguates the two tees |
| weather-mismatch | Linen shirt + Chino shorts at 85°F | PASS — no wool overcoat |
| preference-honoring | Burgundy sweater + Navy trousers | PASS — honored "no green tops" profile |
| incomplete-warm-wardrobe | no outfit, honest gap statement | PASS — no fabricated blazer |

## Observations for future prompt work
- **Scores run hot.** Nearly every dimension scores 8–10, including on the
  honest-gap scenario's siblings. The model's self-scores are generous —
  treat `appConfidence` as uncalibrated (Phase 3 calibration logging exists
  for exactly this; compare against real user ratings before trusting it).
- **Non-determinism at temp 0.3.** duplicate-names picked c1 in run 1, c2 in
  run 2 — both valid, but the same prompt doesn't give the same outfit.
- **Reasoning quality is the real signal.** The two-sentence reasoning
  (anchor + color story) was specific and correct in all 5 outfit scenarios —
  this is what the rubric bought us.
- **Bug found by the benchmark:** the prompt shows handles as `[i1]` but
  `mapHandlesToIds` only accepted `i1` — every bracketed pick was dropped as
  "no valid handles" (production was saved by the repair path / luck).
  Fixed + regression-tested.
