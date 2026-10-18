# PC-14: Shop compatibility check — design

**Status:** draft for founder validation (M-cut rule: no build before approval).
**Sprint:** 11. **Date:** 2026-10-17.

## Problem

The founder's scenario: standing in a store (or mid-scroll online), holding
a jacket, wondering "do I already own something like this, and would it
actually get worn?" Today the app can't answer — the wardrobe is a record
of what he owns, not a check on what he's *about* to own.

## What it does

Photo (or screenshot) of a shop item → the app answers three questions:

1. **0–10 wardrobe-fit score** — how well it earns a place, with 2–3
   plain-language reasons.
2. **Duplication check** — "you own 2 things like this" with thumbnails,
   so near-dupes get caught before money moves.
3. **2–3 outfits from owned pieces** that the new item would slot into —
   proof it gets worn, not just admired.

**Explicit non-goals:** no price/value judgment ("worth $80?"), no purchase
links, no availability info. It judges fit with *your wardrobe*, not the deal.

## Entry point

A **"Shop check"** secondary button in the hero, next to "Add a piece" /
"Bulk add" — it sits with piece-adding because it's about a *potential*
piece. It stays visible in the compact hero. Tapping it opens the same
bottom-sheet pattern as UX-11: "Take photo" / "Upload photo".

## Flow

1. Photo → uploaded to `users/{uid}/shop-checks/` (ephemeral by design).
2. One Gemini call: describe the shop item (same vocabulary as wardrobe
   items, but **never saved**), then compare against the wardrobe's item
   summaries (same text format the stylist already consumes).
3. Result modal:
   - Big score (0–10) + one-line verdict.
   - "Already in your wardrobe" — similar owned pieces with thumbnails and
     a similarity note each.
   - "It would work with" — 2–3 outfits built from owned piece IDs +
     the new item, rendered like outfit cards.
   - Small print: "This isn't in your wardrobe — nothing was saved."
   - Optional CTA: **"Add it to your wardrobe"** → opens the upload flow
     with the photo and AI description pre-filled (for after the purchase).
4. Photo isn't clothing → friendly "doesn't look like a garment" message,
   no score. Fewer than ~4 wardrobe items → outfits section says so
   honestly instead of inventing.

## Function contract

New callable **`shopCheck({ storagePath })`** (single call, photo +
wardrobe summaries in, structured JSON out):

```json
{
  "item": { "category": "…", "colors": ["…"], "pattern": "…",
            "formality": 0.0, "note": "…" },
  "score": 7,
  "verdict": "Fills a real gap — you have nothing in this weight.",
  "reasons": ["…", "…"],
  "similarOwned": [{ "id": "i12", "note": "Same navy, heavier fabric" }],
  "outfits": [{ "pieces": ["i3", "i9"], "note": "…" }]
}
```

- `storagePath` must start `users/{uid}/shop-checks/` (same guard as PC-13).
- Returned piece IDs re-validated against the real wardrobe (same rule as
  PC-13: unknowns are dropped, never invented).
- **IAM:** new function gets the `allUsers: roles/run.invoker` binding at
  creation (Sprint 8 lesson — otherwise 403-before-execution).
- **Storage rules:** add a `shop-checks/{allPaths=**}` owner-only block
  (same pattern as `outfit-photos/`).

## Data model

No new collections for v1 — the check is ephemeral. Photos live under
`users/{uid}/shop-checks/`; kept (tiny, useful history), not catalogued.

## UI

- Result modal reuses outfit-card rendering for the suggested outfits.
- Score presented as a number + verdict, not a black-box meter — the
  reasons *are* the product.
- Copy keeps the stylist's honest-but-kind register (Sprint 8 critique
  set the tone).

## Open questions for the founder

1. **"Add it to your wardrobe" shortcut** after a check — include in v1?
   (Recommendation: yes, it's cheap and closes the loop on purchase day.)
2. **Keep shop-check photos** or auto-delete after analysis?
   (Recommendation: keep — negligible storage, useful history.)
