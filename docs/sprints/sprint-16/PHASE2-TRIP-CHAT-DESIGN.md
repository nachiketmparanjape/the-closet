# TRIPCHAT-1 — Trip Chat Mode Design

_Sprint 16. Founder design decision 2026-10-19 (proposal):
packing iteration is conversational, not form-based._

## Problem

Re-planning a trip's packing is a blind reroll: the button carries no
intent, so the model can't know *what should be different*. The
founder's fix: let the user say it — "keep the blue sweater, drop the
heavy boots, pack warmer" — in chat, and have the chat write the
revised plan back to the trip.

## Approach: tool call, client executes (stylist-as-agent pattern)

The existing chat gains a **trip mode**. The model answers questions
in prose normally, but when the user asks for packing changes it
**calls a tool** instead of only describing them:

- Tool: `updateTripPacking({ articles: [{id, reason}], outfits:
  [{itemIds, reasoning}], whatChanged })` — the FULL revised packing,
  same shape as `planPacking`'s result plus a human `whatChanged` line.
- The client **executes** it (model proposes, client disposes):
  validate every article id against the real wardrobe, drop outfits
  not fully inside the packed set or under 2 pieces, then write
  `trips/{tripId}.packing` (Firestore rules already owner-only) and
  confirm in the thread with the `whatChanged` line.
- This is the first instance of the BACKLOG "Stylist as an agent"
  pattern: client-side tool execution against Firestore rules.

## Server (`functions/stylist.js`, `functions/index.js`)

- `sanitizeTripContext(value)` → `{ tripId, leg: {location,
  resolvedName, startDate, endDate}, notes, weatherSummary,
  packing: { articleIds (≤30), outfits: [{itemIds}], reply } } | null`.
  All strings length-clamped; malformed → null (chat proceeds modaless).
- `buildStylistRequest(...)` gains `tripContext`. When present:
  - System prompt gains a TRIP MODE section: destination + dates,
    trip notes, packing weather (else trip-local note), and the
    CURRENT PACKING rendered as handles (`[i3] "Blue sweater" —
    reason`) so the model can address pieces precisely.
  - `config.tools = [{ functionDeclarations: [updateTripPacking] }]`
    and **no** `responseMimeType: application/json` (incompatible with
    function calling) — the response path changes: prose text +
    optional function call.
- `extractToolCall(response)` (pure): handles the SDK's
  `response.functionCalls` and the candidates-parts shape; returns
  `{ name, args } | null`.
- `askStylist(...)`: in trip mode, skip JSON parsing: return
  `{ reply, toolCall }` (reply may be "" when the model only calls).
  The JSON/outfit path is untouched when no tripContext.
- Rules for the model (in the TRIP MODE prompt section):
  - Call the tool ONLY when the user asks for a packing change.
  - The tool payload is the complete new packing — include pieces the
    user didn't mention if they still belong.
  - "keep X" is a hard constraint: X stays. "drop X": X leaves.
  - Outfits: 2–3, only from the packed set.
  - After calling, also say in one line what changed (mirrors
    `whatChanged`).

## Client (`public/index.html`)

- State: `tripChat = null | { tripId }`. Set by the trip-detail CTA;
  cleared by the trip chip's ✕ or when the chat closes.
- Trip detail: with a packing plan, the primary button becomes
  **"💬 Talk to me for changes"** → sets `tripChat`, pushes a model
  message anchoring the trip ("You're tweaking the *Vancouver* trip —
  tell me what to change and I'll update the packing."), opens the
  chat overlay. Without a packing, `Plan packing` stays as-is.
- Chat header gains a trip chip (`🧳 Vancouver · Oct 29 → Nov 6 ✕`)
  shown while `tripChat` is active.
- `sendChat`: when `tripChat` is set, attach `tripContext` (built
  from the live trip doc: leg, notes, weather snapshot from the
  stored packing, current packing) to the `askStylist` payload.
- Response: if `res.data.toolCall` names `updateTripPacking`, run
  `applyTripPackingTool(tripId, args)` (pure validator +
  Firestore write) and append a confirmation to the message
  ("Packing updated — <whatChanged>"); the trip detail re-renders via
  its existing snapshot listener. Validation failure → friendly
  message, plan untouched.

## Tests

- `tests/tripchat.test.js`: sanitizeTripContext (valid, clamped,
  malformed), extractToolCall (SDK shape, parts shape, none).
- `tests/tripchat-client.test.js`: `validatePackingToolArgs` extracted
  from the client (unknown ids dropped, outfit filtering, dedupe).

## Risks

- Function calling + thinking config coexistence: probe after deploy;
  if the model returns neither text nor call, error path is the
  existing friendly copy.
- Model calling the tool unprompted on a question: prompt rule +
  client confirmation line make it visible; acceptable v1.
