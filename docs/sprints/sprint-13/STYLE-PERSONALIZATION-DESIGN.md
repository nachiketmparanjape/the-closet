# Style-tag personalization design

## Problem
PC-30 gave the app a coherent 12-tag aesthetic vocabulary, but the tags
are prompt context only — no filtering, no learning, no user-facing job.
This cut makes them earn their keep, in two parts.

## Part 1 — vibe as a chat handle (the visible half)
"Dress me streetwear tonight" / "something minimalist for dinner" just works.

- **Detection:** match the 12 tags (plus a small synonym map, e.g.
  "edgy" ← "grunge"/"dark", "formal" ← "dressy") in the chat input.
  Explicit beats inferred — only fire when the user names a vibe.
- **Stylist wiring:** pass `vibe` into `askStylist`; rubric gains one line:
  "when a vibe is requested, strongly prefer items carrying that tag and
  say which vibe you honored." The response names it back ("Went
  streetwear: …") so the user sees the handle working.
- **No-vibe default:** unchanged behavior.

## Part 2 — learn the wearer's aesthetic profile (the quiet half)
The app notices what you actually wear and like.

- **Signal:** wear events + ratings, joined to each item's `styleTags`.
- **Model:** `users/{uid}/styleProfile` → `{ tags: { minimalist: 0.82,
  streetwear: 0.61, … }, updatedAt }`. Incremental update on each
  wear/rate: tags on the item get a bump (rating-weighted; wears count
  less than 5-star ratings), everything decays slightly so tastes can
  drift. Additive field — no migration, no backfill required (profile
  starts empty and fills in).
- **Use:** soft prior in the stylist. When no vibe is requested, items
  matching the profile's top tags get a gentle boost; the stylist may
  name it once ("leaning minimalist, as usual") but never lectures.
- **Visibility:** a small "Your vibe" row in Settings showing the top 3
  tags with a reset button. The profile is the user's data — inspectable
  and clearable.

## Deliberate non-goals
- No vibe inference from photos or names — the profile learns from
  behavior (wears/ratings) only.
- No hard filtering ("only show me minimalist") — vibes bias, they don't
  gate. The user can always override per request.
- No cross-user learning — the profile is per-uid, never pooled.

## Open questions for the founder
1. Should the "Your vibe" profile be visible in Settings from day one,
   or stay invisible until it's learned enough to be interesting?
2. Vibe synonyms: fine with a small hardcoded map, or keep it to the
   12 literal tags only?
