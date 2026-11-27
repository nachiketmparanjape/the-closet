# Sprint 39 — The cutout and the run must not silently drop work

- **Status:** PROPOSED 2026-11-26 (awaiting the founder's yes).
- **Theme:** QA Round 6 proved the delivery mechanism works
  (the direct call fires, manual generation finishes inside
  budget) — but the work it delivers still drops silently in
  three places. The single-item run starts before the cutout
  exists and standardizes the whole photo; a server cutout that
  outruns its timeout never gets linked, so the item keeps
  showing the original; a background failure tells the user
  nothing at all. And the bulk-add button never resets after a
  run, so a finished sheet reads as stuck. This sprint closes
  those four holes plus the sweatshirt's missing photo.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## The evidence (what Round 6 saw vs what the logs prove)

- The direct call works: all three new items moved with no tap.
  The single-item add ran FLUX and failed "wrong shape" instead
  of landing already_clean. The round's P0 framing ("the
  already-clean check fails on a studio shot") is corrected: the
  navy photo is grey-background, and the check's rule needs >90%
  near-white border or >5% transparency — it correctly returns
  not-clean. The saved Round 6 outputs prove the gates were right
  in all three cases (geometry rejection: a full-bleed FLUX draw,
  0% border-white; color rejection: a proper bordered render;
  pass: a post-SAM cutout). The proven failures are FLUX
  nondeterminism (one photo, three draws) and the cutout race:
  the pipeline snapshots its input once at start, before the
  ~2 min cutout exists, and standardizes the original.
- The founder's Black tee, added the same night: the server made
  the cutout (19.5 MB, verified a real cutout) but the call
  overran the 120s `extractGarment` timeout, so the phone got
  `functions/internal` and the client-side link step never ran.
  The cutout sat in Storage with no link and no download token.
  It was linked by hand the same night; the cutout shows now.
- Two background failures in the round produced NO toast naming
  the piece. The Sprint 38 fix covered only the two foreground
  catch sites; `requestStandardization` swallows errors by design
  and the snapshot listener never toasts on a status change.
- The sweatshirt's photo files are GONE from Storage (both
  404 "No such object"; the render was verified 200 at ~17:00
  the same day). Deletion cause unknown — audit logs return
  nothing. Scope is narrow (spot-checks on three other items
  all 200). The repair is the founder re-adding the photo from
  his phone; no other copy exists.

## Scope

The five cards, in fix order:

| # | Card | Issue | Effort | Why it's in |
|---|------|-------|--------|-------------|
| 1 | PC-109: The single-item direct call races the cutout | #174 | M | The pipeline standardizes the original photo whenever the cutout isn't ready — the PC-94 defect, back through timing |
| 2 | PC-110: extractGarment overruns its timeout and orphans the render link | #175 | M | A cutout the server saved must always show, even when the phone's call times out |
| 3 | PC-102: A background failure's error toast looks like the upload failed | #167 | S/M | The user is told nothing when a background standardization fails |
| 4 | PC-108: Bulk add "Add N pieces" stays disabled after the files show Done | #173 | S | A finished sheet reads as stuck; `bulkFinish()` never resets the button |
| 5 | PC-107: The sweatshirt's stored photo is broken or missing | #172 | S/M | The photo files are gone; the repair is a re-upload plus a placeholder for missing photos |

**Build order note:** PC-109 first (it decides what the pipeline
standardizes from), then PC-110 (the same link step, server side),
then PC-102, PC-108, PC-107. QA Round 7 retests the fixes after
the build, plus the still-untested items (#137 placeholder, #138
rollover, the "Saturday, Nov 14" label — the last only via the
founder's phone check).

## Build results

(TBD — filled as cards ship.)

## Retest

(TBD — QA Round 7 after the build; the founder's manual checks
after QA, per the loop design. Retest targets: a single-item add
standardizes from the cutout; a cutout that outruns its timeout
still shows; a background failure toasts the piece by name; the
bulk button resets after a run; the sweatshirt's photo is back.)
