# Trips Phase 1 — design (trip objects + packing list)

Founder-validated proposal: `docs/proposals/TRIPS-PROPOSAL.md`. Founder
decisions 2026-10-18: articles list + outfits list (day-by-day optional),
simple UI as a hard constraint, single destination in v1 UI, trip-tagged
shop items visible in Shop list + trip view.

## Data model (the load-bearing part)

```
users/{uid}/trips/{tripId}
  name: string                        # "Paris Nov"
  legs: [{ location: string,          # raw input, "Paris"
            resolvedName: string,     # "Paris, France" (geocoder)
            lat: number, lng: number,
            startDate: timestamp, endDate: timestamp }]
  notes: string                        # "client dinners, lots of walking"
  packing: {                           # null until generated
    articleIds: [string],               # ranked, most essential first
    articleReasons: { id: string },    # one line each ("covers the cold nights")
    outfits: [{ itemIds: [string], reasoning: string }],
    weatherSnapshot: string,           # "48–55°F, rain likely" or "forecast unavailable"
    generatedAt: timestamp
  } | null
  createdAt, updatedAt
```

- **Multi-leg in the model from day one** (proposal's call): `legs` is an
  array even though v1 UI only creates one leg. Retrofitting legs later
  is the painful migration; the array costs nothing now.
- **shopChecks gain `tripId: string | null`** (founder decision 4). Field
  exists from day one; the tagging UI + unified trip view are Phase 3.
- **Weather is cached, not live:** `packing.weatherSnapshot` + the
  forecast rows used are stored at generation time. Re-generating
  refreshes. No background refresh — the user re-taps "Plan packing".
- **Deletes:** deleting a trip deletes its doc; shopChecks tagged to it
  keep `tripId` (dangling tag renders as "untagged trip" — acceptable v1;
  Phase 3 can null them).

Firestore rules: `trips` subcollection owner-only read/write (same shape
as `outfits`); `shopChecks` write rule gains the `tripId` field.

## Weather + geocoding (no new keys)

- **Geocode:** Open-Meteo's free geocoding API
  (`geocoding-api.open-meteo.com/v1/search?name=…&count=1`), client-side,
  no key. Store `resolvedName/lat/lng` on the leg.
- **City vs country** (founder's design note): no special-casing. The
  resolved name is shown prominently ("Packing for Tokyo, Japan") and is
  editable — if the geocoder returns a country centroid, the user sees it
  and types a city. Honest, simple, no proxy logic.
- **Forecast:** Open-Meteo daily (`temperature_2m_max/min`,
  `precipitation_probability_max`, `weathercode`) for the leg dates.
  16-day window: trips further out get packing anyway, with an honest
  banner ("Forecast not available yet — based on typical November weather
  in Paris"). Blocking the whole feature until the window opens would be
  the worse UX.

## Packing generation (one AI call)

New callable **`planPacking`** (same patterns as `askStylist` in
`functions/index.js`): input = wardrobe item lines (reuse `stylistItems`
shape), leg weather summary, trip notes, vibe profile (server-side, same
confidence gate). Output = the `packing` object above: ranked articles
with one-line reasons + 2–3 outfits assembled *only from packed articles*
+ weather snapshot string. One call per trip ≈ $0.003. The outfit rules
(slot validation, ≥2 items, rubric) are reused from the stylist prompt —
not duplicated.

Regeneration overwrites `packing` (with a confirm — "replaces the current
plan").

## UI (deliberately plain — founder's hard constraint)

- **Trips tab** (4th tab: Wardrobe / Outfits / Shop list / Trips). List
  view: trip cards (name, destination, dates). Tap → detail.
- **Create:** name, destination (text → geocode → show resolved name),
  dates, notes → "Plan packing".
- **Detail:** two flat lists. (1) **To pack:** ranked article thumbnails
  with the one-line reason under each + count header ("12 pieces").
  (2) **Outfits:** the 2–3 suggested outfits as saveable cards (reuse the
  chat's outfit card component; saving mints a normal outfit doc).
  Day-by-day: not in Phase 1 (founder: optional).
- **Empty states:** no trips → "Plan your first trip" + one-line explainer.

## Deliberate non-goals (Phase 2/3 or later)

- Trip chat mode (Phase 2), trip shop check + "bought for this trip"
  (Phase 3), multi-leg UI, day-by-day outfits, packing quantities ("3
  tops"), laundry math, trip preference curation (open design topic —
  parked until trip chat exists).

## Open questions for the founder

*(All resolved 2026-10-19.)*

1. 4th tab for Trips — **yes** (founder: clutter-concern noted, but it's
   the right home; if a 5th top-level concept appears, nav gets
   rethought then — not this sprint's problem).
2. Outfits in the packing: **saveable**, same pattern as shop-check
   outfits (founder: "similar to shop object").
3. Beyond-forecast trips: **pack on climate normals with the honest
   banner** — see explanation below.

### What "beyond-forecast" means (founder asked 2026-10-19)

Open-Meteo only forecasts ~16 days out. If the trip is further away
(e.g. 2 months), there is no forecast to fetch. Two options were:
(a) generate packing anyway from what the model knows about typical
weather there ("Paris in November is usually 45–55°F and rainy"), with
a banner saying the forecast isn't available yet — or (b) refuse until
the trip is inside the 16-day window. Going with (a): blocking the whole
feature for a far-off trip is the worse UX, and the banner keeps it
honest. Re-tapping "Plan packing" closer to the date refreshes with the
real forecast.
