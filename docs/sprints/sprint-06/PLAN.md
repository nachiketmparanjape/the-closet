# Sprint 6 — Chat-to-outfit loop

**Dates:** 2026-10-16 → 2026-10-30 (fixed; unfinished cuts roll over, no guilt)
**Status:** APPROVED by founder 2026-10-16 ("yes … let's start the next sprint").
**CLOSED 2026-10-16/17** — all cuts shipped, verified, founder-tested surface.
**Theme:** the stylist conversation is the core loop — stop making the user
leave it. Plus the Sprint 5 benchmark baseline that never got a clean run.

## Cuts

### PC-15: Fix dead "view in Outfits" chat button (S) — DONE 2026-10-16
- Shipped: removed the `disabled` flag; the existing navigation handler now
  fires. Verified live.
- **In scope:** the chat outfit card's "Saved ✓ — view in Outfits" button is
  `disabled` despite carrying a navigation handler — remove the disable so it
  closes the stylist, switches to Outfits, and opens the saved outfit.
- **Out of scope:** any change to the save flow itself.
- **Acceptance:** save an outfit in chat, tap the button, land on the open
  outfit in the Outfits view.

### PC-16: Inline outfit preview + iterate in chat (M) — DONE 2026-10-16
- Shipped per approved design: thumbnails in chat card, previousPick in the
  askStylist payload, server iteration block. askStylist redeployed ACTIVE.
  76/76 tests, CI green, live.
- **In scope:** the chat outfit card shows item thumbnails (cover photos),
  not just names; follow-up messages in the same chat can iterate
  ("swap the shorts", "something warmer", "another option") without leaving
  the stylist. Design doc first, founder validates, then build.
- **Out of scope:** editing a saved outfit's items from chat (that stays in
  the outfit view with versioning); multi-outfit comparison.
- **Acceptance:** ask for an outfit, see photos inline, iterate twice via
  chat, save the final version — all without closing the stylist.

### PC-17: Structured score display (S) — DONE 2026-10-16
- Shipped: per-dimension chips (Color/Formality/Weather/Proportion/Occasion)
  in the outfit view; confidence stays the prominent number. Client-only,
  live via CI.
- **In scope:** render `appScores` as labeled per-dimension chips/bars in
  the outfit view instead of the flat "colo 8 · form 10…" text blob.
  Confidence stays a single prominent number.
- **Out of scope:** changing how scores are computed or stored.
- **Acceptance:** open a stylist outfit, see five labeled dimension scores
  that match the stored `appScores`.

### Rolled from Sprint 5: stylist benchmark baseline — DONE 2026-10-16/17
- 6/6 scenarios completed, all checks pass. Report: `BENCHMARK-BASELINE.md`.
  Found + fixed a real bug via the benchmark (prompt/parser handle-format
  mismatch). Noted: model self-scores run hot — calibration logging will
  tell us how hot once real ratings accumulate.

## Decisions carried in
- Rating stays gated behind wearing (founder 2026-10-16, in PRODUCT.md).
