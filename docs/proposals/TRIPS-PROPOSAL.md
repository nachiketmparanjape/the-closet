# Proposal: Trips — travel packing recommendations

**Status:** proposed 2026-10-18 — awaiting founder validation. NOT scoped for
build until approved.
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

## Open questions for the founder

1. Packing output: flat packable list, day-by-day outfits, or both?
   (Recommend both — list for the suitcase, outfits for the mornings.)
2. Trip chat: mode of the existing chat (recommended) vs. a separate
   per-trip thread?
3. Multi-leg in v1 UI, or single destination now with legs in the model?
4. Does a trip need a "bought for this trip" link into the Shop list?
   (Natural cross-lane tie-in — Phase 3 candidate.)
