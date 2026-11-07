# The Context Standard (founder-approved, 2026-10-24)

Purpose: ORIENT — the one rulebook for how things enter what the
stylist knows, so every future feature follows the same shape.

## Why this exists

The founder, testing UX-18: attaching Today's pick lands in
"What the stylist knows", but an @ reference went somewhere
else entirely — "doesn't that seem inconsistent?" It was. The
@ pointers lived only as chips above the composer and never
appeared in the context bar or the sheet, which broke UX-18's
own decision 2 (exactly one display of what the stylist
knows, rendered from one manifest).

## The standard — three rules

1. **One shelf, three durations.** Everything that enters
   the stylist's context is an attachment with a stated
   lifetime:
   - *This message* — @ pointers to a piece or an outfit.
   - *This conversation* — Today's pick, a shop item,
     attached by a button about the thing.
   - *Always* — facts (what the code calls pins): stated
     preferences, places, and weather the user declares.
2. **One display.** All three durations are visible in the
   same place: the context bar at a glance and the context
   sheet in full, in the founder's priority order (what the
   user added first: trip, pick, @ articles, @ outfits,
   shop item; then weather; then facts; then the memory
   tail). The composer chips are a shortcut view of the
   "this message" group — the same state, removable from
   either surface.
3. **One language.** User-facing words are *Attach* and
   *Fact*. "Pin" is a code word and does not appear in the
   app ("Remember this fact?", never "pin this").
4. **Removal follows the layer** (founder, later the same
   day). Removing a thing removes it from the layer it
   belongs to, not from every layer: a pointer leaves the
   message, an attachment leaves the conversation, and a
   fact removed in a conversation is only *muted* there —
   it stays in the Account (its permanent home, whose
   Remove deletes for good) and returns on Start fresh.
   The mute is real: the server leaves muted facts out of
   the brief, so the display never hides what is still in
   use. Corollary, learned the same hour: the kind rules
   (one place, one weather, preferences dedupe by exact
   label) are enforced by ONE write path shared by every
   door that writes a fact — a rule that holds in one door
   and leaks in another is not a rule.

## What a new feature must do to comply

- Name its duration (message / conversation / always) before
  it is built; a fourth duration needs the founder's call.
- Appear in the one display (contextEntries → bar + sheet)
  in the priority order, removable from the display if the
  user put it there.
- Use the standard words in user copy.

## Status

Built and live 2026-10-24 (commit 6347913): @ pointers join
contextEntries with a "· this message" suffix and a Remove
row in the sheet; the proposal card says "Remember this
fact?". Rule 4 + the one-write-path corollary built and
live the same day (commit c7367b7): per-conversation fact
mutes ride the askStylist call and are honored by the one
assembler; factConflicts() is the shared write rule for the
form and proposal saves. Fold this standard into
docs/CONTEXT-MODEL.md when the docs PR (#80) lands; until
then this file is the record.
