# Sprint 37 — Make the cutout + diffusion flow reliable

- **Status:** APPROVED by the founder 2026-11-26 ("Can you look
  into that whole flow, do thorough QA testing and investigations
  to make it robust?"). Direct founder order — no planning walk;
  the slate is the founder's report plus the investigation it
  triggered.
- **Theme:** The article cutout and the diffusion (FLUX)
  standardization are not reliable. The founder uploaded a mirror
  outfit photo; the new sweatshirt got no cutout and two diffusion
  attempts failed. The investigation proved, from live data and by
  running the real gates on the real photo, that the flow fails in
  six distinct places — not one flaky provider.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## The founder's case (the evidence, not the summary)

- Item: "Burgundy yellow sweatshirt" (`FHMXDcg4NNpkdj8HsFMY`),
  from parse `buWP3y6nMOASaHlUFqzq` (mirror photo, Nov 25
  11:21 AM PST).
- Cutout: SAM-3 render exists at
  `renders/cec2a33a585ef583e2b97cbe8c072e76.png`,
  `renderStatus: "passed"`, embedding computed — but the item's
  photo entry has no `renderUrl`, so every surface shows the
  original mirror photo.
- Diffusion: two manual attempts failed —
  `quality_gates_failed: color(ΔE=24.3), geometry` (Nov 25
  4:26 PM) and `color(ΔE=28.0), geometry` (Nov 26 4:43 PM).
  `standardization.attempts: 2` — zero automatic attempts.
- Reproduced with the real photo: a perfect solid-burgundy render
  scores ΔE=49.9 against the worn-photo input (bar 15); the
  geometry gate fails any opaque image ("no-background-detected").
- No item has passed the real gates since they went live
  (Sprint 27, ~Nov 4): all 11 "ready" items completed Nov 1.
- `autoStandardizeItem` is ACTIVE with `secrets: []` — the
  trigger was created without `FAL_API_KEY`.

## Scope

The six cards, in fix order:

| # | Card | Issue | Effort | Why it's in |
|---|------|-------|--------|-------------|
| 1 | PC-96: Auto-standardize trigger has no API key | #161 | S | The automatic path never runs at all; fix first so the rest is testable end to end |
| 2 | PC-93: Cutout never shows on the saved item | #158 | S/M | The founder's headline complaint — the cutout exists and is invisible |
| 3 | PC-95: Geometry gate fails every FLUX output | #160 | S/M | A gate that cannot pass blocks every standardization |
| 4 | PC-94: Diffusion standardizes the mirror photo, not the garment | #159 | M | The color gate measures the scene, not the garment |
| 5 | PC-97: Identical retries burn runs on a failure that cannot pass | #162 | M | Six paid FLUX runs for a deterministic failure; no evidence saved |
| 6 | PC-98: A failed standardization tells the founder nothing useful | #163 | S | He retried blind; the reason never reaches him |
| 7 | PC-100: FLUX renders dusty burgundy too red — the color gate fails a real shift | #165 | M | Filed from the first live retest; the anchor was built and proven not to work the same day |

**Build order note:** PC-96 first (infra, unblocks the
automatic path), then PC-93 (client, the visible cutout), then
PC-95 + PC-94 (server gates + input — test together against the
real sweatshirt photo), then PC-97 (retry discipline on top of
the fixed gates), then PC-98 (message the fixed reasons).

**Explicitly not in scope:**
- The parse flow's own SAM-3 cutting (it works — the garment
  render passed). Only the hand-off from parse to item is fixed.
- The 9 remaining native `confirm()` gates (PC-87 follow-up
  note) — different flow.
- The parked Round 4 P2s — a planning walk promotes them, not
  this sprint.
- Any change to the FLUX prompt itself — the prompt is not the
  failure; the gates and the input are. (Superseded during the
  sprint: the fixed gates still failed the sweatshirt on color,
  so the prompt became PC-100 with the rejected render as
  evidence. The anchor was built and proven not to work.)

## Build results

