# Sprint 31 — The stylist gets hands (chat thread sprint)

- **Status:** APPROVED by the founder 2026-11-21 ("Approve the
  Sprint 31 slate — start building"). All six cards built and
  deployed 2026-11-21; awaiting founder phone verification
  (see Build results at the end).
- **Theme:** the founder's own chat thread (reviewed 2026-11-21).
  He used the stylist as an agent — add this, style with that, I
  wore this — and it could only talk. This sprint gives the chat
  its first writes and fixes the trust leaks the thread exposed.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## The planning walk (2026-11-21, full inventory)

Walked per the standing rule: BACKLOG.md end to end (parked
items + trigger checks, untriaged ideas, open questions) →
studio inbox → open GitHub issues (19 open at walk time).

**Trigger checks:**
- "Stylist as an agent" (untriaged idea, 2026-10-18) — **FIRED.**
  Its revisit condition was "when the stylist lane is solid";
  the founder hit the read-only wall live in his own thread.
  Graduates into PC-66 + PC-68 (its first two writes).
- LayerUp inbox ideas ×3 (2026-11-07) — no fire (still
  pre-launch; no surface pressure). Stay in the inbox.
- PC-48 (trip planning depth) — trigger approaching, not
  fired: the Canada trip is real (Jan 14–24) but this card's
  natural home is a pre-Canada sprint. Noted for the next walk.
- PC-49 (avatar preview) — no fire (needs PC-34 live + a
  PC-36 verdict; neither exists yet).
- PC-44 / PC-50 (link intake) — no fire (no fetch approach
  measured at the 90%+ bar).
- UX-16 (context-handoff audit) — its status said "competes
  at the next planning walk"; it competed here and lands as
  first alternate.

**Aging flags (>1 month old, not started — disposition each):**
- PC-23 (archive layer, parked 2026-10-18) — **keep parked.**
  The wardrobe is ~70 items; the grid is not yet unwieldy.
  Archive earns its keep around 150+. Revisit next walk.
- PC-24 / PC-25 / PC-26 (wearer preference + gender tagging
  + gender-aware prompting, parked 2026-10-18) — **keep
  parked as a chain.** No founder decision yet on whether
  the stylist should style gender-aware at all, and no
  styling miss has traced to its absence. Revisit if one does.
- The founder ratifies or overrules these with the slate.

**Considered, not selected:**
- #135–#139 (Today-surface batch, 2026-11-05) — real cards,
  wrong surface for this sprint's theme; they head the next
  walk's list. (#139 gets indirect help: PC-68 creates the
  wear data it needs.)
- #130 / PC-60 follow-up (vision-judge calibration + gate
  wiring) — genuine unfinished engineering, but a quality
  sprint of its own, not this one. Flagged to the founder
  in the proposal message.
- PC-34 / PC-36 (planned) — extraction stack, different lane.
- PC-55, UX-14 (planned) — intake/onboarding, different lane.
- Sprint 30 / #141 is untouched by this sprint: still
  awaiting the founder's phone verification on its own track.

## The slate (scored: impact on ease-of-use + trust, per effort)

| # | Card | Issue | Effort | Why it's in |
|---|------|-------|--------|-------------|
| 1 | PC-63: [iNN] handles never render | #142 | S | A visible defect in his own screenshots; near-free to fix; do first |
| 2 | PC-66: Add items from chat | #144 | L | The flagship — the exact request the thread shows refused, twice |
| 3 | PC-65: Same outfit, same card | #143 | M | Kills the re-skinning bluff (3 names, 3 scores, 1 outfit) |
| 4 | PC-67: Verify logged/unlogged claims | #145 | S | Stops silent substitution; rides PC-66's matching |
| 5 | PC-68: Log-as-worn from chat | #146 | M | Closes pick → wear → log → learn; the agent vision's second write |
| 6 | PC-70: Outfit card hygiene | #147 | S | Saved states, collapsed history, even tiles — a calmer thread |

