# Sprint 35 — The daily surfaces work (built — awaiting QA Round 3)

**Theme:** Today is the home screen and the founder opens it
every day — but it still repeats worn outfits, shows yesterday
after midnight, hides which piece it picked, and has no way
home. Plus the last proven silent-failure class in the client.
**Status:** BUILT 2026-11-25 — all six cards shipped, deployed,
committed; awaiting QA Round 3 (Fri Nov 27) + founder phone
verification. Approved 2026-11-25 13:30 PST.

## Scope

| Card | Issue | Size | What |
|------|-------|------|------|
| Today #135 | #135 | S/M | Tap a suggested piece → its detail sheet |
| Today #136 | #136 | S | An explicit Home destination for Today |
| Today #137 | #137 | S/M | Trip photos show the whole garment, no crop |
| Today #138 | #138 | M | Reset daily state when the local date changes |
| Today #139 | #139 | M | Today stops repeating recently worn outfits |
| PC-90 | #155 | M | The thirteen native confirm() gates → two-tap / in-app sheet |

**Retest:** QA Round 3 (Fri Nov 27) already has this scope in
its sights — it re-tests the Sprint 34 fixes and probes Today
in depth. If this sprint ships before Friday, Round 3 tests
these fixes fresh. Note: Nov 27 falls in the Thanksgiving
trip (Nov 26–28); if the sign-in approval does not arrive,
the round records itself as skipped and the sprint's QA
phase moves to the next Friday (Dec 4). Per the QA-loop
design, a sprint-triggered round in a week covers that
week's Friday round.

## Alternates (in order)

1. **PC-89** — blocked intents return action cards, never bare
   refusals (M). Founder's own P1 cluster from the Nov 21
   thread review; PC-83 fixed one instance. Needs a design
   pass first to enumerate the blocked intents.
2. **PC-77–81** — unslop round-2 bundle (5× S): first-paint
   layout shift, empty-state sage panel, modal title split,
   sample pick card, icon alignment.
3. **PC-60 follow-up** — wire the vision judge into the
   calibration script, calibrate all three layers, gate new
   cuts into the per-user review queue (M).
4. **PC-91 / PC-92** — Round 1 parked Today findings, filed
   at this walk: Today surfaces today's wear (P2-7), Today
   drops orphan cards for deleted items (P2-8).

## Walk notes (2026-11-25)

**Trigger checks — none fired.**
- PC-48 (real trip): the Canada trip is Jan 14–24; the
  pre-Canada sprint is its home. In-app trips are test trips.
- PC-49: superseded — shelved by founder decision Nov 23.
- PC-44 (90%+ fetch success) and PC-50 (PC-34 live + PC-36
  verdict): not fired.
- PC-55 (service worker pulled for another reason, or
  recurring share-sheet friction): not fired.
- LayerUp ideas (Nov 7): no new signal; stay parked.
- "Stylist as an agent" idea: graduated in Sprint 31.

