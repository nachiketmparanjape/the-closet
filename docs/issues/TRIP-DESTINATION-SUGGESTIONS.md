# Trips: offer destination search suggestions and explicit selection

Status: Ready to file on GitHub; not yet published.

## Problem and reproduction

Type Maui in the trip destination field. No matching dropdown appears.
Current code listens for `change`, requests one geocoding result, and displays
its resolved name. Users cannot compare matches before accepting a location.
Observed during UX-16 validation on 2026-11-01.

## Expected behavior

Show matching destination suggestions as the traveler types and allow an
explicit choice. Display enough regional information to distinguish matches.

## Acceptance

- Typing a destination presents multiple matches when available, including
  city/place, region and country where available.
- Selecting a result stores its coordinates and displays the selected label.
- Editing the text invalidates the previous selection until resolved again.
- Loading, no-match and request-error states are clear.
- Keyboard, touch and screen-reader users can navigate and select results.
- Delayed responses for older queries cannot overwrite newer results.
- Existing saved trips remain editable without losing their location.

Related: broad-destination precision issue. This issue owns the searchable
selection interaction; that issue owns whether the selected point represents
the intended weather location.
