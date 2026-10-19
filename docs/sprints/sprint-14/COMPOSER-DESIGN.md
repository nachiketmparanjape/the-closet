# Outfit composer ("Dress me today") — design

## Problem
The morning decision currently requires a conversation. The chat stylist
does the job, but some mornings you want one tap, not ten messages. This
is the inbox spitball ("outfit composer, from scratch — the
morning-decision loop, grown up"), scoped to zero-typing.

## The key architectural decision
**No new Cloud Function.** The composer is client orchestration around the
existing `askStylist` callable: it builds the message
("Dress me for today — {occasion}. {Weather summary}.") and lets the
server do what it already does (wardrobe lines, rubric, vibe profile as
soft prior, slot validation). Cost per tap ≈ one stylist call (~$0.002).
This keeps the cut at M instead of L and the prompt logic in one place.

## UX
- **Entry:** "Dress me today" button in the hero (the morning loop lives
  where the day starts, not buried in the Outfits tab).
- **Inputs (minimal, all optional):** occasion chips — Work, Casual,
  Dinner out, Workout — defaulting to none ("whatever today brings").
  Weather comes from WX-1 automatically; the vibe profile rides along
  server-side.
- **Output:** one outfit card (the same saveable card the chat renders —
  reuse the component), plus 2 alternates inline and a "reshuffle"
  affordance. Save → outfits; "I wore this" → wear logged (which feeds
  the vibe profile — the loop closes).
- **Empty/edge states:** wardrobe too small for the occasion → the
  stylist says so honestly (it already does); no special-casing.

## Deliberate non-goals
- No calendar integration (the inbox's "one_at_a_time calendar bridge"
  is a separate, bigger idea).
- No multi-day planning (that's Trips' job).
- No new prompt engineering beyond the constructed message — the rubric
  and vibe machinery are reused as-is.

## Open questions for the founder
1. Occasion chips: the four above + none, or a different set?
2. Placement: hero button, or does it belong in the Outfits tab?
3. Alternates: 2 inline + reshuffle, or a different shape?
