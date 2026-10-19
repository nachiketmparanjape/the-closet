# Closet — product vision

**Purpose:** Kill the "I have nothing to wear" lie. A morning co-pilot that turns
a closet you ignore into outfits you actually wear.

## V1 — "get to this point first" (agreed 2026-09-30)

- Catalogue pieces: photo, tags, stored per-user.
- Conversational outfit recommendation: the founder talks to the app; occasion,
  weather, and preferences come from the conversation, not integrations.
- The morning decision is the core loop: wake up → get an outfit → no scrolling.

## Explicitly not v1

- **Weather API integration** — the user provides weather in conversation.
  (Decision 2026-09-30: auto-fetching weather is overengineering for v1 —
  geolocation, API keys, caching, error handling, all to replace three words
  the user can type. Revisit as a paper cut if manual input proves annoying.)
- Calendar integration, social features, shopping/commerce.

## Beyond v1

The founder has more ideas — they go to the studio inbox, get triaged into the
backlog. Nothing enters an active sprint unplanned.

### Long-term: the stylist as an agent (founder vision, 2026-10-18)

Some people will use the UI and consult the stylist; others will just *talk*
to the stylist to do everything the UI can do, and more — the chat as a
first-class interface to the whole app, the way Muse itself works.

What that means architecturally: the stylist gains **tools**. Reads first —
wardrobe search, wear history ("what did I wear last Tuesday?", "which of my
shirts go unworn"), then writes — log a wear, save/rate an outfit, edit an
item — all in conversation. Tool calls execute **client-side** against the
existing Firestore rules (the security boundary stays where it is; the model
proposes, the client disposes). The UI isn't replaced — two interfaces, one
data layer; the chat becomes an agent, the UI stays for browsing and touch.

Sequencing: reads before writes; the Sprint 14 composer already proved the
"chat without typing" orchestration pattern. Revisit when the stylist lane is
solid and there's appetite for the tool-calling architecture (it changes the
prompt contract and needs a client tool executor — a real project, not a cut).