**Alternates, in order:** UX-16 (S, context-handoff audit) →
PC-69 (M, card actions: tap/swap/refine) → PC-64 (M, tappable
mention chips) → PC-72 (S, polish bundle) → PC-71 (M, "Not for
me" feedback signal). Alternates swap in on founder direction
or if a slate card finishes early.

## Build order & verification

Build in slate order (PC-63 first — it's the warm-up and the
most embarrassing bug). Per the standing gate: tests + a fresh
self-review before every deploy, and nothing is called
verified until the founder's phone does the thing — for this
sprint that means, per card, the acceptance in its BACKLOG
entry, with PC-66's being the one that matters: add pieces
from a chat photo and get an outfit using one of them,
without leaving the thread.

## Build results (2026-11-21) — all six cards BUILT + DEPLOYED, awaiting founder phone verification

- **PC-63 (#142)** — shared `stripItemHandles` used by the main
  chat renderer (model messages only) and the follow-up sheet.
  Commits `72a811f` + `c016ee2`. Honest record: the first deploy
  went out over one failing test (a leading-handle trim); fixed
  and redeployed within the same card, and the suite became a
  hard pre-deploy gate for every later card in this sprint.
- **PC-66 (#144)** — the flagship. `addProposal: "photoItems"`
  (gated: general chat + reference photos on the turn); the
  first attached photo runs the existing outfit-parse pipeline;
  the confirm card reuses the Drafts decision chain
  (`applyParseGarmentDecisions`, extracted from the sheet save)
  so chat adds and sheet adds behave identically; after the
  add, the stylist is re-asked with the new pieces in context
  and answers with the outfit. Commit `cbbcb21`, hosting
  release `1795313311579000`. **Platform note:** Google has
  retired the nodejs20 functions runtime — `deploy-update.js`
  and `deploy-create.js` now target nodejs22 and
  `functions/package.json` declares node 22; askStylist was
  redeployed on nodejs22 with this card.
- **PC-65 (#143)** — prompt rule (same item set keeps its
  first look name + scores) plus a client backstop:
  `outfitSetKey` + `renderSameOutfitStrip` — a repeat set
  renders as a one-line strip naming the first card.
  Commit `1deaf20`.
- **PC-67 (#145)** — check-only photo parses derive match
  verdicts (`verdictsFromGarments`); `sanitizePhotoVerdicts`
  carries them into the stylist's brief with the rule that a
  lookalike substitute is never described as the pictured
  piece. Verdicts persist on the photo's message and ground
  the turns after the parse lands. Commits `c7be7f7`,
  `704720d`.
- **PC-68 (#146)** — `wornProposal: "worn"` (gated on an
  outfit under discussion) + a "Wore it today" row on thread
  outfit cards; one logging path (`logWearForOutfit`) that
  saves-or-matches the outfit, checks today's wear_events,
  and makes a second same-day log a no-op. Commit `bf39667`.
- **PC-70 (#147)** — saveChatOutfit now persists the thread
  (Saved survives reloads); older outfit cards collapse to a
  strip (latest stays open, expand is runtime-only); card
  tiles are true squares — the standalone `.outfit-thumbs`
  `height: 56px` was silently defeating the card rule's
  `aspect-ratio: 1` (proven in a live browser test: tiles
  rendered 125×56), fixed with `height: auto` + top-aligned
  figures. Commit `4e5d1f4`, hosting release `1795314346470000`.

Suite at sprint end: **539 passing** (529 in `tests/` + 10 in
`functions/cutout-check.test.js`). Issues #142–#147 stay open
until the founder verifies on his phone (the #141 convention).

**V1 limits, recorded honestly:** PC-66 parses only the first
attached photo and offers only the first match candidate in
the card (the full matcher lives in the Drafts review sheet;
a chat parse also appears as a Draft in Outfits while live).
PC-67's check trigger is keyword-based and its verdicts
ground the turns after the parse lands (~a minute), not the
immediate reply.

**Founder phone checks (the verification gate):**
- PC-66: from a chat photo of an unlogged outfit, add the
  pieces on the card and receive an outfit using one of
  them — without leaving the thread.
- PC-68: report a wear, tap Log, see it in the outfit's
  history; a second log the same day is a no-op.
- PC-67: send a photo of a logged item and ask if it's
  logged — the follow-up answer names the actual match.
- PC-65: ask for an outfit twice — the second is a strip,
  not a re-named card.
- PC-63: no `[iNN]` anywhere in replies.
- PC-70: save an outfit, reload — still Saved; older cards
  collapsed; tiles square.
