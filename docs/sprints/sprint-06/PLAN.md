# Sprint 6 — Chat-to-outfit loop

**Dates:** 2026-10-16 → 2026-10-30 (fixed; unfinished cuts roll over, no guilt)
**Status:** APPROVED by founder 2026-10-16 ("yes … let's start the next sprint").
**Theme:** the stylist conversation is the core loop — stop making the user
leave it. Plus the Sprint 5 benchmark baseline that never got a clean run.

## Cuts

### PC-15: Fix dead "view in Outfits" chat button (S)
- **In scope:** the chat outfit card's "Saved ✓ — view in Outfits" button is
  `disabled` despite carrying a navigation handler — remove the disable so it
  closes the stylist, switches to Outfits, and opens the saved outfit.
- **Out of scope:** any change to the save flow itself.
- **Acceptance:** save an outfit in chat, tap the button, land on the open
  outfit in the Outfits view.

### PC-16: Inline outfit preview + iterate in chat (M)
- **In scope:** the chat outfit card shows item thumbnails (cover photos),
  not just names; follow-up messages in the same chat can iterate
  ("swap the shorts", "something warmer", "another option") without leaving
  the stylist. Design doc first, founder validates, then build.
- **Out of scope:** editing a saved outfit's items from chat (that stays in
  the outfit view with versioning); multi-outfit comparison.
- **Acceptance:** ask for an outfit, see photos inline, iterate twice via
  chat, save the final version — all without closing the stylist.

### PC-17: Structured score display (S)
- **In scope:** render `appScores` as labeled per-dimension chips/bars in
  the outfit view instead of the flat "colo 8 · form 10…" text blob.
  Confidence stays a single prominent number.
- **Out of scope:** changing how scores are computed or stored.
- **Acceptance:** open a stylist outfit, see five labeled dimension scores
  that match the stored `appScores`.

### Rolled from Sprint 5: stylist benchmark baseline
- Re-run `scripts/run-benchmark.js` scenario-by-scenario with bounded
  monitoring until a complete baseline result file exists. No prompt tuning
  until the baseline is in hand.

## Decisions carried in
- Rating stays gated behind wearing (founder 2026-10-16, in PRODUCT.md).
