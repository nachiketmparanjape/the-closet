# UX-14a — Demo wardrobe + greatest-hits-first: design note

> Written before the cut (2026-11-23, Sprint 32). The onboarding
> proposal (`docs/proposals/ONBOARDING-PROPOSAL.md`) recommends
> "the cheapest honest version — one curated closet, read-only
> picks" for the demo wardrobe but does not settle which items,
> how it is labeled, or where it lives. This note settles those
> three things. The founder's phone test is the validation gate:
> if the demo feels fake or the labeling reads as real clothes,
> the cut fails.

## What the proposal settles

- Attack line 2: greatest-hits first (~10 favorites unlock picks)
  + "feel the magic before paying the cost" (a clearly-labeled
  demo wardrobe for picks, packing, and shop checks, then "make
  it yours" swaps in the user's pieces progressively).
- Risk it names: a demo that feels fake poisons the well — it
  must be obviously a demo and obviously good.

## What it does NOT settle (decided here)

### 1. Which items — the demo wardrobe (10 pieces)

One fixed curated closet, client-side, photos hotlinked from
Unsplash — the same precedent as the Today zero-card's labeled
"Sample" pick, which already hotlinks three Unsplash photos.
Every photo below was verified by viewing it on 2026-11-23
(the first three were already founder-verified in the Today
sample card on 2026-10-29; captions here name what the photo
actually shows, the lesson of that correction).

| # | Item | Category | Colors | Unsplash photo ID |
|---|------|----------|--------|-------------------|
| 1 | Rust bomber jacket | Outerwear | rust | photo-1591047139829-d91aecb6caea |
| 2 | White cotton tee | Tops | white | photo-1521572163474-6864f9cf17ab |
| 3 | Dark denim jeans | Bottoms | dark blue | photo-1542272604-787c3835535d |
| 4 | Black leather biker jacket | Outerwear | black | photo-1551028719-00167b16eac5 |
| 5 | Tan suede sneakers | Shoes | tan | photo-1549298916-b41d501d3772 |
| 6 | Black graphic tee | Tops | black | photo-1618354691373-d851c5c3a990 |
| 7 | Grey hoodie | Tops | grey | photo-1556821840-3a63f95609a7 |
| 8 | Blue check blazer | Outerwear | blue | photo-1594938298603-c8148c4dae35 |
| 9 | Dusty pink joggers | Bottoms | pink | photo-1594633312681-425c7b97ccd1 |
| 10 | Cream graphic tee | Tops | cream | photo-1576566588028-4147f3842f27 |

Deliberately left out: a black quilted crossbody bag
(photo-1548036328-c9fa89d128fa) — the photo carries a visible
luxury logo; the demo stays unbranded. The grey hoodie photo
shows the hoodie worn from behind; the blazer photo shows a
full suit, captioned as the blazer only.

Why 10: it is the proposal's greatest-hits number, and 10
pieces (4 tops, 2 bottoms, 3 outerwear, 1 shoes) give the
stylist more than one real outfit to build — a 3-piece demo
could only ever return the same pick.

### 2. How it is labeled — "obviously a demo" in four places

- Entry buttons say "Try the demo wardrobe".
- The demo chat's empty state says "Demo wardrobe — sample
  pieces, not your clothes" and explains the deal in one line.
- The context bar carries a first entry: "Demo wardrobe ·
  10 sample pieces".
- Outfit cards from demo replies carry a "Demo" tag, no Save
  button, and no "Wore it" button — instead one line: "Demo
  outfit — add your own pieces to save it", with the door to
  the capture flow.

### 3. Where it lives — two doors, both zero-item surfaces

- The stylist chat's empty state, when the wardrobe is empty:
  next to "+ Add pieces".
- The Today zero card ("Start here"), next to "+ Add your
  first pieces".
- Entering demo starts a fresh conversation on a "demo"
  thread key. The demo conversation is in-memory only: it is
  never written to Firestore (`saveThread` no-ops for the
  demo key), so it never appears in saved conversations and
  vanishes on reload — a demo is not a conversation to keep.
  Exiting demo (the "Add your own pieces" door, or Start
  fresh) returns to the real general thread.

## How it works (mechanics, no new backend)

- In demo mode the client sends the 10 demo items as the
  `items` payload, plus a `demoWardrobe: true` flag. The
  server's handle contract is unchanged: handles [i1]–[i10]
  index the sent list, demo or real.
- The server adds one brief line in demo mode: the pieces
  are samples, not the user's — build only from them, never
  claim they are owned, and offer to help add their own.
- Outfit cards and chips render from the demo items through
  the same photo resolver (a demo item is `{ photos: [{ url,
  type: "original" }] }`); `itemById` falls back to the demo
  map. Tapping a demo tile shows a toast ("That's a demo
  piece — add your own to open it") instead of the item page,
  which does not exist for demo pieces.

## Greatest-hits-first (the other half of the card)

- **The pick threshold does NOT move.** Today picks unlock at
  4 items (a top + a bottom). The proposal's open question #1
  (greatest-hits threshold: 10 vs 15) explicitly needs a
  stylist-quality test on small catalogues before the cut is
  sized — that test is research, not this cut. Moving the
  threshold to 10 would take picks away from 4–9-item users.
- What this cut does change:
  - Onboarding copy reframes the ask as "~10 most-worn
    pieces" (empty chat + Today zero card): the ask is your
    favorites, not your whole wardrobe.
  - The server says so honestly when the real wardrobe is
    partial (4–9 items): a brief line that the wardrobe is
    partial, to work with what's here and say so — never
    pretend pieces exist that don't.

## Assumptions + open questions for the founder

- Unsplash hotlinks are the photo source (same as the
  existing sample card). If Unsplash is ever blocked, demo
  photos break — same exposure the sample card already has.
- One fixed demo closet for everyone; no per-user variation.
- The 10-vs-15 greatest-hits threshold question is NOT
  settled by this cut — it needs the stylist-quality test
  the proposal asks for. Flagged as research follow-up.
- If the demo feels fake on his phone despite the labeling,
  the cut fails and the demo comes out — the labeling is the
  feature, not the decoration.
