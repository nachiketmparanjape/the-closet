# PC-28: Saved shop checks ("Shop list") — design

**Status:** draft for founder validation (M-cut rule: no build before approval).
**Sprint:** 12 (proposed). **Date:** 2026-10-17.
**Origin:** founder 2026-10-17 — shop checks are ephemeral, but "should I
buy this?" plays out over days. He wants a persistent object per checked
item: the AI's analysis plus user-added details (SKU, link, notes) — a
history of everything tried, revisit-able for later purchase.

## What it does

- Every shop-check result gains a **"Save"** button. Saving persists the
  whole check — photo, AI analysis, score — as a first-class object.
- New third tab **"Shop list"** (Wardrobe / Outfits / Shop list): cards
  with photo, score, verdict, date, status.
- Tap a card → detail view: full AI analysis (reasons, dupes, outfits)
  plus **user-editable fields**: note, link (tappable, opens in browser),
  SKU.
- **Status flow:** Considering (default) → Bought or Dismissed. "Bought"
  offers the existing "Add it to your wardrobe" CTA. Dismissed items sit
  in a muted section at the bottom — out of the way, not gone.
- Delete with confirm, like everything else.

## Data model

```
users/{uid}/shopChecks/{checkId}
  photoPath: string            # users/{uid}/shop-checks/…
  photoUrl: string             # download URL at save time (display)
  item: CatalogItem            # the unified model — see
                             # CATALOG-ITEM-PROPOSAL.md (same shape as a
                             # wardrobe article, not a separate "shop item"
                             # blob); includes the AI's one-line `note`
  score: number|null, verdict: string, reasons: string[]
  similarOwned: [{ itemId, note }]
  outfits: [{ pieces[], note }]
  userNote: string             # default ""
  link: string                 # default "" (URL, validated client-side)
  sku: string                  # default ""
  status: "considering"|"bought"|"dismissed"
  createdAt, updatedAt         # server timestamps
```

## Rules (firestore.rules)

Owner-only read/write on `users/{uid}/shopChecks/{id}`. Field validation:
score 0–10 or null; status in the enum; link/sku/userNote strings ≤ 500
chars. (Deployed via the REST script, like the feedback rules.)

## Client

- Result modal: **Save** joins "Add it to your wardrobe" and "Done".
  After save → toast "Saved to your shop list"; the Save button disables
  (one doc per check — no dupes).
- Shop list tab reuses the gallery card language; detail modal reuses the
  result renderer plus a small form for note/link/SKU (metadata-only
  writes, like the outfit rename pattern).
- Link field: URL-validated, rendered tappable.

## Non-goals

Price tracking, availability alerts, sharing lists, auto-saving every
check. Manual save keeps the list intentional — "whatever they save gets
saved."

## Open questions for the founder

1. Tab name: **"Shop list"** vs "Wishlist" vs "Saved"? (Recommend "Shop
   list" — it matches the feature's name and isn't gift-registry flavored.)
2. Manual Save button vs auto-save every check? (Recommend manual — not
   every check deserves history; matches "whatever they save gets saved.")
