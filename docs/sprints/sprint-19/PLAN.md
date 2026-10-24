# Sprint 19 — Feeling + Trips Completion

_Founder approved 2026-10-24 ("current plan looks good"), with one
correction that re-ranked the top two cards — see the walk.
Batch, not timebox._

## Goal

Make the app *feel* finished at the layer everything passes
through (sheets), finish the trips arc, and clear the two small
debts that keep resurfacing (beginner guidance, prose titles) —
so the next big pulls (UX-14, OBS-2, threads) land on a surface
that isn't fighting them.

## Planning walk (2026-10-24, full inventory per the hard rule)

- **Backlog:** every card reviewed. Parked triggers checked —
  BUG-1 has not recurred (stays parked); PC-23's trigger ("deleted
  something I wanted back") has not fired; PC-24/25/26 stay
  parked. Untriaged ideas are historical/absorbed.
- **Inbox:** nothing untriaged; the teardown ratification line
  was the newest entry and is executed in this walk (below).
- **GitHub issues:** 10 stale mirrors of shipped work closed as
  ship-flow hygiene (#41, #57, #58, #59, #61, #63, #71–#74).
- **Aging rule:** no open item crosses the one-month line yet
  (oldest are 2026-10-18/19). Warning recorded: at the next walk
  the parked cluster (BUG-1, PC-23/24/25/26) crosses it and each
  will need an explicit keep / kill / split disposition.
- **UX-12 disposition:** closed into UX-14, per the Sprint 18
  recommendation (the redesign was its revisit trigger; UX-14
  subsumes the tutorial question).
- **Founder correction (2026-10-24):** the Vancouver trip object
  in the app (Oct 29 → Nov 6) is a *test harness*, not real
  travel — he is not going to Vancouver. The real Canada trip is
  Jan 14–24, 2027 (Whistler). Effect on ranking: PC-31 loses its
  "five-day proving window" urgency (the deadline is now the
  January trip — comfortable), so UX-15 takes the #1 slot on
  daily-experience value; the slate itself is unchanged. The
  in-app Vancouver trip remains the dev/test harness for trip
  features.
- **Teardown business (ratified system):** Essembl P3 run in
  this walk — dispositions in
  `~/workspace/studio/research_notes/teardowns/essembl.md`.
  One adopted candidate (chat reference attachments) thrashed
  into PC-38 in BACKLOG.md; it competes at the next walk —
  adoption is not scheduling. Alta's package pass held to a
  future slate (one-teardown-per-slate discipline).

## Cards

### 1. UX-15: Sheets & popups feel native (M) — Stylist/Catalogue (all surfaces)
Full card in BACKLOG.md. Motion both ways, swipe-down, dismissal
parity across all 13 overlays; backdrop-tap parity already shipped
in the 2026-10-23 fix buffer, so this cut is the motion system +
swipe + focus discipline + DESIGN.md §5 made true.
**Acceptance:** on the founder's phone, every sheet opens/closes
with visible smooth motion, dismisses by backdrop tap and
swipe-down, nothing teleports.

### 2. PC-31: Trips Phase 3 (M) — Loop (Trips)
Full card in BACKLOG.md. Trip-tagged shop items + unified trip
view (packing + tagged shop items in one place). `tripId` already
exists on shopChecks; the tagging UI and unified view are the work.
**Acceptance:** a shop check can be tagged to the Vancouver
(test) trip from its detail; the trip page shows packing +
tagged shop items together; the generic Shop list is unchanged.
Real deadline: well before the Jan 14, 2027 Whistler trip.

### 3. PC-35: Beginner guide — ways to add clothes (S) — Catalogue
Full card in BACKLOG.md. "Ways to add your clothes" guide, one
tap from the empty states and the Add flow; three paths incl.
the Google Photos download-then-add path, stated honestly.
**Acceptance:** per the card — reachable in one tap, readable
in under a minute, followable without guessing a step.

### 4. NAMING-1: Short-name standard at the data level (S/M) — Catalogue/Stylist
Full card in BACKLOG.md. `shortName` minted at creation by
describeItem / shopCheck / outfit save, one-time backfill,
cards and detail headers read shortName; prose stays in detail
bodies. Display-layer interim fix shipped 2026-10-23.
**Acceptance:** per the card — no card title over ~6 words or
cut mid-word, anywhere.

### 5. Fix buffer (S, standing)
Founder phone findings as they come: the Warm Editorial waves
verdict (W1–W5 + the two fix buffers), PC-37 retest, and any
capture/location follow-ups. Founder's phone is the gate for
each item; nothing in this buffer is "shipped" until he says so.

## Held for the next pull (with reasons)

- **OBS-2** (M): strong, invisible plumbing — first in line at
  the next walk.
- **PC-32 / PC-33** (M each): proposal-stage; PC-33's pin-
  discipline half can split out as an (S) if the founder wants
  it sooner.
- **PC-36**: rides on PC-34 going live — gated on the founder's
  Replicate token (his laptop step, parked, no nagging).
- **UX-14** (L): deserves its own batch; subsumes UX-12.
- **PC-38** (new, from Essembl P3): filed sprint-ready;
  competes at the next walk.

## Founder gates already open (not sprint cards)

- Warm Editorial verdict (his phone) — steers any design fixes.
- Replicate token version on `REPLICATE_API_TOKEN` (his step) →
  unblocks extractGarment deploy + smoke + phone validation.
