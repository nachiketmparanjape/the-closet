# Sprint 39 — The cutout and the run must not silently drop work

- **Status:** APPROVED by the founder 2026-11-26 ("Yes — open Sprint 39 for the five fixes").
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

- **PC-109 (#174) — SHIPPED 2026-11-26.** The pipeline input is
  now live, not snapshotted once. `resolvePipelineInput` (extracted
  from the PC-94 inline code) resolves cutout-vs-original from one
  photo entry; the pipeline calls it at start, waits briefly for the
  render when the item is fresh (created <3 min ago, up to 60s,
  5s polls, deadline-aware with a 120s reserve, skipped on force),
  and re-checks the doc before every later attempt — if the cutout
  landed, the input switches (buffer + color anchor reloaded, the
  systematic-stop comparison reset, inputKind persisted). inputKind
  is persisted best-effort as soon as it is known, so a failed run
  leaves a trace (the Black tee's doc had none). 5 new tests in
  `functions/standardize-pipeline.test.js` (grace wait finds the
  cutout / gives up / skipped for old items; cutout lands before
  attempt 2 and the stop resets; inputKind persisted on failure).
  Two test-expectation fixes en route were the tests' own (positional
  `db.updates[0]` after the new early persist; a get() fake that
  returned the pre-cutout doc on its first call). Deployed:
  `standardizeItem` updated (300s/1Gi).
- **PC-110 (#175) — SHIPPED 2026-11-26.** The server owns the link
  now. `extractGarmentPhoto` mints the download token at save time
  (`firebaseStorageDownloadTokens` in the render's metadata) and
  builds the renderUrl from it, so a saved render is reachable from
  the moment it exists. New `linkRenderToItem` writes the render
  fields to the item doc itself (photo entry matched by storagePath;
  full set on a pass, only renderStatus "rejected" on a gate
  rejection, mirroring the client) — best-effort, never failing the
  extraction; parse-flow photos (no item yet) are left alone. The
  client's patchPhotos stays as an idempotent second write. Timeout
  120s → 300s (code + function-config.json; the Black tee's call
  died at 123s). New `functions/extract.test.js` (5 tests: full pass
  with token + link, mask rejection writes only status, parse photo
  untouched, link patches the matching entry, no-op without a db).
  Deployed: `extractGarment` updated (300s/1Gi, nodejs22 — the
  fleet's nodejs20 count drops 15 → 14).
- **PC-102 (#167) — SHIPPED 2026-11-26.** One toast per failure,
  from any path. New `toastStdFailureOnce` (dedupe key item+reason,
  10-min expiry) shared by the two foreground catches and the new
  `toastNewStdFailures`, which the snapshot listener runs on every
  update: a status→failed transition toasts once, only when recent
  (lastAttemptAt within 10 min) and never for the open dialog's item
  (its page already shows the PC-98 reason). `tests/pc102-standardize-toast.test.js`
  now 16 tests (dedupe, expiry, ref, transition-once, old-failure
  silence, open-item silence, processing silence).
- **PC-108 (#173) — SHIPPED 2026-11-26.** One rule for the bulk
  confirm button: new `syncBulkStartBtn` (label counts queued jobs,
  enables only while something is queued), used by file selection,
  the duplicate-skip path, and `bulkFinish` — which never touched
  the button before. New `tests/pc108-bulk-button.test.js` (7 tests).
- **PC-107 (#172) — SHIPPED 2026-11-26.** A missing photo shows a
  named placeholder, never a blank box. New `photoPlaceholderDataUri`
  (data-URI SVG: cream, dashed border, "Photo missing" + the item
  name, truncated + XML-escaped); `showDisplayPhoto` uses it when an
  item has no photos at all (it used to remove src). One photo-error
  rule for every display photo: `handleDisplayPhotoError` (retry once
  cache-busted, fall back to the original, then the placeholder) +
  `handleDisplayPhotoLoad` (reset), wired by showDisplayPhoto on
  every img it sets — replacing the itemPhoto-only listeners (same
  behavior, every surface). One real bug caught by the tests en
  route: the fallback did not consume the original's own retry, so a
  dead original looped retry → fallback forever; the fallback now
  records the original as the failing base. New
  `tests/pc107-missing-photo.test.js` (11 tests); PC-103 pins updated
  to the shared handler. The sweatshirt's photo restore itself is
  still the founder's re-upload (no other copy exists).

Suite: **823 passing, 0 fail** (full gate before deploy; was 786, +37).

Deployed: `standardizeItem` + `extractGarment` updated;
hosting release `1795763213256000` (2026-11-27T07:06:53Z); live HTML
carries `toastStdFailureOnce` ×4, `syncBulkStartBtn` ×4,
`photoPlaceholderDataUri` ×3, `handleDisplayPhotoError` ×3. Audit
`scripts/verify-function-secrets.js`: 20 functions checked, secrets
+ config clean; only the 14 known nodejs20 runtimes remain (PC-99).

## Retest

QA Round 7, Thu Nov 26, 11:08–11:23 PM PST (14 min, signed in).
No P0, two P1s, four P2s. Full report:
`~/workspace/goals/one-man-studio-operating-system/hidden_files/qa-rounds/2026-11-26-round7.md`.

- **PC-109 (#174) — PASS.** Single-add navy tee standardized
  from the cutout; render in pending_review in ~1–1.5 min,
  correct color. Generate never tapped.
- **PC-110 (#175) — PASS.** 7.3 MB iPhone photo's cutout on
  both tile and item page ~1 min after upload. (Its automatic
  standardization then failed the color gate — the gate
  working, not the link.)
- **PC-102 (#167) — FAIL (P1).** Zero toasts on either failure.
  Cause proven the same night, corrected once: the callable
  does NOT swallow failures — `boundary()` throws, so a gate
  failure does reach the client's `.catch` (the earlier
  'swallow' claim was inferred, not read, and is withdrawn).
  The real silences are (a) the snapshot listener skips the
  open dialog's item by design, and QA watched the item page
  during both failures; and (b) the manual Generate never sent
  a request — the attribute sheet's Continue ($0.03) is
  consumed as the Generate button's FIRST (arming) tap, so the
  generation never starts and the user must tap again with
  only a transient toast saying so. The page kept showing the
  automatic run's failure note, which QA read as 'failed
  again'.
- **PC-108 (#173) — PASS.** Bulk button reset to 'Add pieces'
  and disabled after both rows showed Done; wardrobe 75 → 77.
- **PC-107 (#172) — PARTIAL.** Tile PASS (named placeholder),
  packing row PASS (#137 — mini placeholder, no alt spill),
  item page FAIL (P2): the large photo area stays an empty
  dashed box with no text or name — observed 23:19, mid-round.
  A live browser repro at 23:32 does NOT reproduce it (the
  item page shows the named placeholder, `itemPhoto.src` is
  the data-URI SVG, 2 decoded, 0 pending): the likely cause is
  the snapshot refresh resetting the dialog photo mid-chain
  while the wardrobe churned during the round. Fix scoped for
  Sprint 40 (refresh only when the display URL changes).
- **PC-111 (#176) — NEW (P1).** A wrong-color render reached
  review: the red tee's comparison showed a NAVY render at
  23:14, correct dark brown by 23:22, no user action. Server
  logs prove the gates caught the bad draw (attempt 1 color
  ΔE=31.0 fail, cutout landed, attempt 2 passed) — the navy
  image itself is unexplained and unrecoverable (item deleted
  at cleanup). Live defects in the symptom class: the gates
  fail OPEN on exception (pass:true, deltaE:0, silently), and
  the pending render sits at a fixed public URL with no
  versioning.
- **#139 — PASS.** The stylist's outfit for tomorrow avoided
  the Nov 25 top+bottom pair.
- **Still untested:** #138 rollover, the "Saturday, Nov 14"
  label (needs the founder's phone; cannot be reached without
  deleting the real Nov 25 wear).
- **P2s parked:** tile shows an auto-derived label instead of
  the typed name (recurs); bulk duplicate guard false-positive
  (navy matched to red); trip save with an unrecognized
  destination silently does nothing.

Costs: $0.18 (6 attempts). Cleanup verified: 5 test items + test
trip deleted; wardrobe back to 72, outfits 10, trips 0. The Nov 25
wear and the Olive joggers' pending render are untouched.

Fix pass proposed as Sprint 40: PC-102 (re-throw after boundary;
drop the open-dialog skip; repro the dead manual tap), PC-107
item page, PC-111 (gates fail closed; version the pending URL;
itemId in pipeline logs).
