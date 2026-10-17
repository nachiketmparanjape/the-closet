# PC-13 design: outfit photo parsing

**Status:** proposed 2026-10-17 — awaiting founder validation before build.
**Lane:** Loop ("capture outcomes faithfully").

## The flow

1. **Entry:** "From photo" button in the Outfits view (v1 keeps it there;
   chat entry later if the pattern earns it).
2. **Upload:** one photo of the outfit (worn or laid flat).
3. **New callable `parseOutfitPhoto`:** sends the photo + the wardrobe list
   (names, categories, colors as text — 14 items, cheap) to Gemini; the
   model returns proposed matches `[{itemId, confidence}]` plus a plain-text
   note for anything visible that isn't in the wardrobe.
   - Thumbnail fallback: if text-only matching proves unreliable in
     testing, pass item thumbnails via `gs://` fileData. Not v1.
4. **Confirm screen (the important UX):** each proposed match shown with
   its wardrobe thumbnail and a remove toggle; unknowns listed as "not in
   your wardrobe" with no action (deliberately NOT auto-cataloged — that's
   PC-3 territory). If nothing matches, no outfit is created — the screen
   says so and offers the manual builder instead.
5. **Save:** outfit created with `source: "photo"`, name from
   `defaultOutfitName`, `photoUrl` stored (the outfit photo goes to
   Storage — future "what it looked like on" view). The existing dedup
   check runs (source is part of the hash, so a photo-logged combo won't
   collapse into a stylist-saved one — different provenance, correct).
6. **Optional wear log:** after save, the PC-20/21 date picker offers
   "log a wear" right there — photo → outfit → wear in one sitting.

## Data model

- `outfits.photoUrl: string?` (new, optional)
- `outfits.source` gains `"photo"` alongside `stylist`/`manual`
- No rule changes needed (owner-only collections already cover it)

## Edge cases

- Multi-person photos: out of scope; the confirm screen lets the user drop
  wrong matches, which is the graceful failure mode.
- The 3 existing user ratings reference deleted outfit docs (Sprint 7
  testing) — they dangle. Calibration matching is by doc id, so they're
  correctly excluded, not silently misattributed.

## Open questions for the founder

1. Confirm screen: is per-match confirm/remove the right granularity, or
   would you rather one "looks right / fix it" step?
2. Should the outfit photo also be settable later (add photo to an
   existing outfit), or only at parse time?
