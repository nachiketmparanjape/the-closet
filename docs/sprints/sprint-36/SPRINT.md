# Sprint 36 — Close the loop, third pass (proposed)

**Theme:** Round 3 found one P1: Today does not show a wear
logged today. The wear is saved; only the card is stale.
**Status:** APPROVED 2026-11-25 16:24 PST — founder tapped
"Yes — open Sprint 36 for PC-91". Build order: PC-91.

## Scope

| Card | Issue | Size | What |
|------|-------|------|------|
| PC-91 | #156 | S/M | Today surfaces a wear logged today, with a date |

**Retest:** QA Round 4 retests the PC-91 fix, plus the
Round 3 untested items (#136 phone-width label fit, #137
missing-photo empty slot, #138 midnight rollover, #139
exclusion against a pre-existing in-window wear, shop-check
clear-questions control). Per the QA-loop design, the
founder's manual checks come after QA.

## Alternates (in order)

None filed for this sprint — a single-card fix pass, per
the QA-loop design (one fix pass covers the filed P1 cards).

## Investigation (PC-91)

Root cause, proven from the code before any fix (Sprint 34
rule: a fix whose cause is unknown is a guess).

The wear card lives in `renderTodayThread`
(`public/index.html`, the "Rate card"). It queries the 8
most recent `wear_events` (`orderBy("wornAt", "desc")`) and
takes the first entry whose local date is **strictly before
today**: `if (ds < todayStr && w.outfitId)`. A wear logged
today has `ds === todayStr`, so the selector skips it and
takes the next one — Matinee Utility (Nov 14). The detail
view reads the same `wear_events` collection without that
filter, which is why the detail says "Worn 1× · Nov 25"
while the card says "Saturday you wore: Matinee Utility".
Even a full reload cannot fix it: the filter, not a stale
cache, is the cause.

Second defect in the same card: the label carries no date.
`whenLabel` is "Yesterday" or a bare weekday ("Saturday").
Nov 14 and Nov 21 are both Saturdays, so the old wear reads
as this Saturday.

Fix (two layers, one card):
1. Prefer today's wear when one exists; fall back to the
   latest pre-today wear (the rating intent stays). Resolve
   the outfit inside the selection loop, so a wear whose
   outfit is gone no longer blocks an older resolvable wear.
2. The label gains a date: "Today" for today, "Yesterday"
   for yesterday, else weekday + short date ("Saturday,
   Nov 14").

## Build results

- **PC-91 (#156) — SHIPPED 2026-11-25.** Cause proven from
  the code before the fix: the rate card's selector took the
  first wear with `ds < todayStr`, so a wear logged today
  was excluded by the filter itself — even a reload could not
  fix it. The detail read the same `wear_events` without
  that filter, which is why the detail said "Worn 1× ·
  Nov 25" while the card said "Saturday you wore: Matinee
  Utility". The label also carried no date, so the Nov 14
  wear read as this Saturday.
  - Fix: new `pickWearCard` helper — today's wear first,
    else the latest pre-today wear (the rating job stays);
    a wear whose outfit is gone is skipped, never a dead
    end. New `wearCardWhenLabel` helper — "Today" /
    "Yesterday" / weekday + short date ("Saturday, Nov 14").
    `todayWear` already calls `renderToday()` after logging,
    so the card updates immediately as well as after reload.
  - One test-harness slip en route: the new test's `byId`
    looked up outfits by key instead of by id, so every
    lookup returned null. The product code was never broken;
    the test was fixed. Suite **711 passing** (701 in
    `tests/` incl. new `tests/pc91-wear-card.test.js` with 11
    tests + 10 in `functions/cutout-check.test.js`), client
    syntax OK, gate run before deploy.
  - Hosting release `1795652844529000` (2026-11-26 00:27
    UTC); live-verified (new helpers present, old filter
    gone). Commit `af0648c`, pushed — the push first failed
    (a config scrub had dropped the git credential helper);
    restored with `gh auth setup-git` and pushed.
  - Phone check for the founder: log a wear today → Today's
    card reads "Today you wore: {name}" right away, and still
    after reload; an older wear reads "Saturday, Nov 14 you
    wore: …" with its date.

## Retest

QA Round 4: retests the PC-91 fix, plus the Round 3
untested items (#136 phone-width label fit, #137
missing-photo empty slot, #138 midnight rollover, #139
exclusion against a pre-existing in-window wear, shop-check
clear-questions control). The founder's manual checks come
after QA.
