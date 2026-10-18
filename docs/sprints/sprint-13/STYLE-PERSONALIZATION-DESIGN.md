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
The app notices what you actually wear and like. Designed tag-level, not
item-level, for a specific reason (see "credit assignment" below).

### Signals and weights (per event)
- Wear an item: **+0.04** to each of its tags (weak — wearing ≠ loving).
- Outfit rated 4–5★: **+0.06** to each tag on each item in the outfit.
- Outfit rated 1–2★: **−0.06**.
- 3★ or unrated: no change (neutral is not a signal).
- Save a stylist pick: **+0.03** (endorsement, weaker than a rating).
- Shop-check bought/dismissed: **not a signal** — noisy, and bought items
  earn their wears naturally afterward.

### Why tag-level: the credit-assignment problem
A 5★ outfit has 4 items — which one earned the stars? At item level that
stays noisy forever. Tags are shared across items, so repeated evidence
converges: if "minimalist" keeps showing up in 5★ outfits and "streetwear"
keeps showing up in 2★ ones, the profile learns the truth without ever
solving per-item attribution.

### Representation
`users/{uid}/styleProfile`:
```json
{ "tags": { "minimalist": 0.82, "streetwear": 0.61 },
  "evidence": { "minimalist": 34, "streetwear": 21 },
  "updatedAt": "<ts>" }
```
Scores clamped 0–1. Additive field — no migration; the profile starts
empty and fills in. Client-side update on wear/rate/save (single user,
low frequency — last-write-wins race risk noted and accepted for v1).

### Update rule
`score = clamp(score + delta)`, then a global slow decay (`× 0.995` per
update) so tastes can drift — nothing is permanent. Evidence counters
only grow.

### Confidence and cold start
`confidence = min(1, totalEvidence / 40)`. Below 0.3 the profile is
hidden and the stylist ignores it entirely — no "we think you're
minimalist" after one wear. 0.3+ → soft prior. The empty profile means
exactly what it says: we don't know yet.

### Use in the stylist
One prompt line: "Wearer vibe profile (confidence 0.5): minimalist 0.8,
streetwear 0.6." Instruction: when no vibe is requested, gently favor
matching items; an explicit vibe request always wins; acknowledge the
profile at most once per conversation, never lecture.

### Visibility and control
Settings → "Your vibe": top 3 tags as chips + a reset button. The profile
is the user's data — inspectable and clearable. (Open question below: day
one or after confidence crosses 0.3?)

## Deliberate non-goals
- No vibe inference from photos or names — behavior (wears/ratings/saves)
  only, never appearance.
- No hard filtering ("only show me minimalist") — vibes bias, never gate.
  Explicit per-request override always wins.
- No cross-user learning — per-uid, never pooled.
- No permanent labels — decay means the profile follows taste drift.

## Open questions for the founder
1. Should the "Your vibe" profile be visible in Settings from day one,
   or only once confidence crosses 0.3?
2. Vibe synonyms: fine with a small hardcoded map, or keep it to the
   12 literal tags only?
3. Signal weights above — do the magnitudes feel right? (Wears deliberately
   weak, ratings strong, saves weakest.)