**Aging dispositions (open, not started, >1 month old).**
- PC-23 (#42): KEEP PARKED — wardrobe at 70 items;
  archiving earns its keep around 150+.
- PC-24/25/26 (#43–45): KEEP PARKED as a chain — no founder
  decision on gender-aware styling; no styling miss traced
  to it.
- PC-44 (#109), PC-50 (#123): KEEP PARKED (DONE-then-PARKED;
  triggers above not fired).
- UX-14 (#70): KEEP PLANNED — remaining attack lines are
  each their own cut; UX-14a shipped in Sprint 32.
- PC-34 (#75): BUILT — blocked on the founder (add a payment
  method to Replicate for the first live run). Not build work.
- PC-36 (#78): BUILT (Sprint 25) — founder phone validation
  pending. Not build work.
- PC-55 (#125), PC-48 (#114): KEEP PLANNED (triggers above).
- PC-60 (#130): design + calibration shipped; follow-up is
  alternate #3 above.

**Considered, not selected:** PC-73–76 outfit epic (parked —
new-feature work waits for the post-polish phase, per the
founder's Nov 23 direction); UX-14 remaining cuts (L each,
bigger than this sprint's shape); Round 2 parked P2s
(dangling "Unknown item" refs, "Today's pick" button no-op,
duplicate false-positive — stay parked per the loop's
design, except PC-91/92 which are Today-area and filed as
alternates).

**Out of scope:** everything in Sprint 34's retest (Round 3
owns it); the three Round 2 parked P2s above; new features.

## Build results

All six cards built, deployed, committed 2026-11-25. Suite:
**700 passing** (690 in `tests/` + 10 in
`functions/cutout-check.test.js`), gated green before every
deploy.

- **#135 — tap a Today piece → its detail sheet.** New
  `todayPickFigure(id)`: each pick piece is a keyboard-
  accessible control (role=button, aria-label, Enter/Space +
  click → `openItem` for that exact item); a missing/deleted
  piece renders an unavailable state, no handler. Tests
  `tests/today-135-tap.test.js` (5). Hosting release
  `1795642356134000`. Commit `59fa72a`.
- **#136 — Home tab.** A labeled Home tab is now the first
  tab in the bottom bar (`data-view="today"`, `id="tabHome"`),
  shown/hidden with the Today-home setting by `syncTodayChrome`
  (setting off exposes no Home destination). Tests
  `tests/today-136-home.test.js` (6). Hosting release
  `1795642433398000`. Commit `6ad7357`. Browser check
  (2026-11-25, cloud browser): Home is present, first, and
  selected at desktop width; tapping it opens Today and Home
  stays selected. The ~390px label-fit check could not run —
  the cloud window cannot be narrowed — so it stays a
  founder phone check.
- **#137 — trip photos show the whole garment.** `.pack-thumb`
  is now 64×64, `object-fit: contain` on a paper-soft
  background (was 52px cover, which cropped tall trousers and
  wide tops). New `packingThumb(it)` central resolver; a
  missing photo leaves a same-size empty slot so rows stay
  aligned. Tests `tests/today-137-trip-thumbs.test.js` (5).
  Hosting release `1795642520419000`. Commit `d951394`.
- **#138 — Today owns its date.** `todayState.date` +
  `reconcileTodayDate()` / `resetTodayStateFor(date)`;
  reconcile runs on render, on resume, and at the top of
  every daily action (wear, another, rejection, generate).
  A rollover resets picks/idx/wornSet, rebinds the
  `today_picks` listener, and drops midnight-crossing
  generations. Tests `tests/today-138-rollover.test.js` (5:
  seven-day walk Nov 2–8 incl. the DST change, stale
  listener, stale persist, midnight crossing). Hosting
  release `1795642762001000`. Commit `105f4d8`.
- **#139 — Today stops repeating recent outfits.** The server
  reads the last 7 local days of wear events + daily picks on
  Today generations only (`todayGeneration: true` flag; the
  client sends its local-midnight window). The brief names
  worn vs suggested outfits by handle; the base rule is
  spelled out (same top + bottom = same outfit, shoes do not
  count). A repeat triggers the one-shot repair; a
  one-top-one-bottom wardrobe is exempt. Another now states
  the distinct-outfit intent outright. Tests
  `tests/today-139-history.test.js` (18). `askStylist`
  redeployed + hosting release `1795643204346000`. Commit
  `ad587ce`. Fixes the reported example: Monday's worn Campus
  Classic returned Wednesday as "Bay Breeze Classic".
- **PC-90 — the last native confirm() gates.** A grep found
  **13** gates, not the 9 recorded in the PC-87 note — the
  three shop-check gates (delete saved check, clear all
  questions, dupSlot "Save anyway?") were missed. Ten button
  gates two-tap via the shared `armOrRun` helper; three flow
  gates with no button (guest migration, two photo-dupe
  warnings) share one new in-app confirm sheet
  (`askConfirm`). Label resets clear the arm with them, so a
  stale arm can never run silently. Sign-out two-taps for
  guest only (the confirm was guest-only). Live-verified:
  zero `window.confirm(` in the served client. Tests
  `tests/pc90-confirm-gates.test.js` (23). Hosting release
  `1795643568782000`. Commit `6de5be2`.

Harness lesson (recorded in the #138 test): extracted client
functions that call each other by bare name must be assigned
onto `global` in the test, and a FakeDate must implement the
Date methods the code under test uses (`toISOString`, the
multi-arg constructor) — the #139 change broke the #138
generation test until both were fixed. The product code was
never broken; the harness was behind it.

## Retest

QA Round 3 ran Wed Nov 25, 1:55–2:01 PM PST (5 min) —
sprint-triggered, right after the sprint shipped, on the
founder's order ("run the QA round right after sprint so my
manual checks are after QA"). Signed in via the saved Google
session; no phone approval needed. This round replaces the
Fri Nov 27 weekly round. **Five of six cards pass; one P1.**
- **#135 PASS.** Tapping the black polo in Today's feature
  opened exactly that piece's detail sheet.
- **#136 PASS on desktop.** Home tab first, selected; tapping
  it from Outfits opened Today, Home stayed selected.
  Phone-width label fit untested — founder phone check.
- **#137 PASS in part.** All 9 packing photos in the Tahoe
  trip showed the whole garment. Missing-photo empty slot
  untested — every photo in the trip exists.
- **#138 PASS in part.** Today shows "Wednesday, November
  25" and today's picks. True midnight rollover untested live
  (tests cover a seven-day walk incl. DST).
- **#139 PASS.** First pick Morning Transit, second pick
  Pacific Fog — neither repeats Matinee Utility (Nov 14).
  After logging Pacific Fog as worn today, the next pick was
  Shadow and Sand, "shifts away from the grey and off-white
  tones of your last outfit." Caveat: exclusion was proven
  against the wear logged during the pass, not a pre-existing
  in-window wear.
- **PC-90 PASS overall.** Five confirm flows exercised
  (outfit delete, piece delete, trip delete, saved shop check
  delete, clear-conversation "Start fresh") — every one armed
  in-app as a two-tap. Zero native browser confirms. The
  shop-check and conversation flows were armed only, not
  confirmed (real data). P2 note (parked): the wear-entry
  delete arms with no visible label change.
- **PC-91 FAIL (P1).** Logged Pacific Fog as worn today:
  detail "Worn 1× · Nov 25", feature "WORN ✓" — but Today's
  wear card still read "Saturday you wore: Matinee Utility"
  after reload. The card shows no date, so the Nov 14 wear
  reads as this Saturday. Fix pass: Sprint 36 (proposed).
- **PC-92 PASS.** Deleted the QA Test — Tahoe trip; Today
  dropped its trip card immediately, still gone after reload.
  No orphan cards. Close at the next planning walk unless
  kept as regression cover.
- Smoke pass: all passed.
- P2s parked (no cards): PC-84 reply misattribution (above);
  PC-90 wear-entry delete arm label; trip weather chip
  mismatch (trip since deleted); saved shop check "Already in
  your wardrobe" matched to a piece labeled "Unknown item".
- Round 4 scope: retest the PC-91 fix if shipped, plus the
  untested items above (#136 phone-width, #137 empty slot,
  #138 rollover, #139 pre-existing in-window wear, shop-check
  clear-questions control). Full report:
  `qa-rounds/2026-11-25-round3.md`.
