# Sprint 40 — The failure must be heard, and the review must show the truth

- **Status:** PROPOSED 2026-11-26 (awaiting the founder's yes).
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

- **PC-102 — the toast never fires, two independent silences.**
  The large navy tee's automatic run failed the color gate
  (systematic, ΔE=74.8 then 76.6) and its manual retry failed
  again — zero toasts in either window, while QA watched the
  item page. Proven from the code: (1) the `standardizeItem`
  callable's outer catch (`functions/index.js`) calls
  `flushAiUsage` + `boundary` and then returns nothing, so the
  client gets success-with-null data and both foreground
  `.catch` handlers — the only toast sites for a manual run —
  never fire on a gate failure. They only ever fired on
  transport errors, which is why Round 5's toast appeared (the
  60s-timeout kill) and Rounds 6–7's never did. (2) The Sprint
  39 snapshot listener skips the open dialog's item by design
  (`toastNewStdFailures`: `if (activeItemId === it.id)
  continue`) — QA watched the item page during both failures,
  so the background path was silenced too. (3) The manual
  Generate QA tapped at ~23:16 never reached the server at all:
  Cloud Run logs show NO standardizeItem request 07:14–07:18Z
  (5 requests in the whole round window: 3 single-auto + 2
  bulk-auto), and no `client_errors` entry in the window — the
  page kept showing the automatic run's failure note, which QA
  read as "failed again". Where the tap dies (attribute sheet /
  save path) is not yet established; the fix includes a live
  repro of that tap.
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
| 1 | PC-102 (#167) | M | The callable re-throws after `boundary` so a pipeline failure reaches the client's `.catch` (foreground toast fires on a gate failure, not just on transport errors). The snapshot listener drops the open-dialog skip — the shared `toastStdFailureOnce` dedupe already guarantees at most one toast per (item, reason) across both paths. Live repro of the dead manual tap (attribute sheet / save path) and fix wherever it dies. |
| 2 | PC-111 (#176) | M | The gates fail CLOSED on exception (a gate error fails the run, logged, instead of passing silently). The pending render is versioned per run (attempt-stamped path or a token query param on the review URL), so the comparison a user approves from is the render the gates actually judged. The pipeline's log lines carry the item id. |
| 3 | PC-107 (#172) | S | The snapshot photo refresh only re-sets the open dialog's photo when the fresh doc's display URL changed; an unchanged URL leaves the image (and its error chain) alone. |

## Build results

(TBD — filled as cards ship.)

## Retest

(TBD — QA Round 8 after the build; the founder's manual checks
after QA, per the loop design. Retest targets: a background
failure toasts the piece by name once, from the item page and
from elsewhere; a manual retry on a failed item reaches the
server; a gate error never presents a render for approval; the
sweatshirt's item page shows the named placeholder even while
the wardrobe churns; #138 rollover; the "Saturday, Nov 14"
label.)
