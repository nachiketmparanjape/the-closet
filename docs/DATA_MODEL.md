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
time (same authority rule as colors). The `ai` object stays as the **raw
cache** of the last AI analysis, extended with:

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
