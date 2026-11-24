# Sprint 33 — Close the loop (QA Round 1 fix sprint)

- **Status:** APPROVED by the founder 2026-11-23 ("Let's close
  the loop now, make all the fixes and retest"). Direct founder
  order — no planning walk; the slate is the QA round's output.
- **Theme:** Weekly QA Round 1 (2026-11-23) tested the six
  Sprint 32 cards signed in on the live site. PC-71 passed
  fully. The other five were partial passes. Four P1 findings
  became cards. This sprint fixes them, plus the two PC-72
  regressions the round caught (mid-word truncation, stock
  phrases) — those are failed Sprint 32 acceptance, so they
  belong in the loop-closing pass.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## Scope

The four P1 cards, in fix order:

| # | Card | Issue | Effort | Why it's in |
|---|------|-------|--------|-------------|
| 1 | PC-82: Delete does nothing (pieces + wear entries) | #148 | M | A user cannot remove a wrong piece or a mis-logged wear at all |
| 2 | PC-83: Stylist refuses an attached shop item | #149 | M | A handoff door that deflects instead of judging |
| 3 | PC-84: "More formal" returns a fresh outfit | #150 | M | A revision control that does not revise |
| 4 | PC-85: Reloads flash wrong empty states | #151 | M | Reads as data loss on every reload |

Plus, in the same pass (no new cards — recorded here):

| # | Item | Why it's in |
|---|------|-------------|
| 5 | PC-72a: context bar still truncates mid-word | Sprint 32 acceptance failed in the round; the "shrink word by word" fix did not hold on screen |
| 6 | PC-72b: stock phrases repeat ("incredibly …" every reply) | Sprint 32 acceptance failed in the round; the prose-variety prompt did not hold |

**Explicitly not in scope (parked P2s from the round — per the
loop's design they stay parked; Round 2's scope already names
Today in depth, which covers findings 7 and 8):**
- P2-7 Today does not surface a wear logged today.
- P2-8 Today keeps orphan cards for deleted items.
- P2-9 Deletes that work give no feedback (trips, shop checks).
- P2-10 False duplicate flag (navy tee vs white crew-neck).
- P2-11 Toasts linger for minutes.
- P2-12 Handoff dialog defaults to a destructive choice.
- P2-13 Shop-check photo blank on first open; wardrobe tiles
  render pending/blank while loading.

## Build order & verification

Build in slate order. Per the standing gate: tests + a fresh
self-review before every deploy, and nothing is called
verified until the founder's phone — or the QA retest — does
the thing. The retest is QA Round 2, run early at the
founder's order: scope = the four P1 fixes + the two PC-72
regressions + the core-journey smoke pass. The round reports
to this chat.

## Build results

(To be filled as cards land.)
