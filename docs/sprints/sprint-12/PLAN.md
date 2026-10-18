# Sprint 12 — Shop list (proposed)

**Pulled:** 2026-10-17 — founder's "save shop checks" request.
**Status:** PC-28 design validated by founder ("PC28 makes sense") and SHIPPED 2026-10-17.

## Cuts

### PC-28: Saved shop checks ("Shop list") (M)
- **Design:** `PC-28-DESIGN.md` — persistent per-check objects (AI
  analysis + photo + user note/link/SKU + considering/bought/dismissed
  status), new "Shop list" tab, history detail view.
- **Build:** SHIPPED 2026-10-17 — Save button in the result modal, Shop list tab
  (score badge + status chips + dismissed last), detail view reusing the
  analysis renderer + note/link/SKU fields + considering/bought/dismissed
  status + delete, "Add it to your wardrobe" on bought items, owner-only
  Firestore rules with analysis-write-once/update-user-fields-only.
