# Sprint 5 plan — Stylist quality + model migration

**Status:** proposed 2026-10-15, awaiting founder approval.
**Inputs:** Claude's stylist.js review (6 points) + ChatGPT's full-repo review (7 sections).
Both reviews were assessed against the code and (for the retirement claim)
against Google's docs. Verdicts below; disagreements noted explicitly.

## Why this sprint exists

The Closet has the right architecture (garment pipeline, canonical palette,
conversational stylist, outfit/rating/reflection loop). The gap is **decision
quality**: the stylist reasons from general LLM knowledge with no formal
fashion framework, no way to measure whether a prompt change helped, and its
model retires **October 20, 2026** (verified on Google's lifecycle page,
2026-10-15 — this overrides ChatGPT's "don't switch models" advice, which
was written from a static review without the retirement date).

## Phase 0 — keep the app alive (this week, urgent)

### A. AI platform
- **A1 — Model migration: `gemini-2.5-flash` → `gemini-3.8-flash`** (all three
  functions: describeItem, askStylist, reflectOutfit). Google's first-listed
  replacement; our volume makes price irrelevant. Verify SDK accepts the new
  ID; watch for the reported breaking param changes (thinking-budget naming,
  sampling params). Live smoke test of all three functions before sign-off —
  a green deploy is not proof the new model ID works.
