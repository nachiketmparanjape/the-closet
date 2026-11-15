# Chat Attach — Proposal (consolidated item picker)

> **Status:** proposed 2026-11-14, awaiting founder validation.
> **Source:** firsthand founder usage, 2026-11-14 — first day actually
> asking the app to pick an outfit. Founder directive: consolidate,
> no duplication for the same action, "super intuitive"; design
> delegated to Bramble.

## The problem, in the founder's words

- "It is not easy to find that T-shirt while you're talking in the
  chat itself."
- The list that was supposed to show up showed only names, no photos.
- He looked up the name from the list, went back to chat, typed it —
  it did not work.
- Without @, just mentioning the name as-is picked up the right shirt.
- "An easy way to browse the photos within the chat and add them to
  the chat, I think, is an important feature."
- "In every article outfit, every UI card, there should be a way to
  click on that card and the chat opens up with that item already in
  the card."

Founder priority call (2026-11-14): this package jumps the queue
ahead of parked items — "the goal is to make the app easy to use."

## Current state (verified in code 2026-11-14)

- **PC-22 @-picker:** typing `@` opens an inline dropdown of articles
  + saved outfits. Rows are **text-only** (icon + name), capped at
  **6 articles + 4 outfits**, substring match on name. Chips are
  text-only. That is the whole picker — there is no photo anywhere
  in it.
- **Why typing the name "did not work":** the picker caps at 6
  substring matches, so a common word hides the item you want; and
  the picker is a separate inline dropdown that closes when you
  leave the input. The plain-name mention working without @ is the
  server matching names in message text — that path is fine, the
  picker is the weak part.
- **PC-38 photo refs:** the composer's attach button is camera/upload
  photos only (reference photos for one turn) — it cannot attach
  wardrobe items. So today there are two half-overlapping attach
  mechanisms and neither shows your wardrobe as photos.
- **Cards:** no card anywhere opens the chat with an item attached.

## Design principle: one picker, two doors

The duplication the founder flagged is real: @-picker and
browse/attach would be two pickers for one action. The fix is not
to pick one trigger and delete the other — it is to have **one
picker, one selection model, one chip display**, reached two ways.
The two doors are shortcuts, not two features — the same way Cmd+K
and clicking the search box open the same search. If @ and + ever
diverge again, the design has regressed.

## The design

### One sheet: "Add to chat"

A bottom sheet (same pattern as the shop follow-up sheet — the app
already teaches this gesture). One code path, opened two ways:

- **Search field at the top.** Live-filters the grid as you type.
- **Photo grid below.** Every wardrobe item as a card: display photo
  (the standardized/cutout render the resolver already picks),
  name, category. Scrollable — no 6-cap, no pagination tricks.
- **Category filter chips** above the grid (All, Tops, Bottoms,
  Shoes, Outerwear, Accessories…): one tap narrows the grid. This
  is the browse path for when you remember "it was a black tee" but
  not its name.
- **Saved outfits section** below the grid (same sheet): the picker
  today covers pieces + outfits, and that scope stays.
- **Multi-select:** tap a photo to toggle it (checkmark badge on
  the photo). A Done button attaches everything selected at once.
  One at a time is the slow path; dressing around a tee plus the
  shoes you already have in mind is the real use.
- **Dismiss without picking** leaves the input untouched. If the
  sheet was opened by @ and the user typed a name but picked
  nothing, the @text stays as plain text — the server's name
  matching is the fallback, which is the path that already worked
  for the founder.

### The two doors

- **`+` button in the composer (always visible).** Opens the sheet
  with an empty search and the full grid. This is the discoverable
  door — a new user finds it without knowing @ exists.
- **Typing `@`.** Opens the **same sheet**, search pre-filled with
  whatever follows the @, autofocused. The old inline text dropdown
  is deleted entirely — it must not survive as a second picker.

### Chips carry photos

Attached items render as chips with a **photo thumbnail + name +
×**, in the composer and in the sent message. The payload is
unchanged (structured ids, never parsed from text) — this is
client-only rendering. A chip you can see is a chip you trust is
attached; a text chip is a guess.

### Card → chat: "Style around this"

Every item card — wardrobe grid, outfit cards, shop-check detail —
gets a **"Style around this"** action that opens the stylist chat
with that item already attached as a chip. It opens immediately:
the whole point is one tap and you are chatting with the context
loaded, not staging an item to attach later. Tapping it from
anywhere else in the app is the same action — one entry point, one
behavior.

## What changes, what does not

| Area | Change |
|---|---|
| Client `renderRefPicker` / `refCandidates` (PC-22) | Replaced by the sheet. Inline dropdown deleted. |
| Composer `+` button | Opens the same sheet (today it is photos-only, PC-38 — wardrobe items join it, camera/upload stay). |
| Chips `renderRefChips` | Photo thumbnail added. |
| Item cards | "Style around this" action added. |
| Server (`askStylist`, `mapHandlesToIds`) | **No change.** Structured ids already flow; plain-name fallback stays. |
| PC-38 reference photos | Unchanged — camera/upload photos are a different thing (one-turn vision context, never wardrobe items). |

## Out of scope (separate cards if wanted)

- Tappable item chips inside stylist **answers** (the PC-41
  follow-up idea — needs a server reply-contract change).
- Any change to how the stylist uses attached items.
- Outfit-builder changes.

## Acceptance criteria

1. @ and + open the same sheet — one code path, verifiable by
   reading the code (no second picker anywhere).
2. Every row in the sheet shows the item's photo; the grid scrolls
   with no cap; search filters live; category chips narrow the grid.
3. Multi-select works; Done attaches all selected as photo chips;
   each chip removable with ×.
4. "Style around this" on any item card opens the chat with that
   item attached.
5. Plain-name mention without @ still works (fallback preserved).
6. Phone-verified by the founder: find a tee by photo alone, attach
   it plus one more item, ask for an outfit around it.

## Effort

M — client-only. One sheet + wiring + card actions + deleting the
old dropdown. No server work, no data migration, no new
permissions.
