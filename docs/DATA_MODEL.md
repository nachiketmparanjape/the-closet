# Closet — data model design (v2)

Founder directive 2026-10-14: design the objects for the product's future so
we never need a drastic migration. AI proposes, the founder disposes —
user-confirmed data always outranks AI guesses. This doc is the design;
implementation is a separate backlog cut.

## Principles

1. **AI suggests, user decides.** Every AI-filled field is user-editable.
   A later AI re-run may add suggestions but never modifies or deletes
   anything the user set.
2. **Provenance is data.** Anything with two possible authors (user vs AI)
   records its `source`. This is what makes rule 1 enforceable in code.
3. **Additive evolution.** Schema changes add fields; code reads the new
   field and falls back to the old one. No big-bang migrations, no backfill
   scripts for a personal-scale app — old docs upgrade lazily on next edit.
4. **Stable join keys.** The Firestore doc ID of an item is the permanent
   reference. Future collections (outfits, wear log) point at it; the item
   never embeds things that belong elsewhere.

## v1 schema (what exists 2026-10-14)

`users/{uid}/items/{itemId}`:

| field | type | notes |
|---|---|---|
| name | string | user-confirmed (AI-suggested at upload since PC-7) |
| category | string enum | user-confirmed (on-device/AI-suggested) |
| color | string (hex) | single color picker value — **the field v2 replaces** |
| imageUrl / storagePath | string | cover photo shortcuts |
| photos | [{url, storagePath}] | up to 4, first = cover |
| createdAt | timestamp | |
| ai | object | PC-7 raw cache: name, description, category, **colors: string[1..3]** (plain words, garment-only), pattern, fit, fabric_guess, formality, warmth |

## v2 changes

### 1. `colors`: first-class palette array (replaces `color`)

```js
colors: [
  { name: "navy", hex: "#1f2a44", source: "ai",   primary: true  },
  { name: "cream", hex: null,     source: "ai",   primary: false },
  { name: "rust",  hex: "#a44a2a", source: "user", primary: false },
]
```

