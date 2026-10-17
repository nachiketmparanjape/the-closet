# PC-22 Design — Chat references (@-mentions)

**Status:** proposed 2026-10-17, awaiting founder validation before build.
**Goal:** let the founder point the stylist chat at things — "warmer version
of *this*", "build an outfit around *this tee*". Generalizes PC-16's
implicit `previousPick` (last pick only, invisible) into an explicit,
reusable component.

## UX

- Typing `@` in the chat input opens a picker: one searchable list with two
  sections — **Articles** (wardrobe, by name) and **Outfits** (saved, by name).
- Picking inserts a **chip** — a visual token like `▸ navy tee`, not raw text.
  Chips sit in a row above the input, each removable with a × tap.
- Send carries the chips as structured ids, not text:
  `references: { articleIds: [...], outfitIds: [...] }`.
- References are **per-message**: the reply may produce a new pick, which
  PC-16's `previousPick` then carries forward implicitly. No persistent
  "pinned" state — one less thing to manage, and the follow-up flow already
  covers continuity.
- Plain-text `@foo` with no chip does nothing special (no magic parsing).

## Client

- `chatRefs = { articles: [], outfits: [] }` — cleared after each send.
- Picker: absolutely-positioned list under the input, filters on keystrokes
  after `@`; keyboard/mouse selection; closes on Escape or selection.
- `sendChat` adds `references` to the `askStylist` payload alongside the
  existing `previousPick`.
- Chips render from local data (`itemById`, outfit name) — no new fetches.

## Server (`functions/stylist.js`)

- `sanitizeReferences(refs, wardrobeIds, outfitIds)`: keep only ids that
  exist and belong to the user; cap at 5 articles / 3 outfits; malformed
  input → treated as empty (never a 400).
- New prompt block, **explicit references take precedence** over
  `previousPick`:
  - Referenced **articles**: "The user pointed at these specific pieces —
    build the outfit around them; keep all of them unless the request says
    otherwise."
  - Referenced **outfits**: "The user pointed at this saved outfit — treat
    the request as an iteration on it (warmer/colder/dressier…), returning
    a complete re-scored outfit."
  - Both present: outfit is the base, articles are must-keeps.
- Resolved into context as wardrobe lines + outfit summaries (names only,
  same format the wardrobe already uses) — no new data fetching patterns.

## Out of scope (per plan)

- Cross-product references; rich link previews in chat; multi-outfit
  comparison ("which of these two"); voice input.

## Acceptance

1. `@` picker shows articles and outfits, filters as you type.
2. "build around @navy-tee" returns a full outfit containing the navy tee.
3. Referencing a saved outfit + "warmer version of this" iterates on *that*
   outfit, not the last chat pick.
4. Bogus ids in the payload are dropped silently; the request still succeeds.
5. 80/80 tests still pass; new sanitize tests added.

## Open questions for the founder

- Should the picker also search by color/category ("@blue")? (Proposed: no —
  name search first, extend later if you miss it.)
- Chips above the input vs inline in the text field? (Proposed: above —
  simpler, readable on mobile.)
