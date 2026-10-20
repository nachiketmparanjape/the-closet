# Chat Threads — Proposal

_Founder 2026-10-19: "By thread I mean side chats (or any other
solution) for continuation of context at the right place right time."
The single shared chat mixes contexts (pins from one place surfacing
in another trip's chat; reopening a trip chat re-anchored a fresh
conversation and broke continuity). Threads fix the model, not the
symptom._

## Concept

A **thread** is a named, persistent conversation with its own
history and its own context scope. You resume a thread where you
left it; nothing bleeds across threads except what the design says
is global.

- **General thread** — everyday styling. Sees: measured weather,
  global pins (location/weather/preference), vibe.
- **Trip thread (one per trip)** — packing iteration for that trip.
  Sees: the trip + its packing + trip weather, preference pins,
  trip-scoped pins. Does NOT see global location/weather pins or
  other trips.
- **Future threads** (same mechanism): a shop-check thread per item?
  A "plan my week" thread? The container generalizes; don't build
  ahead of need.

## Interim (shipped 2026-10-19, fix buffer)

Threads-lite: per-context message lists held in memory for the
session (general / trip:<id>), anchor only on a brand-new thread,
pin chip hidden in trip mode, server scopes trip-mode pin injection
to preferences + trip-scoped pins. Session-only — a page reload
still resets everything. This proposal is the persisted version.

## Full design (when pulled)

### Data model

`users/{uid}/chat_threads/{threadId}`:
- `kind`: `general` | `trip`
- `tripId`: when kind = trip
- `title`: display name ("Vancouver packing")
- `messages`: capped array [{role, text, outfit?, ts}] — cap ~40,
  oldest pruned; the model only ever receives the tail anyway
- `createdAt`, `updatedAt`

One general thread per user (well-known id `general`); one trip
thread per trip (id `trip-<tripId>`), created lazily on first open.

### Context scoping (the point of the feature)

| Context | General | Trip thread |
|---|---|---|
| Measured WX-1 weather | ✓ | — (trip weather) |
| Global location/weather pins | ✓ | — |
| Preference pins | ✓ | ✓ |
| Trip-scoped pins | — | ✓ (its trip only) |
| Trip + packing | — | ✓ (its trip) |
| Vibe profile / style profile | ✓ | ✓ |
| Chat history | its own | its own |

### UX

- Chat header shows the thread (trip chip today; general shows
  nothing special — it's the default place).
- Opening a trip's chat resumes its thread; the "Talk to me for
  changes" entry point is unchanged.
- No thread list UI in v1 — threads are reached through their
  context (Trips tab → trip → chat), not browsed. A list is a
  later cut if the founder wants it.
- Deleting a trip deletes its thread (same delete handler).

### Server changes

- askStylist already receives tripContext; add `threadId` for
  logging/correlation (OBS-2 tie-in: per-thread quality data).
- History stays client-sent (as today) but sourced from the
  persisted thread — no server session state.

### Open questions

1. Message cap: 40 kept messages, or summarize-and-prune (extra
   model call)? Start with the dumb cap.
2. Should the general thread ever be resettable ("new chat"
   button)? Probably yes — one tap, in the header.
3. Do outfit cards saved from a trip thread link back to the
   thread? (Nice provenance; cheap field on outfits.)

## Cut shape (when pulled)

Rules + thread read/write in the client (watchThread), openChat /
openTripChat source from threads, trip delete cleans up, tests for
scoping + persistence mapping. Session threads-lite becomes the
fallback while signed out.
