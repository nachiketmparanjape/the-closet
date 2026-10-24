# Sprint 23 — The stylist, made seamless (UX-18)

Opened 2026-10-24 on the founder's call, immediately after
the intake cuts (link removal + PC-51 paste) shipped. His
framing: functionality now compares well against
competitors (Alta/Essembl teardowns agree — intake,
cataloguing, checks, trips are all present); the remaining
big change is the stylist's experience + architecture —
"the key remaining big change that makes the app seamless
to use with the current functionality."

## The one card

**UX-18 — stylist audit: one bottom-up redesign** of the
chat experience and its architecture, designed completely
before anything is rebuilt. Per the important-invisibles
register, the stylist chat (experience + architecture,
including the context model) is the last invisible with NO
DOC. This sprint is its treatment: audit → design doc →
build waves.

## Shape

1. **Audit inventory (Bramble, solo legwork):** every chat
   entry point × the context it attaches by default ×
   where the five context mechanisms (todayPick,
   previousPick, @-references, context pins, tripContext)
   disagree on precedence and lifetime. Exhibit #1: the
   Today pick auto-attaching on a cold Stylist-tab open.
   Evidence file, code pointers included — discovery done
   BEFORE the session, per the card.
2. **The sit-down (founder + Bramble):** decisions, not
   discovery. What a fresh chat means; entry-aware context
   defaults; pin visibility; thread restore semantics;
   one context model — what exists, who wins, when it
   expires.
3. **docs/CONTEXT-MODEL.md:** the session's output, a
   living design doc (proof stack: doc + the visibility
   surface TBD in session).
4. **Build waves** follow from the doc, thrashed into
   sprint-ready cuts at the session — nothing chat-shaped
   builds before the model exists.

## Held behind this sprint (queue, don't interleave)

PC-38, PC-41, PC-45, PC-32, PC-33 — all chat-extending
cards wait for the context model, per the doctrine rule
that extensions queue BEHIND a pending bottom-up redesign.

## Out of scope

New features. This sprint is coherence of what exists.
The Whering teardown stays queued for the research slot
after this sprint.
