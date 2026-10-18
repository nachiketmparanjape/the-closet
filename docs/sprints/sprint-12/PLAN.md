# Sprint 12 — Shop list (proposed)

**Pulled:** 2026-10-17 — founder's "save shop checks" request.
**Status:** PC-28 design validated by founder ("PC28 makes sense") and SHIPPED 2026-10-17.

## Cuts

### PC-28: Saved shop checks ("Shop list") (M)
- **Design:** `PC-28-DESIGN.md` — persistent per-check objects (AI
  analysis + photo + user note/link/SKU + considering/bought/dismissed
  status), new "Shop list" tab, history detail view.
- **Follow-up (founder feedback via FB-1, 2026-10-18):** "Add it to your
  wardrobe" opened an empty manual add form — fixed to one-tap add: the
  shop-check AI's analysis (category/colors/pattern/note) builds the
  wardrobe doc directly, photo copied into the item's own storage path, no
  second AI run. Adding from a saved check also flips it to "bought".
- **Build:** SHIPPED 2026-10-17 — Save button in the result modal, Shop list tab
  (score badge + status chips + dismissed last), detail view reusing the
  analysis renderer + note/link/SKU fields + considering/bought/dismissed
  status + delete, "Add it to your wardrobe" on bought items, owner-only
  Firestore rules with analysis-write-once/update-user-fields-only.

### PC-19: Perceptual-hash photo dedup (S) — SHIPPED 2026-10-18
- Pulled from parked backlog at founder's request ("let's size and scope
  the hash dedup"). 63-bit DCT pHash, Hamming ≤ 5, warn-don't-block on
  single + bulk upload; `phash` stored on photo entries; 7 unit tests;
  backfilled all 14 existing photos via scripts/backfill-phash.js.

### Shop-flow tidy batch (founder test 2026-10-18) — SHIPPED
- Title = full AI note verbatim → now shortened ("An off-white baseball
  cap with..." → "Off-white baseball cap"); description keeps the full note.
- Shop-check AI returned free-text categories ("Headwear") outside the app
  vocabulary → category now constrained to CATEGORIES in the prompt AND
  server-validated (falls back to "Other"), same as describeItem.
- Filter chips were missing Accessories/Other → added.
- One-tap add from the ephemeral result now auto-records the shop check
  as "bought" (manual Save still = "considering").
- Style-tag checkboxes inherited `.field input { width: 100% }` and
  rendered as giant black boxes → excluded via :not([type="checkbox"]) +
  proper 18px checkbox styling.
- Repaired his cap item title in Firestore.
