# UX-18 audit inventory — the stylist chat, as it actually works today

Evidence pass, 2026-10-24 (Bramble). Every claim points at
code as of commit `b71afaf`. This is the discovery the
founder session should NOT have to do — the sit-down
decides from this list. Plain-language first, pointers
after.

## 1. Four call sites talk to one brain

`askStylist` (functions/index.js → functions/stylist.js)
is called from FOUR places in the client, and each one
assembles its context by hand:

| Caller | Where | What it sends |
|---|---|---|
| `sendChat` | the chat itself | everything: full thread, previousPick, todayPick, references, vibe, weather, tripContext |
| `composerPick` | "Pick an outfit" composer | one synthetic message, previousPick (its own picks only), weather, vibe — no todayPick, empty references |
| `generateTodayPick` | the Today home, silently | one synthetic message ("Dress me for today"), previousPick for alternates, weather, vibe — no todayPick, empty references |
| `planPacking` | trips (separate callable) | its own context path entirely |

The same function is the silent morning dresser AND the
conversation partner. There is no shared "build the
context" step on the client — three similar-but-different
payload literals.

Server side, `askStylist(items, messages, styleProfile,
previousPick, references, weatherContext, vibe,
vibeProfile, tripContext, pins, today, hooks, todayPick)`
takes **13 positional parameters**; `buildStylistRequest`
takes 12. Adding one new kind of context means touching:
3 client call sites, the index.js sanitizers, both
signatures, and the prompt prose. The "context model"
today is exactly this call chain — it exists nowhere else.

## 2. Entry points into the chat, and what each attaches

| Door | Thread | Attaches by default | Visible? |
|---|---|---|---|
| Stylist tab / chat FAB (`openChat`) | general | Today's pick (seedTodayChip), location pin chip, weather chip | pick = chip + strip (see D2) |
| Today "ask" (`todayAsk`) | general | same as above | same |
| Wear sheet → "Surprise me" | general | same, PLUS a prefilled message that AUTO-SENDS | n/a |
| Wardrobe "Build a look around this" (PC-47) | general | an @-reference chip + seeded text (not sent) | chip yes |
| Trip page (`openTripChat`) | `trip:<id>` | tripContext (trip + packing + stored weather); todayPick suppressed; location pins filtered out server-side | trip chip yes |
| Outfit/piece cards via @-picker | general | references chosen in-thread | chips yes |

Threads are **memory-only** ("threads-lite",
index.html ~4033): one message list per context key, kept
in page memory. Reload the app and every thread — general
and per-trip — is gone. Persisted threads are PC-32,
still a proposal. Per-thread trip suggestion memory
(`chatThreadSuggested`) is likewise session-only.

## 3. The context mechanisms (seven, not five)

For each: who owns it, how long it lives, whether the
user can see it, and where it's decided.

1. **todayPick** — client-owned. Seeded fresh on EVERY
   `openChat` (non-trip) from the Today home state
   (`seedTodayChip`, ~4383). Lifetime: the chat session;
   removing the chip sets it null until the next open
   re-attaches it. Sent in the payload; also silently
   becomes the iteration base (see D3).
2. **previousPick** — client-derived per send: the last
   outfit card in the current thread (PC-16). Lifetime:
   one message. Server re-derives the iteration base from
   it (or todayPick) — the merge exists in BOTH places.
3. **@-references** (`chatRefs`, PC-22) — client-owned,
   per-message: chips clear on send, labels stay on the
   message. Server: "outrank the previous pick" (prompt
   prose in buildStylistRequest).
4. **Context pins** (Sprint 17) — server-owned: the
   client NEVER sends them. askStylist loads
   `context_pins` (limit 20) from Firestore itself
   (index.js ~241), filters expired + trip-scoped in
   buildStylistRequest. Client display: `#pinChip` shows
   ONLY an active location pin (renderPinChip ~4967).
   Proposals arrive two ways: a JSON field in general
   mode, a `pinContext` tool call in trip mode — one
   concept, two mechanisms.
5. **tripContext** — client-assembled per send in trip
   mode: trip, leg, notes, stored weather snapshot,
   current packing, and this thread's already-suggested
   outfits. Unlocks the tools (updateTripPacking,
   pinContext, suggestTripOutfits) server-side.
6. **Vibe** — three layers, two owners: client detects an
   exact-vocabulary vibe in the message text
   (`detectVibeTag`) and sends it; the server ALSO reads
   the learned vibeProfile from the user doc (soft prior,
   confidence ≥ 0.3, suppressed when an explicit vibe
   exists). "Vibe outranks everything" is prompt prose.
