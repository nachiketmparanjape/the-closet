# Trips: clarify broad destinations before using one point for weather

Status: Ready to file on GitHub; not yet published.

## Problem and reproduction

On 2026-11-01, enter Maui as a trip destination for 2026-11-06 through
2026-11-10. The app resolves it to Maui, United States, with coordinates
20.770, -156.268. Its forecast summary is highs 67°F, lows 50°F, rain likely.
The tester expected warmer weather for their intended stay. That expectation
has not been independently verified; the proven issue is that a broad island
name becomes one forecast point without sufficient clarification.

`geocodeDestination` requests `count=1` and picks `results[0]`.
`fetchLegWeather` uses that point for the entire trip. Chat then correctly
repeats the supplied weather, so this is separate from UX-16 context handoff.

## Expected behavior

When a destination covers a broad area, make the selected forecast location
clear and let the traveler refine it to their town or place of stay before
relying on the weather for packing. Decide how to identify broad matches during
implementation; do not assume one island-wide forecast represents every stay.

## Acceptance

- Maui's resolved point is not presented as an unqualified forecast for every
  location on the island; the UI explains or requests greater specificity.
- The user can confirm or refine the forecast location.
- A changed location invalidates or clearly marks stale weather and packing
  weather context; refresh uses the confirmed location.
- Precise destinations continue to work; lookup failure is explicit.
- Compare payload coordinates, forecast response and displayed summary. No
  fixed temperature range is used as the pass criterion.

Related: UX-16 audit (passed); destination suggestions issue (selection UI).
This issue owns forecast-location suitability and stale-context behavior.
