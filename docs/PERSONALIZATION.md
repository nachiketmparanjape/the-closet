# Personalization — living system design

> Maintained reference for the Closet's learning systems. Per studio rule:
> technologically complex (or potentially complex) systems get a proper
> design doc, kept current. Line numbers are as of 2026-10-18 — follow the
> function names, not the numbers.

## What it is
Two halves, one vocabulary (the 12 style tags from PC-30):
1. **Vibe as a chat handle** — "dress me streetwear tonight" works.
2. **Learned vibe profile** — the app notices what you wear and like, and
   biases future picks toward it. Quiet, inspectable, clearable.

## Naming
The learned profile is `vibeProfile`. **Not** `styleProfile` — that name is
taken by PC-12's user-confirmed preference *strings*
(`sanitizeStyleProfile`, `functions/stylist.js`).

## Part 1 — vibe handle

- **Detection** (new, client): `detectVibe(input)` near the chat send path
  in `public/index.html`. Matches the 12 literal tags plus the synonym map
  below. Explicit only — fires when the user names a vibe, never inferred.
- **Stylist wiring**: pass `vibe` into `askStylist(items, messages,
  styleProfile, previousPick, references, weatherContext)`
  (`functions/stylist.js`). Rubric (`RUBRIC`, versioned) gains one line:
  "when a vibe is requested, strongly prefer items carrying that tag and
  name the vibe you honored." Response names it back ("Went streetwear:")
  so the handle is visibly working.
- **Precedence**: explicit vibe request > vibe profile > default behavior.

### Synonym map — comprehensive without bloat
Policy (founder 2026-10-18): the map stays **hand-curated, ≤4 synonyms per
tag**, each synonym mapping to exactly one tag (no overlaps). Candidates
come from a **miss log**: vibe words in chat input that match no tag get
counted (client-side, never sent anywhere); recurring misses are reviewed
periodically and either promoted into the map or deliberately rejected.
Bloat is prevented by the cap + the one-tag-per-synonym rule, not by hoping
we thought of everything upfront.

## Part 2 — learned vibe profile

### The credit-assignment problem (why tag-level)
A 5★ outfit has 4 items — which one earned the stars? Item-level learning
stays noisy forever. Tags are shared across items, so repeated evidence
converges: "minimalist" recurring in 5★ outfits and "streetwear" in 2★
ones reveals the preference without per-item attribution.

### Signals and weights (first pass — tunable constants)
| Event | Delta per tag | Code pointer |
|---|---|---|
| Wear an item | +0.04 (weak — wearing ≠ loving) | `outfitWearBtn` handler → `users/{uid}/wear_events` (`public/index.html`) |
| Outfit rated 4–5★ | +0.06 to each tag on each item | `saveRating()` → `users/{uid}/ratings` (`public/index.html`) |
| Outfit rated 1–2★ | −0.06 | same |
| 3★ / unrated | 0 (neutral is not a signal) | same |
| Save a stylist pick | +0.03 | `saveChatOutfit()` (`public/index.html`) |
| Shop-check bought/dismissed | not a signal (noisy; bought items earn wears naturally) | — |

Founder 2026-10-18: "no good intuition yet" — weights are starting values,
revisited once real data exists.

### Representation
`users/{uid}/vibeProfile`:
```json
{ "tags": { "minimalist": 0.82, "streetwear": 0.61 },
  "evidence": { "minimalist": 34, "streetwear": 21 },
  "updatedAt": "<ts>" }
```
Scores clamped 0–1. Additive field — no migration; starts empty.
Client-side update on wear/rate/save (single user, low frequency;
last-write-wins race accepted for v1, noted).

### Update rule
`score = clamp(score + delta)` per event, then global slow decay
(`× 0.995` per update) so the profile follows taste drift instead of
freezing it. Evidence counters only grow.

### Confidence and cold start
`confidence = min(1, totalEvidence / 40)`. Below **0.3** the profile is
hidden from Settings and ignored by the stylist entirely — empty means
"we don't know yet," honestly (founder decision 2026-10-18). At 0.3+ it
becomes a soft prior.

### Stylist use
One prompt line: "Wearer vibe profile (confidence 0.5): minimalist 0.8,
streetwear 0.6." Instruction: with no explicit vibe requested, gently
favor matching items; acknowledge at most once per conversation; never
lecture. Item tag bits already flow via `itemLine()`
(`functions/stylist.js`).

### Visibility and control
Settings → "Your vibe": top-3 tag chips, shown only once confidence ≥ 0.3,
plus a reset button. The profile is the user's data — inspectable,
clearable.

## Deliberate non-goals
- No vibe inference from photos or names — behavior (wears/ratings/saves)
  only.
- No hard filtering — vibes bias, never gate; explicit per-request override
  always wins.
- No cross-user learning — per-uid, never pooled.
- No permanent labels — decay keeps the profile honest about drift.

## Open: exploration vs. exploitation (selection bias)
The profile only learns from what the user wears — untried vibes score ~0,
so the stylist never suggests them, so they're never tried: a
self-reinforcing loop. Deliberately open-ended (founder 2026-10-18).
Parked in `BACKLOG.md` as a future modeling question: occasional
exploratory suggestions ("you've never tried edgy — want to?"),
counterfactual logging, or explicit "surprise me" handles. Not for v1.