7. **Style profile + weather** — style profile:
   server-read from Firestore (PC-12). Weather: client's
   measured weather rides the payload (never in trip
   mode), arbitrated against pin weather and
   conversation-stated weather by prompt prose ("user's
   stated weather wins; pin outranks measured").

Plus the wardrobe itself (`stylistItems()` — the full
catalogue, re-sent every call) and the message history:
the client sends the whole thread; the server silently
keeps only the **last 20 messages**, 2000 chars each
(MAX_MESSAGES/MAX_TEXT, stylist.js:24).

## 4. Precedence, as implemented (emergent, not designed)

From buildStylistRequest's section order + prose:
explicit vibe > @-references > iteration base
(previousPick, else todayPick) > pins > measured weather
> vibe profile (soft) — with conversation-stated weather
outranking all weather sources, and style profile as an
always-on instruction block. No document states this
table; it can only be recovered by reading the function
top to bottom (~687–905) — which is what this audit did.

## 5. Disagreements and inconsistencies

- **D1 (Exhibit #1).** Today's pick attaches by default on
  every non-trip chat open — including a cold open from
  the Stylist tab where the user never asked about it.
  Default-on, per-session opt-out, silently re-attached
  next open. Founder, 2026-10-24: "not expected."
- **D2. The pick is displayed twice, from two sources.**
  `#todayChip` renders `todayChipCtx` (snapshot at open);
  `#chatTodayStrip` renders `todayState.picks[idx]`
  live. Remove the chip and the strip still shows the
  full outfit — the thing left the context but not the
  screen. Cycle Today options elsewhere and the strip
  follows while the chip (and the payload) keep the
  open-time snapshot.
- **D3. The iteration-base merge is implemented twice**
  (client sendChat ~4605, server buildStylistRequest
  ~708) with the same intent and different code — two
  places to drift.
- **D4. Invisible pins.** Preference and weather pins
  shape every answer (and the silent morning pick) but
  only a location pin ever shows. This breaks the
  standing rule: whatever is in the context should show
  up.
- **D5. Two pin-proposal mechanisms** (JSON field vs
  tool) for one concept, mode-dependent.
- **D6. Non-chat callers bypass the model.** Composer and
  Today sends carry no todayPick and stub references,
  yet the server still applies pins/style/vibe-profile —
  the morning pick quietly honors context that is
  visible nowhere.
- **D7. Threads vanish on reload** (see §2) while
  dressing as resumable within a session — resume
  semantics exist but their lifetime is "until the tab
  dies," decided by accident, not design.
- **D8. The 20-message window is silent.** Long chats
  lose their beginning with no signal to the user or
  the model.
- **D9. Weather arbitration is prose**, spread across
  three blocks (measured, pins, trip) — behavior changes
  require prompt edits, and the trip regime swaps all
  of it at once.
- **D10. "A fresh chat" is undefined.** The greeting
  seeds only when the list is empty; entry doors variously
  auto-send (Surprise me), seed-without-sending (PC-47),
  or attach silently (Today pick). Three seeding
  behaviors, no rule.

## 6. Decisions the sit-down owns (input to CONTEXT-MODEL.md)

Q1. Per-door default context: which doors attach today's
    pick — and is attach opt-out or opt-in?
Q2. One display rule: a single chip row as the only
    visible context (strip's fate: fold in, or keep as
    display-only with a truthful relationship to it)?
Q3. One iteration-base rule, one owner (client or
    server — not both).
Q4. Pin visibility: all active pins listed somewhere
    visible + manageable from chat?
Q5. The precedence table, written down; prompt prose
    generated to match it.
Q6. Threads: persist (PC-32) or bless session-only —
    with resume semantics either way.
Q7. History window: what happens, visibly, when a
    thread outgrows it?
Q8. Seeding rules per door: auto-send vs seed vs silent —
    one rule, stated.
Q9. Headless callers (Today/Composer): adopt the same
    context model or a documented reduced profile?

## Pointers

Client: sendChat ~4559, openChat ~4298, openTripChat
~4323, seedTodayChip ~4383, renderTodayChip ~4396,
renderChatTodayStrip ~6236, renderPinChip ~4967,
composerPick ~4786, generateTodayPick ~6070,
callAskStylist ~4956 — all in public/index.html.
Server: functions/index.js askStylist handler ~200–295;
functions/stylist.js buildStylistRequest ~687,
askStylist ~1149, sanitize* ~197–460.
