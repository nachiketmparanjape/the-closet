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

All six items built, deployed, committed and pushed 2026-11-23.
Suite: 615 passing in `tests/` + 10 in
`functions/cutout-check.test.js`. Doc-honesty check: see the
docs pass below. Verification is the QA retest (Round 2,
scope: the four P1 fixes + the two PC-72 regressions + the
core-journey smoke pass) — nothing here is marked verified
beyond headless checks. GitHub issues #148–#151 stay open
until the retest passes.

- **PC-82 (#148) — Delete works.** Commit `cb32b31`,
  hosting release `1795489080271000`. Root cause, proven
  with a live test page in the same browser: the cloud
  browser auto-dismisses native `confirm()` without ever
  showing a dialog — it returns false, the handler returns
  early, and nothing happens (no delete, no toast, no
  error). The trip/shop-check deletes worked in the round,
  so the dialog behavior is not uniform — the fix removes
  the whole failure class instead of debugging the dialog:
  piece + wear-entry deletes now use the in-app two-tap
  confirm (`dataset.confirm` + relabeled button, the
  Start-fresh idiom); `openItem` resets the armed state.
  Tests: `tests/pc82-delete.test.js` (7).
- **PC-83 (#149) — stylist judges an attached shop item.**
  Commit `1672837`, askStylist redeployed. Root cause: the
  SYSTEM SCOPE rule ("a Shop check is the right tool for
  buy decisions") outranked the ITEM UNDER CONSIDERATION
  brief, so the model deflected a handoff made on purpose.
  The SCOPE rule now carries an explicit exception: an
  attached shop item gets judged (pairs, duplicates,
  buy/pass); the general deflection stands without one.
  Tests: `tests/pc83-shop-judge.test.js` (3).
- **PC-84 (#150) — "More formal" revises.** Commit
  `4f9b809`, askStylist redeployed + hosting release
  `1795489421505000`. Root cause: the server ITERATION
  rules named directions "warmer/cooler/dressier" — the
  chip's exact words "more formal" mapped onto none of
  them, so the model read it as a fresh formal pick and
  described the base as containing flannel it never had.
  The direction list now names "more formal", a direction
  change must keep MOST of the previous pick, and the
  reply may only describe the base from its listed handles.
  Tests: `tests/pc84-formal.test.js` (5).
- **PC-85 (#151) — reloads never flash empty states.**
  Commit `dc9609a`, hosting release `1795489612613000`.
  Root cause: the static HTML painted "0 pieces" /
  "0 outfits" / "0 saved" plus a visible empty wardrobe,
  and the renderers built empty states from `allItems`
  being `[]` — which is also its value before the first
  snapshot arrives. Counts now paint "…" and the empty
  state starts hidden; an `itemsLoaded` flag (first items
  snapshot, success or error) gates the wardrobe empty
  state, the chat empty state + add-info/demo door, and
  the outfits/shop intro cards. Tests:
  `tests/pc85-loading.test.js` (7).
- **PC-72 regressions — context bar + stock phrases.**
  Commit `333f71a`, askStylist redeployed + hosting
  release `1795489765731000`. (a) `openChat` rendered the
  context line BEFORE `openOverlay`, so the trim measured
  a hidden element (zero width) and bailed, leaving CSS
  ellipsis to cut mid-word ("Trips ar…"); the line now
  renders after the overlay opens and the trim retries
  once on the next frame when it has no layout. (b) The
  prompt banned two example phrases while the model kept
  its own favorites; the observed offenders ("incredibly",
  "timeless, quiet luxury") join the banned list and the
  rule names intensifiers. Tests:
  `tests/pc72-regressions.test.js` (4).

## Retest

QA Round 2, run early at the founder's order ("make all the
fixes and retest"). Scope: the four P1 fixes + the two PC-72
regressions + the core-journey smoke pass. The round ran
from the studio chat (weekly-qa loop) and reported to this
chat. Full report:
`qa-rounds/2026-11-23-round2.md` in the studio goal
workspace.

**Result: 3 verified, 3 failed.** The loop is NOT closed —
the failures go to the next fix sprint (Sprint 34, proposed
to the founder 2026-11-23).

- **PASS — PC-82 (#148, closed).** Piece delete: two-tap,
  "Piece deleted.", wardrobe back to 70 after reload, search
  for "QA Test" returns 0. Wear entry: × → "?", second tap
  deletes, gone after reload.
- **PASS — PC-83 (#149, closed).** The stylist judged the
  attached navy crew-neck shop item (pairs, duplicates,
  buy/pass: "a clear pass… highly redundant") — no
  deflection.
- **PASS — PC-85 (#151, closed).** Four reloads: "Starting…",
  "Every piece …", "Loading wardrobe" only. Never "0
  pieces", an empty stylist, or "0 outfits".
- **FAIL — PC-84 (#150, stays open).** "More formal" on
  Estate Minimalist produced "Sleek Stripe" — 0 of the
  original 4 pieces kept. The reply described only the new
  pieces, so that half held. The fix did not land; the
  cause is unknown and is Sprint 34's first investigation.
- **FAIL — PC-72 regressions (PC-86, PC-88).** (a) The
  context bar in the saved "Evening at The Battery" chat
  still ends mid-word ("Mountain Vie…"; the full string
  exists in the DOM, the rendering clips it). The fix did
  not land — the saved-chat open path evidently does not
  run the trim after the overlay opens. (b) Three-outfit
  asks failed three times with "Something went wrong on
  our end" (refs req_6f7c, req_72b4, req_4f06) while
  single-outfit asks worked in the same session — new card
  PC-88, P0. Stock phrases still repeat ("incredibly" 8×,
  "timeless" 9× in the thread's visible text).
- **FAIL (new) — PC-87 (P1).** Outfit Delete arms
  but never deletes: the button turned red across 7 taps
  in 4 attempts, never deleted, no error. The smoke pass's
  "Heritage Crisp" outfit is stuck until this lands.
- **Smoke pass — PASS.** Capture, stylist pick, wear log,
  Today, trip. Cleanup done except the Heritage Crisp
  outfit (PC-87).
- **Parked P2s from Round 2:** dangling "Unknown item"
  references after piece deletion; the stylist dialog's
  "Today's pick" button is a no-op; duplicate-detection
  false-positive recurs (navy tee flagged as the white
  crew-neck).

Next round: Fri Nov 27 (Thanksgiving trip — records itself
as skipped if the sign-in approval does not arrive).
Scope: re-test PC-84, PC-86, PC-87, PC-88 (P0 first) if
shipped, plus the Today area in depth.