- **A2 — Thinking budget + output cap.** Explicit thinking budget (≈1024),
  raise `maxOutputTokens` 800 → ≈2500 (budget + answer). Log `finishReason`
  and thoughts-token count on parse failure. (Claude #2 — agreed.)
- **A3 — Temperature 0.7 → 0.3** for the stylist call. Same outfit should
  score the same run to run. (Claude #3 — agreed, single call, no split.)

### F. Correctness
- **F1 — Storage rules deny photo deletion (VERIFIED real).** `allow write`
  covers create/update/delete; on delete `request.resource` is null so the
  size/contentType checks fail closed. Split delete from create/update
  validation; add a regression test. (ChatGPT §6 — agreed, verified in
  `storage.rules` 2026-10-15.)

## Phase 1 — stylist engine, measured (the core of the sprint)

### E. Evaluation (build FIRST — measure, then change)
- **E1 — Outfit-quality benchmark.** Fixed scenario set: wardrobe snapshots +
  occasion/weather/request, run the stylist, judge against the rubric
  (§B1). Founder-judged initially. Every prompt change below is A/B'd
  against this suite before shipping. (ChatGPT §6 — agreed; prerequisite
  for all quality work.)

### B. Stylist engine (`functions/stylist.js`)
- **B1 — Versioned styling rubric**, stored separately from UI code, injected
  into system instructions. Color section: palette relationship
  (tonal/analogous/complementary/neutral/contrast), lightness balance,
  saturation intent, temperature, dominant-vs-accent clarity, pattern
  interaction. Plus formality, proportion, occasion. **Guide, not rigid
  rules** — intentional clash is allowed; the model must explain the actual
  decision, not recite "harmonious". (ChatGPT §2 — agreed.)
- **B2 — Handles, not names.** Prompt-local refs (`i1`, `i2`…) per wardrobe
  line; model returns handles; server validates against submitted inventory.
  Fixes duplicate-name blindness (two "Black tee" — today only the first can
  ever be picked) and letter-perfect copying fragility. (Claude #4 + ChatGPT
  §6 — agreed.)
- **B3 — Slot validation + repair.** Server enforces what the prompt asks:
  one top (or dress), one bottom, ≤1 item per slot. Shoes only when the
  request implies footwear — never forced into "what top with these jeans".
  One repair call naming what's missing; text-only fallback as today.
  (Claude #5 — agreed with the shoes scoping.)
- **B4 — Sub-scores + reasoning-first output.** Model writes reasoning, then
  scores color/formality/weather/proportion/occasion 0–10 with anchored
  meanings. `confidence` computed **in code** (mean of sub-scores) so it can
  be reweighted against ratings without touching the prompt. Store `scores`
  next to `appConfidence`. (Claude #3 — agreed.)
- **B5 — Color-rich wardrobe lines.** `itemLine` passes family + primary +
  lightness cues from the canonical palette ("navy (primary), cream") instead
  of bare lowercase names. Builds directly on the palette work shipped
  2026-10-15. (Claude #6 — agreed.)
- **B6 — Perceptual color math in code.** Replace RGB-distance
  `nearestFamily()` with OKLCH-based distance. Division of labor: code
  measures, model judges, user corrects. (ChatGPT §2 — agreed.)

## Phase 2 — garment understanding (`describe.js`, `palette.js`)

- **C1 — View-aware vision prompt.** State the visible view explicitly; never
  assume the unseen side. (Known real failure: back print described as front
  print, sprint-02 notes.) Cheap, do first. (ChatGPT §4 — agreed.)
- **C2 — Subtype field.** "Blue shirt" is not one thing (oversized graphic
  tee vs Oxford button-down). Highest-value schema addition. AI prefills;
  unknown stays unknown. (ChatGPT §4 — agreed, top priority.)
- **C3 — Style tags.** Controlled vocab (classic, minimalist, preppy,
  streetwear…), alongside formality. (ChatGPT §4 — agreed.)
- **C4 — Color record hardening.** Every color gets a hex: sampled for the
  primary, **palette-anchor hex** otherwise (kills the nulls AND the
  sampled-vs-named contradiction — an anchor hex is definitionally consistent
  with its family name). Role (dominant/accent) later. (ChatGPT §3 — agreed
  with this cheaper construction.)
- **Deferred:** texture/proportion details, multi-photo analysis, image
  segmentation. Honest note: we are not solving computer-vision color
  extraction in one sprint.

## Phase 3 — learning loop (`reflectOutfit`, style profile)

- **D1 — History-aware reflection.** `reflectOutfit` reads recent rating
  history, not just the current rating. Classify feedback: **explicit**
  ("I dislike…") → record immediately with consent; **repeated pattern**
  (multiple ratings/notes) → propose a durable preference; **one-off**
  reaction → revise the current recommendation only. (ChatGPT §5 — agreed.)
- **D2 — Evidence with suggestions.** Show the basis ("based on 3 ratings
  where…"). Keep the existing user-confirmation gate. (ChatGPT §5 — agreed.)
- **D3 — Confidence calibration.** Treat the model's 0–10 as an uncalibrated
  self-report. Log predicted confidence vs actual ratings; reweight later.
  (ChatGPT §5 + Claude #3 — agreed.)

## Ongoing

- **G1 — Docs drift.** README + PRODUCT.md still describe shipped features
  (descriptions, stylist, palette editing, feedback loop) as upcoming. Sync
  with the code. (ChatGPT §6 — agreed, cheap.)

## Review verdicts on ChatGPT's commentary

| # | Point | Verdict |
|---|-------|---------|
| 1 | Keep existing architecture | Agree — no action |
| 2 | Formal color-theory rubric + OKLCH | Agree — B1, B6 |
| 3 | Color record: swatch/label mismatch | Agree — C4 (anchor-hex construction) |
| 4 | Coarse garment schema | Agree — C1–C3 now, rest deferred |
| 5 | Learning loop ahead of logic | Agree — D1–D3 |
| 6 | Handles / eval suite / docs drift / storage rules | Agree on all four — B2, E1, G1, F1 (verified) |
| 7 | "Don't switch models yet" | **Overridden** — written without the retirement date; migration is mandatory by Oct 20 |

## Review verdicts on Claude's stylist.js feedback

| # | Point | Verdict |
|---|-------|---------|
| 1 | Model retirement | **Confirmed** via Google's docs (Oct 20, 2026) — A1 |
| 2 | Thinking budget + token cap | Agree — A2 |
| 3 | Scoring rubric, temp 0.3 | Agree — B4 + A3 (single call, not split) |
| 4 | Handles not names | Agree — B2 |
| 5 | Slot enforcement + repair | Agree — B3 (shoes not forced) |
| 6 | Richer color in item lines | Agree — B5 |

## Acceptance

- Phase 0: live smoke test of all three functions on `gemini-3.8-flash`;
  photo deletion works; no `AI_BAD_RESPONSE` from truncation in testing.
- Phase 1: benchmark suite exists; every B-item shows no regression
  (founder-judged) before shipping.
- Phase 2: subtype/style-tags present on new uploads; back-print class of
  error gone; no null color hexes.
- Phase 3: one-off bad rating no longer creates a durable preference;
  suggestions carry evidence.
