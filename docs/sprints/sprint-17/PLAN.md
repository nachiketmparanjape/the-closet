# Sprint 17 — Context Pins

_Founder pulled 2026-10-19 ("Do it"). Design: `docs/proposals/CONTEXT-PINS-PROPOSAL.md`
(resolved scope in the doc). Batch, not timebox._

## Goal

Persistent-but-adaptable current facts the stylist remembers across
chats: location, weather, and key preferences — with propose-never-append
curation (founder rule).

## Cards

### 1. CONTEXT-1 Context pins (M)

Shipped — awaiting phone validation. Proposal:
`docs/proposals/CONTEXT-PINS-PROPOSAL.md`.

## What's in

- **Data:** `users/{uid}/context_pins/{pinId}` — kind (location|weather|
  preference), label, detail, weatherSummary, validUntil, createdAt,
  updatedAt. Rules: owner-only CRUD, kind enum + label ≤80 enforced.
- **Proposals, never silent appends:**
  - Normal chat: model may return one `pinProposal` in the JSON contract
    (CONTEXT PIN PROPOSAL section in the prompt).
  - Trip chat: `pinContext` tool (alongside updateTripPacking); a
    pinContext call returns as a client-side proposal.
- **Client:** inline Save/Dismiss confirm card in chat; one active pin
  per kind (new global pin replaces same-kind globals); 📍 chip in the
  chat header for the active location pin; "Current context" section in
  the account overlay with Remove; quiet `watchPins` listener.
- **Server:** best-effort pin read in askStylist; CURRENT CONTEXT
  section in the system prompt. Priority: conversation-stated >
  pin > measured WX-1 weather. Expired pins ignored.

## Out of scope (later)

- Editing a pin in Settings (remove + re-state in chat for now).
- Trip auto-pinning from trip creation.
- Quiet cleanup of expired pins.

## Validation (needs founder's phone)

1. Chat: "I'm in Tahoe until Sunday" → proposal card → Save →
   📍 chip appears; account overlay lists it.
2. Next chat: the stylist uses Tahoe as default weather.
3. State a replacement location → old global pin replaced.
4. Trip chat: durable fact → pinContext → confirm card → saved.