- Up to 3 entries (founder's "two to three colors").
- `name` is the plain word (what the AI returns, what recommendations
  reason over — "yellow socks match the yellow dots"). `hex` is set when a
  human picks from the color picker; AI entries may leave it null.
- `primary` marks the display/search color (v1's `color` role).
- `source` enforces the authority rule: AI re-runs may only add/replace
  `source:"ai"` entries; `source:"user"` entries are untouchable.
- **New optional field (2026-10-15, founder feedback): `family`** — the
  canonical palette name (`functions/palette.js`, ~30 names with hex
  anchors, mirrored in `public/js/palette.js`). AI entries: constrained by
  the prompt, so `family == name`. User entries: resolved by nearest hex.
  Old free-text AI names map through an alias list for analysis. The
  stylist and any future color-theory diagnosis reason over `family` —
  stable vocabulary ("navy" and "midnight blue" are one family).

**Representation decision (2026-10-14, founder: "whatever works best for
the recommender"):** both are stored, but each consumer reads what suits
it — the recommender reasons over `name` (words), the UI renders `hex`.
Rationale: language models think in language. "Navy" carries matching
semantics (goes with white, cream, tan); `#1f2a44` is opaque to them, and
color-harmony concepts ("earth tones", "complementary") are linguistic.
Hex stays because it's the only precise way to *display* a color. So:
words for thinking, hex for showing.
**Research 2026-10-14 confirmed this:** ColorGPT (arXiv 2025) found the
name+hex combination outperforms either alone for LLM color tasks, and
NumColor shows models can't natively parse hex (tokenization fragments
it). Our hybrid matches what fashion-AI apps do in practice (compute in
pixel/hex space, reason over named palettes). Full record: `PRODUCT.md`
research, 2026-10-14.

UI contract (for the implementation cut): the upload and edit views show
the palette as chips — AI suggestions appear automatically, the founder can
add (picker), remove, or re-mark primary. Exactly the interaction the
founder described 2026-10-14.

### 2. Promote AI attributes to top-level, user-editable fields

`pattern`, `fit`, `fabricGuess`, `formality`, `warmth` move out of the `ai`
blob to top-level fields, pre-filled from the AI at upload and editable any
time (same authority rule as colors). **New optional field: `brand`
(string, null when unknown)** — the most standard apparel attribute we lack
(every retail data model carries it: schema.org, Google Merchant Center).
AI attempts it best-effort at upload from labels/logos; user edits or leaves
blank. Honest scope note (2026-10-14): brand helps filtering and
brand-preference matching, not outfit harmony — it won't move recommendation
quality. Added for organization and future-proofing at ~zero cost: optional,
no migration (absent = unknown), prompt change batches with the next
function deploy.

**Standardization (2026-10-15, founder: "uniqlo and uniqlo UT shouldn't be
different brands"):** the model returns the *parent* brand — prompt
instructs it to strip sub-lines/collections ("Uniqlo UT" → "Uniqlo",
"Nike SB" → "Nike"). **New field `brandKey`** (string|null): lowercase,
whitespace-collapsed grouping key ("UNIQLO" → "uniqlo") for dedupe and
filtering. Display casing is never normalized (H&M must not become H&m).
Computed server-side at upload and client-side on brand edits.

The `ai` object stays as the **raw cache** of the last AI analysis, extended with:

```js
ai: {
  ...suggestion,          // the raw describeItem reply, as today
  modelVersion: "gemini-2.5-flash",
  analyzedAt: timestamp,
  photoIds: ["0-...jpg"] // which photos were analyzed — hook for the
                         // future multi-photo "garment model" (inbox 2026-10-14)
}
```

### 3. Migration: lazy, no backfill script

- Code writes `colors` (and top-level attributes) on every save.
- Code reads `colors` if present, else falls back to `[{ hex: color,
  source: "user", primary: true }]` — v1 docs keep working untouched.
- `color` (v1) stops being written once the cut ships; removed from reads
  after all docs have been re-saved at least once (observable, not
  scheduled).

## Deliberately not in v2

- **Embeddings / vector fields** — deferred per 2026-10-06 research.
- **Multi-photo AI analysis** — inbox idea ("Garment model", 2026-10-14);
  the `ai.photoIds` hook is the only concession it gets today.
- **Outfits / wear log collections** — not designed until the
  conversational loop is scoped. The item doc ID is the join key when they
  arrive.

## Minute decisions (2026-10-14 session)

- **No AI re-run on photo add/delete/cover-change.** The description is
  garment-level, not photo-level; all photos depict the same article, so
  the cached analysis stays valid. Verified in code: the edit save uses a
  targeted `update()`, and photo management only rewrites the `photos`
  array — neither path touches `ai`. Stale only if all photos were
  replaced with a different garment (user error; fixed by editing).
- **Color-theory reasoning is hybrid.** The LLM reasons over color *names*
  ("navy", "rust") — color harmony is linguistic knowledge it already has.
  Precise shade matching, if ever needed, happens in code (hex → HSL math:
  complementary = hue + 180°, etc.) with results handed to the model as
  words. The model never parses hex directly.
- **Cost envelope verified:** ~$0.001 per piece described (2,515 tokens on
  the live test); ~$0.005 per whole-wardrobe outfit chat (text only). AI
  cost is not a design constraint at this scale.

## Implementation cut (backlog)

"PC-8: color palette + item data model v2" — palette editor UI in upload
and edit views, provenance rules in save paths, lazy migration per above.
Size after this design: S/M. Not pulled into Sprint 2 (founder: end-to-end
first).

---

# Data model v3: outfits, wear log, ratings, style profile (2026-10-15)

Founder directive 2026-10-15: make the outfit a first-class object and
close the recommendation loop end-to-end (recommend → save → wear → rate
→ reflect → learn). The conversational loop shipping (PC-10) satisfied
v2's deferral condition, so this is now designed.

## Principles (v2's four stand, plus one)

5. **Facts are append-only.** Wear events and ratings are never edited by
   code — the user may delete their own history, but nothing is silently
   rewritten. Stats are derived from facts at read time, never stored
   (no cached counters to go stale).

The v2 authority rule extends naturally: user-written ratings, outfits,
and preferences outrank anything the app infers. App-suggested
preferences sit *pending* until the user confirms them.

## New collections (all under `users/{uid}/`)

### `outfits/{outfitId}` — dimension (the thing), versioned

| field | type | notes |
|---|---|---|
| versionGroup | string | stable id across versions of "the same outfit" (v1: equals the doc ID) |
| version | number | 1, 2, 3… |
| supersedes | string? | previous version's doc ID; null on v1 |
| itemIds | string[] | item doc IDs — the stable join key |
| itemNames | string[] | parallel snapshot; display survives item deletion |
| source | `"stylist"` \| `"manual"` | provenance of origin (v1); preserved across versions |
| name | string | user-editable |
| occasion | string? | *intent* — what it was assembled for |
| weather | string? | as given at recommendation time |
| appConfidence | number? 0–10 | the prediction side; set on v1 stylist outfits, nulled on user edits (the app didn't predict the variant) |
| appReasoning | string? | why the app picked it; same nulling rule |
| favorite | boolean | copied forward to new versions (behaves group-level) |
| createdAt | timestamp | of this version |

Edits create a new version (new doc), never mutate — there is value in
keeping what was recommended. History lists the latest version per group
(client-side grouping; personal scale). Wear events and ratings reference
the exact version doc ID, so "what did I wear / rate" is forever precise
even as the outfit evolves.

### `wear_events/{eventId}` — fact (the event)

| field | type | notes |
|---|---|---|
| wornAt | timestamp | when it was worn; defaults to now, user-adjustable |
| articleIds | string[] | ground truth — always populated, even without an outfit |
| articleNames | string[] | snapshot for display |
| outfitId | string? | null when logged without a saved outfit |
| occasion | string? | *actual* — may differ from the outfit's intent, deliberately |
| note | string? | "felt overdressed" |
| createdAt | timestamp | when logged (differs from wornAt on backfill) |

Firestore can't join, so per-article stats ("worn 47 times") read
`articleIds` directly — never resolve through outfits.

### `ratings/{ratingId}` — fact (the event)

| field | type | notes |
|---|---|---|
| targetKind | `"article"` \| `"outfit"` | one mechanism, two targets |
| targetId | string | |
| wearEventId | string? | which wear is being rated, when an outfit is worn repeatedly |
| rater | `"user"` \| `"app"` | the two sides are literally two docs |
| score | number 0–10 | |
| note | string? | user's words / app's reflection text |
| suggestedPreference | string? | app rater only; pending until the user confirms it |
| createdAt | timestamp | |

### `style_profile/{uid}` — single doc (slow-changing dimension)

| field | type | notes |
|---|---|---|
| preferences | [{ text, source, createdAt }] | user-editable; cap 50, oldest app-sourced pruned first |
| updatedAt | timestamp | |

This is where "the stylist learns you" physically lives — and it grounds
future stylist prompts, so learning compounds instead of evaporating.

## Backend changes

### `askStylist`: structured outfit output (contract extension)

Returns `{ reply, outfit: { itemIds, confidence, reasoning } | null }`.
The prompt additionally requests JSON: exact item names as listed,
confidence 0–10, one-line reasoning. The server maps names → IDs
case-insensitively against the list it sent, drops misses, and returns
`outfit: null` when fewer than 2 IDs validate — the client then shows a
text-only reply with no Save button. Grounding is enforced server-side,
not trusted from the model.

### New callable: `reflectOutfit`

Input `{ outfitId, score, note, wearEventId? }`. The client writes the
user's rating doc first (Firestore direct, owner rules), then calls.
The function reads outfit + items + style profile and asks the model
for: reflection text (engaging with the user's words, acknowledging the
delta vs `appConfidence`) and an optional suggested preference. Returns
`{ reflection, suggestedPreference }`; the client writes the app's
rating doc (`rater: "app"`). Model failure never blocks the rating —
same principle as PC-7: the rating stands, reflection shows
"unavailable", retry offered.

## Migration

v3 is purely additive (four new collections). Zero migration — no
backfill, no lazy-read fallbacks needed. v2's lazy migration for
`colors`/top-level attributes proceeds independently under PC-8.

## Deliberately not in v3

- **Article-direct wear logging** (wearing clothes with no saved outfit):
  v1 is outfit-centric; article stats derive from outfit wears. Fast
  follow if the founder wants it.
- **Offline support** — no offline persistence currently; failures show
  the friendly error (PC-11).
- **Push nudges** ("what should I wear today") — needs the loop first;
  inbox.
- **Embeddings / vector fields** — still deferred per 2026-10-06.

## Minute decisions (2026-10-15 design session)

- **Prediction must be stored.** The prized prediction-vs-outcome delta
  can't be computed if only the outcome is saved — hence
  `appConfidence`/`appReasoning` at creation.
- **Intent vs actual occasion are different fields on purpose.**
  Outfit.occasion is what it was *for*; wear_events.occasion is what
  *happened*. Their disagreement is itself signal.
- **No raw-score comparison.** The user's 6 and the app's 6 mean
  different things; the UI labels them ("your rating" vs "app
  confidence") and treats the delta as informational.
- **Outfits are versioned, not mutated** (founder 2026-10-15: "there is
  value in keeping what was recommended"). A new doc per version sharing
  `versionGroup`; wears/ratings pin exact version IDs. User edits null
  out `appConfidence`/`appReasoning` — the prediction described v1, not
  the variant. Re-scoring edited outfits is a reserved future cut.
- **One-tap wear logging is load-bearing.** The entire stats/reflection
  edifice depends on wear events existing — the "I wore this" button
  lives on the chat card and in history, one tap, no form.
- **Implicit negatives are free.** "Recommended but never worn within 14
  days" is a silent downvote the system already generates; the design
  reserves it (consumed in a later cut, not this one).
