# Context Pins — Proposal

_Scoping doc per founder request 2026-10-19. "Persistent but adaptable":
facts the stylist should remember across chats (location, weather,
trip context) without becoming stale cruft._

## Problem

Chat context (stated weather/location) dies with the conversation.
But real-world facts persist: "I'm in Tahoe until Sunday" is true for
days. Today the stylist re-learns it every chat — or never does.

## Concept: pins

A small, human-curated store of *current facts* the stylist reads
every chat. Persistent (survives chat sessions), adaptable (expires,
overridable, editable, deletable).

**The non-negotiable rule** (same as the trip-curation guardrail,
founder 2026-10-18): the AI **proposes, the human disposes**. Nothing
is ever pinned silently. One active pin per kind — a new location pin
replaces the old one ("moved"). Hard cap: useful in under ~20 lines,
or the design is wrong.

## Data model

`users/{uid}/context_pins/{pinId}` (owner-only CRUD):

- `kind`: `location` | `weather` | `trip` | `note`
- `label`: "Tahoe"
- `detail`: "visiting, back Sunday" (human-readable, ≤200 chars)
- `weatherSummary`: "28–34°F, snowing" (optional)
- `tripId`: optional — a trip-scoped pin (see "Relationship to trip
  curation" below)
- `validUntil`: date string, nullable (no date = until replaced)
- `source`: `user-confirmed` | `trip`
- `createdAt`, `updatedAt`

## Lifecycle

1. **Creation — chat-proposed, human-confirmed.** User says "I'm in
   Tahoe until Sunday" in any chat → model calls a `pinContext` tool
   with the extracted facts → client shows an inline confirm
   ("Save 'Tahoe until Sunday' as your current location?
   [Save] [Dismiss]"). The model extracts dates; the user can adjust
   in the confirm.
2. **Adaptation.** User says "back early" / "actually I'm in Denver" →
   model proposes an update (shorten expiry) or a replacement pin;
   same confirm flow. Settings gets a "Current context" list with
   edit/delete for direct control.
3. **Expiry.** Server ignores pins past `validUntil`; a quiet
   background trim deletes expired ones (no ceremony).
4. **From trips (later, not this cut):** creating a trip could propose
   a trip-scoped location pin for its dates. Explicitly out of scope
   until chat-proposed pins prove the interaction.

## How the stylist uses them

`askStylist` reads active pins server-side (best-effort, same pattern
as `vibeProfile`) and injects a CURRENT CONTEXT section into the
system prompt. Priority order for weather scoring:

1. Conversation-stated weather (the active-weather rule, Sprint 16
   fix — strongest, immediate)
2. Active context pin (e.g. Tahoe location + its weather)
3. Measured WX-1 geolocation weather (today's default)
4. Trip weather, in trip chat (overrides 2–3 for trip topics)

A visible chip in chat ("📍 Tahoe") shows which pin is active, so the
state is never invisible.

## Relationship to trip preference curation

The parked curation design (proposal, 2026-10-18) wants a per-trip
preference record. Pins with `tripId` set ARE that record — same
mechanism, same curation rules, scoped. This proposal subsumes the
curation thread: when trip chat needs remembering, it proposes
trip-scoped pins instead of a parallel system.

## Cut shape (when pulled)

- Rules: `context_pins` owner-only CRUD.
- Tool: `pinContext` function declaration in chat (normal + trip
  mode), propose-only; client confirm UI; client executes the write.
- Server: active-pin read + prompt injection in `buildStylistRequest`.
- Client: inline confirm, Settings "Current context" list, 📍 chip.
- Tests: pin sanitization, expiry filtering, prompt injection.

## Open questions

*(Resolved with founder 2026-10-19 — see "Resolved scope" below.)*

1. ~~Scope: locations/weather only, or general facts (trip, notes)
   from the start?~~
2. ~~Confirm UX: inline chat card (recommended) vs. a quieter banner?~~
3. ~~Name in UI: "Current context"? Something else?~~
4. ~~Trip auto-pinning: when you create a trip, should it *propose* a
   location pin for those dates — or leave that out of v1?~~

## Resolved scope (founder 2026-10-19)

**1. Scope: location + weather + key preferences.** Beyond location
and weather, the durable, slow-changing facts worth pinning for a
wardrobe stylist:

- **Temperature comfort** — runs cold / runs hot / neutral
  (layering decisions).
- **Default formality bias** — leans casual / leans dressed-up.
- **Color loves & avoids** — e.g. loves earth tones, avoids neons.
- **Fit preference** — relaxed / tailored, when relevant.
- **Packing style** — light / generous (the founder's earlier
  Paris-vs-Peru idea, now persistent).
- **"Never suggest" list** — hard no's (e.g. shorts in winter).
- **Activity kit** — owns ski gear / hiking boots (what's available
  for trips).

These are *stated* facts — a different layer from the *learned* vibe
profile (Sprint 13). Stated beats learned when they conflict.

**2. Confirm UX: inline chat card** (Bramble's recommendation,
founder deferred). The pin is proposed where the conversation is —
context is fresh, one tap, no navigation. A quieter banner would be
easier to miss and the feature would die unused. Keep the card
compact: label + detail + dates, [Save] [Dismiss].

**3. Multiple locations: yes.** The model already holds many pins;
one is *active* per kind. Trip-scoped pins (`tripId`) can be active
alongside global ones, and auto-activate during the trip's dates.
And yes — the app already uses given locations today: (a) phone
geolocation → WX-1 chat weather, (b) trip destination → packing
weather. Pins sit above both in the priority order.
