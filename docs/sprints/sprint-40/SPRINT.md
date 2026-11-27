# Sprint 40 — The failure must be heard, and the review must show the truth

- **Status:** APPROVED by the founder 2026-11-26 ("Yes — open Sprint 40 for the three fixes").
- **Theme:** Sprint 39 closed the silent drops in the delivery
  mechanism — but QA Round 7 proved the failure path itself is
  still silent, and the review comparison can show the wrong
  render. A standardization failure never toasts at all: the
  server swallows it before the app can hear it, and the app
  skips the toast when the user is looking at the item's page.
  A manual retry tap never even reaches the server. And the
  review gate can present a render the gates never judged: the
  gates fail open when they error, and the pending render sits
  at a fixed public address with no version. This sprint makes
  failures audible and reviews truthful.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## The evidence (what Round 7 saw vs what the logs prove)

- **PC-102 — the toast never fires, two silences, one
  correction.** The large navy tee's automatic run failed the
  color gate (systematic, ΔE=74.8 then 76.6) and its manual
  retry failed again — zero toasts in either window, while QA
  watched the item page. CORRECTION to the Round 7 closeout:
  the `standardizeItem` callable does NOT swallow pipeline
  failures — its outer catch ends with `await boundary(...)`
  and `boundary()` throws an HttpsError, so a gate failure
  DOES reach the client's `.catch`. The 'swallow' claim was
  inferred from the missing toast, not read from the code, and
  is withdrawn; no server change is needed on that path. The
  two real silences: (1) the Sprint 39 snapshot listener skips
  the open dialog's item by design (`toastNewStdFailures`: `if
  (activeItemId === it.id) continue`) — QA watched the item
  page during both failures, so the background path was
  silenced. (2) The manual Generate QA tapped at ~23:16 never
  sent a request: Cloud Run logs show NO standardizeItem
  request 07:14–07:18Z (5 requests in the whole round window:
  3 single-auto + 2 bulk-auto), and no `client_errors` entry
  in the window — the page kept showing the automatic run's
  failure note, which QA read as "failed again". Cause proven
  from the code: the Generate button is two-tap (`armOrRun`),
  and the attribute sheet's Continue ($0.03) is consumed as
  the FIRST (arming) tap — it arms the button and returns
  without calling. The user must tap Generate again after the
  sheet closes, with only a transient cost toast saying so.
  A third, smaller silence: the callable's
  `{ failed: true, reason: "max_attempts_reached" }` return
  resolves successfully and neither `.then` handler toasts on
  it. And a dedupe gap the fix must close: the catch toasts on
  the catalog message while the snapshot toasts on the
  pipeline's `lastError` — different keys, so removing the
  skip alone would double-toast one failure; the dedupe key
  becomes the item alone (10-min expiry).
- **PC-107 item page — does not reproduce after the round.**
  QA saw an empty dashed box at 23:19, mid-round. A live
  browser repro at 23:32 (same item, same dialog) shows the
  named "Photo missing" placeholder on both the item page and
  the tile — `itemPhoto.src` is the data-URI SVG, 2 decoded,
  0 pending, 0 unavailable. The likely cause is the snapshot
  refresh: during the round, test items were created/deleted
  every few seconds, and every snapshot calls
  `showDisplayPhoto` on the open dialog, resetting the photo
  to the dead URL mid-chain — the retry→fallback→placeholder
  chain never settles while the wardrobe churns. After the
  round ended, the chain completed and the placeholder stuck.
  The fix gates the snapshot photo refresh on the display URL
  actually changing (a cutout landing, a standardization
  completing) — unchanged URL, leave the image alone.
  (One transient: an early gallery inspection showed a
  differently sized/styled placeholder SVG, 800×1000 Georgia
  serif. No second placeholder exists in the client code; the
  final inspection showed the 400×400 sans-serif one on both
  surfaces. Left unexplained, not a card.)
- **PC-111 — the gates caught the bad draw; the review path
  did not.** The red tee's run: attempt 1 failed color at
  ΔE=31.0, the cutout landed, attempt 2 passed — the pending
  file was the correct render within a minute of being written.
  Yet QA saw a NAVY render in the comparison at 23:14 and the
  correct brown one at 23:22, with no user action. The navy
  image itself is unexplained and unrecoverable (the test item
  was deleted at cleanup; the attempt-1 render was never
  persisted anywhere displayable). Two live defects in the
  symptom class: the gates fail OPEN on exception
  (`gateColorFidelity` / `gateGeometry` return `{ pass: true,
  deltaE: 0 }` on error, with no log line — a gate that cannot
  run lets the render through silently), and the pending render
  sits at a fixed public URL (`standardized-pending.png`,
  `makePublic`, stable URL, no version or cache-buster), so a
  re-run overwrites it in place and a viewer can show a stale
  render at review time. The pipeline's log lines also carry no
  item id, so the run was identified only by timestamp
  correlation.

## Scope (fix order)

| # | Card | Size | What ships |
|---|------|------|-----------|
| 1 | PC-102 (#167) | M | Client only — no server change (the callable already throws via `boundary`). The snapshot listener drops the open-dialog skip — the shared `toastStdFailureOnce` dedupe (now keyed on the item alone, 10-min expiry, so the catch and the snapshot cannot double-toast one failure) already guarantees at most one toast per item per window. The attribute sheet's Continue counts as the confirmation: `proceedWithGenerate` skips the arm when it arrives from the sheet, so the generation starts instead of arming and dying. Both `.then` handlers toast when the server returns `{ failed: true }` (max attempts), which previously resolved silently. |
| 2 | PC-111 (#176) | M | The gates fail CLOSED on exception (a gate error fails the run, logged, instead of passing silently). The pending render is versioned per run (attempt-stamped path or a token query param on the review URL), so the comparison a user approves from is the render the gates actually judged. The pipeline's log lines carry the item id. |
| 3 | PC-107 (#172) | S | The snapshot photo refresh only re-sets the open dialog's photo when the fresh doc's display URL changed; an unchanged URL leaves the image (and its error chain) alone. |

## Build results

- **PC-102 (#167) — client only, no server change.** The
  correction first: the callable does NOT swallow failures —
  `boundary()` throws, so a gate failure does reach the
  client's `.catch` (the Round 7 'swallow' claim was inferred,
  not read, and is withdrawn in the BACKLOG, the Sprint 39
  Retest, and a correction comment on #167). What shipped:
  the snapshot listener drops the open-dialog skip; the
  dedupe key is the item alone (10-min expiry) so the catch
  (catalog message) and the snapshot (pipeline lastError)
  cannot double-toast one failure; the attribute sheet's
  Continue counts as the confirmation (`proceedWithGenerate`
  skips the arm when it arrives from the sheet, so the
  generation starts instead of arming and dying — Round 7's
  dead tap); both `.then` handlers toast the server's silent
  `{ failed: true }` return. 20 tests in
  `tests/pc102-standardize-toast.test.js` (4 new pins).
- **PC-111 (#176) — server.** The gates fail closed:
  `gateColorFidelity` / `gateGeometry` return `{ pass: false,
  reason: "gate-error:..." }` on exception (was `pass: true`,
  silently), and `runQualityGates` surfaces a gate-error
  reason verbatim. The pending render is versioned per run
  (`standardized-pending-<Date.now()>.png`); approve reads
  `pendingStoragePath`, so the stamped path flows through.
  Every pipeline log line carries the item id
  (`[standardize-pipeline:<itemId>]`, threaded through
  `resolvePipelineInput` / `persistInputKind` too). 3 new
  gate tests in `functions/standardize.test.js`, 2 new
  pipeline tests.
- **PC-107 (#172) — client.** New `dialogPhotoNeedsRefresh`:
  the snapshot refresh re-sets the open dialog's photo only
  when the fresh doc's display URL changed (a cache-busted
  retry URL compares equal to its base; a placeholder
  refreshes only when a real photo landed). 7 new tests in
  `tests/pc107-missing-photo.test.js`.

Suite: **839 passing, 0 fail** (full gate before deploy; was 823, +16).

Deployed: `standardizeItem` updated (nodejs22, 300s/1Gi,
updateTime 2026-11-27T07:53:14Z); hosting release
`1795766008245000` (2026-11-27T07:53:28Z); live HTML carries
`dialogPhotoNeedsRefresh` ×2, `fromSheet` ×6. Audit
`scripts/verify-function-secrets.js`: 20 functions checked,
secrets + config clean; only the 14 known nodejs20 runtimes
remain (PC-99).

## Retest

QA Round 8, Thu Nov 26 11:54 PM – Fri Nov 27 12:06 AM PST
(11 min, signed in, spanning midnight). No P0, one P1 open
(unverified), four P2s parked. Full report:
`~/workspace/goals/one-man-studio-operating-system/hidden_files/qa-rounds/2026-11-26-round8.md`.

- **PC-102 (#167) — UNVERIFIED.** No failure toast was observed
  anywhere — because no run failed. Both photos that failed the
  color gate in Round 7 passed this round (2 automatic runs + 1
  manual retry, all succeeded). The manual-retry start and the
  max-attempts toast remain untested. Note: this says nothing
  about Sprint 40 changing gate behavior — the gates' thresholds
  are untouched by Sprint 40 (only the error branches changed),
  and FLUX is nondeterministic (proven Round 6: one photo, three
  draws, three outcomes). The toast requirement is still open.
  Round 9 plan: force a failure deterministically — add a blank
  photo and tap Generate (force bypasses the already-clean
  check); the color gate fails "no-garment-pixels" and the toast
  must fire. If that still does not reproduce, the card stays
  open until a real failure toasts (or does not) in normal use.
  Open question from the round (unconfirmed, not a bug): the
  bulk-added red tee showed a "Generate standardized view"
  button and no pending render ~3 min after its bulk add
  finished — its state was not established before deletion,
  so if that run had failed, no toast was seen either. Round 9
  must establish an item's state before deleting it.
- **PC-107 (#172) — PASS.** The sweatshirt's dialog showed the
  named placeholder at every snapshot through a bulk add of 2
  pieces mid-run (00:02–00:04), and it stayed settled after the
  churn stopped. No blank box, no flicker. Its attempts remain
  at 6, untouched.
- **PC-111 (#176) — PASS.** Pending render URLs are run-stamped
  (`standardized-pending-<digits>.png`, two items verified);
  after the second standardization landed, the first item's
  review still showed its own render — no overwrite. The
  gate-error case was not observed live (5 runs, none hit a
  gate error).
- **#138 — PASS.** The app was left open across midnight; Home
  then read "Good morning." and "Friday, November 27".
- **"Saturday, Nov 14" label — UNTESTED.** Not reachable
  without deleting the real Nov 25 wear.
- **P2s parked:** same red photo gets different colors/names in
  the two add flows (single: "Dark brown", #221111; bulk: "Red");
  the display name differs from the saved name (recurs); the
  "Piece added" toast stays visible 4+ minutes (recurs); the
  bulk red tee's unestablished state (above).

Costs: $0.03 (one manual retry). Cleanup verified: 4 test
items deleted; wardrobe back to 72, outfits 10, trips 0. The
Nov 25 wear and the Olive joggers' pending render are
untouched.

This round does NOT cover a Friday weekly round (next Friday
round Dec 11). Round 9 scope: retest PC-102 with the forced
failure above; the PC-111 gate-error case if it can be forced;
the "Saturday, Nov 14" label via the founder's phone check.
