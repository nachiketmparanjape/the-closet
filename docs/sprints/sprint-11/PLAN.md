# Sprint 11 — Add flows + shop check

**Pulled 2026-10-17** by founder: "plan a sprint around the remaining UI
fixes that I suggested and PC-14."
**Status:** PC-14 shipped 2026-10-17; sprint complete pending founder testing.

## Cuts

### UX-11: Outfits "add" affordance (S) — SHIPPED 2026-10-17
- **Founder pick (2026-10-17):** option B — single "+ Add outfit" entry with
  a chooser ("less clutter; optimize with real data later").
- **Built:** the three header buttons are one "+ Add outfit" button opening
  a bottom sheet titled "Add an outfit" with three labeled options (Build
  manually / Match a photo / Match with camera), each with a one-line
  description; Cancel row; backdrop-tap and Escape dismiss. All three
  options route to the existing flows unchanged.
- **Constraint honored:** "Add a piece" / "Bulk add" untouched in the hero.

### PC-14: Shop compatibility check — design (M)
- Design doc for founder validation before any build (M-cut rule).
- Scope (from backlog): photo/screenshot of a shop item → 0–10
  wardrobe-fit score + gaps-vs-duplication + 2–3 outfits from owned
  pieces. No price/value judgment, no purchase links, no availability.

### PC-14: Shop compatibility check — build (M) — SHIPPED 2026-10-17
- **Built:** `functions/shopcheck.js` (callable `shopCheck`; path guard
  `users/{uid}/shop-checks/`; one Gemini call — describe + score +
  dup-check + 2–3 outfits; returned IDs re-validated, hallucinations
  dropped; no price/availability talk), registered in `functions/index.js`,
  deployed via `deploy-create.js` with the public invoker binding (endpoint
  verified: no 403). Storage rules gained the `shop-checks/` owner-only
  block (deployed via REST). Client: "Shop check" hero button → photo
  sheet (take/upload) → result modal (score, verdict, reasons, similar
  owned with thumbnails, outfits from owned pieces, "nothing saved" note,
  "Add it to your wardrobe" CTA feeding the upload flow). Tests:
  `tests/shopcheck.test.js` (7). Full suite green; live app verified.
