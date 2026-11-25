# Sprint 35 — The daily surfaces work (proposed)

**Theme:** Today is the home screen and the founder opens it
every day — but it still repeats worn outfits, shows yesterday
after midnight, hides which piece it picked, and has no way
home. Plus the last proven silent-failure class in the client.
**Status:** PROPOSED at the 2026-11-25 planning walk. Founder
approval pending — build starts only on his go.

## Scope

| Card | Issue | Size | What |
|------|-------|------|------|
| Today #135 | #135 | S/M | Tap a suggested piece → its detail sheet |
| Today #136 | #136 | S | An explicit Home destination for Today |
| Today #137 | #137 | S/M | Trip photos show the whole garment, no crop |
| Today #138 | #138 | M | Reset daily state when the local date changes |
| Today #139 | #139 | M | Today stops repeating recently worn outfits |
| PC-90 | #155 | M | The nine remaining native confirm() gates → two-tap |

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

(To be filled as cards land.)