- **PC-96 (#161) SHIPPED 2026-11-26** — live PATCH bound
  `FAL_API_KEY` to `autoStandardizeItem` (with a nodejs22 bump in
  the same PATCH — Google refuses any update to a nodejs20
  function). Trigger ACTIVE, secret verified by read-back.
  `deploy-create.js` map corrected (FAL for the four parse
  functions, `spikeRun` entry) + transitive secret check; new
  audit script `scripts/verify-function-secrets.js`. Commit
  `df0ce1e`.
- **PC-93 (#158) SHIPPED 2026-11-26** — `mintParseRenderUrls`
  mints each kept garment's render URL at parse confirm (one
  retry, never blocks the save); `outfitParsePhotoEntry` carries
  `renderUrl` onto the photo entry. Backfill
  `scripts/backfill-render-urls.js` run with `--apply`: 3 items
  fixed (sweatshirt, Black drawstring shorts, Brown corduroy
  pants), 2 skipped (render file gone). The sweatshirt's render
  URL verified fetching a real PNG (786 KB). Hosting release
  `1795741212716000`. Commit `596e81c`. Tests
  `tests/pc93-cutout-url.test.js` (9).
- **PC-95 (#160) SHIPPED 2026-11-26** — `gateGeometry` counts
  garment pixels as opaque AND not near-white (the old alpha-only
  check read every opaque FLUX render as 100% coverage and always
  failed). Works on opaque renders and transparent cutouts alike.
  Tests in `functions/standardize.test.js` (5 new). Proven live:
  the retest's geometry gate passes.
- **PC-94 (#159) SHIPPED 2026-11-26** — the pipeline
  standardizes from the cutout render (Firebase download URL via
  `downloadUrlForPath`, token created when missing) when a passed
  render exists, falling back to the original photo otherwise;
  `standardization.inputKind` recorded. Tests
  `functions/standardize-pipeline.test.js` (3 new).
- **PC-97 (#162) SHIPPED 2026-11-26** — the retry loop stops when
  the same gates fail twice (`systematic_gate_failure`), saves the
  rejected render as evidence
  (`standardized-rejected.png` + path/reason on the item), and
  never starts an attempt past a 240s budget inside the 300s
  timeout (SAM poll shares the budget). Tests in the pipeline
  test file (2 new + `gateSignature` / `downloadUrlForPath`
  units). Proven live: 2 runs in 42s, not 3 runs in 600s.
- **PC-98 (#163) SHIPPED 2026-11-26** — `standardizationFailureNote`
  translates `lastError` into one plain sentence on the item page
  (color / geometry / timeout / service / unknown fallback), and
  the systematic wording was corrected after the PC-100 verdict
  (a daylight flat-lay photo, not "a clearer photo of the piece
  on its own" — the sweatshirt's input was already a clean
  cutout). Tests `tests/pc98-failure-note.test.js` (10).
- **PC-100 (#165) SHIPPED 2026-11-26, VERDICT: ANCHOR DOES NOT
  WORK** — filed from the first live retest (the color gate
  still failed at ΔE=20.0/20.4 on a real FLUX shift, proven by
  color analysis, not a metric artifact). The pipeline now
  passes the input's dominant color into the FLUX prompt as an
  emphatic RGB anchor (`dominantColor` extracted from the gate
  and exported; `buildFluxPrompt` / `runFluxStandardization`
  take a `colorAnchor`; the input is fetched once and reused by
  the anchor and the gates). Second live retest with the anchor:
  ΔE=22.5 / 23.5 — slightly worse, still failing. FLUX cannot
  reproduce this dusty burgundy even when told its exact RGB.
  The gate is right; the item keeps its original, and the
  failure message says so. Tests: `standardize.test.js` (4 new),
  pipeline test file (2 new). Functions `standardizeItem` +
  `autoStandardizeItem` redeployed (both now nodejs22; fleet
  18 of 21 still nodejs20 — PC-99).

Suite at ship: **752 passing** (720 in `tests/` + 10 in
`functions/cutout-check.test.js` + 12 in
`functions/standardize.test.js` + 10 in
`functions/standardize-pipeline.test.js`), 0 fail, gate run
before every deploy.

## Retest

**Live retests run by Bramble (scripts/retest-sweatshirt.js,
the callable's force path against the real item):**
- Retest 1 (2026-11-26, after PC-93/94/95/97/98): input was
  the cutout; geometry PASSED; color failed ΔE=20.0 then 20.4;
  systematic stop fired after 2 runs in 42s; rejected render
  saved. Item: failed, attempts 3.
- Retest 2 (2026-11-26, after PC-100 anchor): ΔE=22.5 then
  23.5; same stop, same evidence. Item: failed, attempts 4.
  Verdict: FLUX cannot reproduce this color; the gate is right.

**QA round (studio chat) still to run:** the sweatshirt's
cutout visible in the app; the item page shows the plain
failure sentence; a NEW parse item gets its cutout shown and
the trigger fires (or marks already_clean from the cutout);
the next new item standardizes end to end. The founder's
manual checks come after QA, per the loop design. The
sweatshirt itself cannot reach pending_review — that is the
recorded verdict, not a failure to test.
