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
  failure; the gates and the input are. If the fixed gates still
  fail the sweatshirt, the prompt becomes a new card with the
  rejected render as evidence.

## Build results

(TBD — filled per card as it ships.)

## Retest

(TBD — QA round after the build; the founder's manual checks
after QA, per the loop design. Retest target: the sweatshirt
`FHMXDcg4NNpkdj8HsFMY` — cutout visible, standardization
passing to pending review, trigger firing on the next new item.)
