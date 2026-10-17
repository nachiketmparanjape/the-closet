# PC-16 design — inline outfit preview + iterate in chat

## Problem
Today the stylist chat returns item *names*. To see what the outfit looks
like you must save it, close the stylist, and open it in Outfits. Iterating
("swap the shorts") means starting over — the model has no memory of its
last pick.

## Design

### 1. Thumbnails in the chat card
Each picked item renders its cover photo + name + category inline in the
chat card. Photos are already on the client (gallery data); no new fetches.
Tapping a thumbnail does nothing in v1 (no navigation — the point is to
stay in chat).

### 2. Iteration without leaving
The client tracks the latest pick per chat session (`lastPick`: array of
item ids). Every follow-up message sends `previousPick` (ids + names) alongside
the new user text. The server prompt gains an iteration block:

- If `previousPick` is present, the model is iterating, not starting over.
- "swap the shorts" → replace only the bottoms slot, keep the rest.
- "something warmer" → adjust within the same direction, keep what still works.
- "another option" → full re-pick, avoiding the previous items.
- Slot validation + repair apply to the final pick as today.

No chat-history replay: the explicit previous-pick payload is cheaper and
less ambiguous than stuffing transcripts into the prompt.

### 3. Card lifecycle
Each new pick renders a new card below the old ones (conversation history
is preserved). Only the latest card carries the live Save button; older
cards keep theirs too (saving an earlier variant is legitimate).

## Out of scope
- Editing a saved outfit's items from chat (outfit view + versioning).
- Multi-outfit comparison UI.
- Tapping a thumbnail to open item detail (would leave chat; contradicts
  the cut's purpose).

## Risks
- Follow-up intent parsing ("swap the shorts" vs "I don't like shorts at
  all") rides on the model's judgment; the repair/validation layer catches
  structural failures, not taste misreads. Acceptable for v1.
- Longer prompts per turn (previous pick + wardrobe). Volume is tiny; cost
  irrelevant.

## Acceptance
Ask → see photos inline → "swap the shorts" → new card with only shorts
changed → "another option" → fully different pick → save final — all
without closing the stylist.
