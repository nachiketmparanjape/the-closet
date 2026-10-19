# Proposal: Trips — travel packing recommendations

**Status:** founder validated 2026-10-18 — answers below. Ready for scoping
(Sprint 15 candidate).
**Origin:** founder brain dump 2026-10-18 — packing for travel is stressful;
it needs weather × personal taste × local culture. The app already holds two
of those (wardrobe, weather via WX-1); the model knows the third.

## The idea in one line

A **Trips** tab. You create a trip (destinations + dates + a few notes);
the app tells you what to pack from your wardrobe, builds outfits per leg,
and every other feature (chat, shop check) can run in that trip's context.

## Data model (sketch — needs care, this is the load-bearing part)

```
users/{uid}/trips/{tripId}
  name: string                      # "Paris Nov"
  legs: [{ location: string,        # "Paris, France"
            startDate: date,
            endDate: date }]
  notes: string                     # "client dinners, lots of walking"
  weatherCache: { ... }             # per-leg forecast snapshot + fetchedAt
  createdAt, updatedAt
```

Multi-leg from day one (even if the v1 UI only exposes one leg) — the
model supports it, and retrofitting legs later is the painful kind of
migration.

## How each piece works

- **Packing list:** wardrobe articles scored per leg against forecast
  weather (Open-Meteo already integrated, WX-1) + trip notes. Output is a
  packable list grouped by leg, with counts ("3 tops, 2 bottoms…").
- **Outfits per leg:** the stylist engine, constrained to packed articles,
  one or two outfits per leg/occasion.
- **Trip chat:** not a separate chat — the existing stylist chat with the
  trip injected as context when the trip is "active" ("dressing for Paris
  in November, business dinners"). One chat, modes, not two chats.
- **Trip shop check:** the shop-check prompt gains an optional trip
  context block ("will this earn a place *for this trip*?"). Entry point:
  a toggle in the shop check, or automatic when a trip is active.

## Culture/tourist element

No data to build here — it's prompt-level. The model already knows Paris
vs. Indonesia dress norms; the trip's location + notes steer it. The
founder's example is exactly the demo.

## Phasing (L cut, three phases)

1. **Trip objects + packing list** — CRUD, weather per leg, pack-from-
   wardrobe recommendations. The standalone value.
2. **Trip-scoped chat** — active-trip context in the stylist chat.
3. **Trip-scoped shop check** — "for this trip" mode.

## Founder decisions (2026-10-18)

1. **Packing output: BOTH a list of articles and a list of outfits;**
   day-by-day outfits optional. Hard constraint: **clean, simple UI/UX is
   the priority** — a more complex experience needs UI/UX expertise the
   founder doesn't have, so v1 stays deliberately plain (two flat lists,
   no fancy itinerary views).
2. **Trip chat: a mode of the existing chat** (as recommended).
3. **Single destination in v1 UI** (a city or a country — the experience
   must be designed to handle both gracefully); multi-leg stays in the
   data model only.
4. **Trip-tagged shop items:** shop-list items can be tagged to a trip;
   they show up in the generic Shop list AND in a unified trip view.

## Open design topic: trip preference curation (founder 2026-10-18)

The founder's idea: a systematic, curated record of the person's
preferences *for a specific trip* — and more generally, as part of
personalization. Sketch: a per-trip preference note (structured, human-
readable — e.g. a markdown-like record) that the app builds up from the
trip's chats, packing choices, and shop checks, and that the stylist
reads back as context.

**The bloat risk (founder's own flag):** AI-auto-maintained md/skill files
without human curation tend to bloat into uselessness over time. Design
constraints for whenever this is scoped:
- The record must have a **curation mechanism**: human-editable,
  human-deletable, with the AI proposing additions rather than silently
  appending. Nothing accumulates without a path to removal.
- Prefer **deriving from the existing learning substrate** (vibeProfile,
  wear/ratings, `docs/PERSONALIZATION.md`) over a parallel free-text
  system — the trip layer should be a *scoped view* on what the app
  already knows, plus trip-specific overrides, not a second brain.
- Size cap: if the record can't stay useful in under ~20 lines, the
  design is wrong.
- Not for v1 — parked until trip chat exists and shows what actually
  needs remembering.

## Open questions for the founder

*(All four original questions answered 2026-10-18 — see Founder decisions
above. The trip-preference curation topic is the remaining open thread.)*

1. Packing output: flat packable list, day-by-day outfits, or both?
   (Recommend both — list for the suitcase, outfits for the mornings.)
2. Trip chat: mode of the existing chat (recommended) vs. a separate
   per-trip thread?
3. Multi-leg in v1 UI, or single destination now with legs in the model?
4. Does a trip need a "bought for this trip" link into the Shop list?
   (Natural cross-lane tie-in — Phase 3 candidate.)
