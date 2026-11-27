# Sprint 41 — A new failure must be heard, even from the same piece

- **Status:** APPROVED by the founder 2026-11-27 ("Yes — open Sprint 41 for the toast fix").
- **Theme:** Round 9 forced a failure on purpose and the first
  failure toasted exactly once — but the retry's failure toasted
  zero times, and the stale "Generating…" toast stayed on screen
  five minutes after the run had already failed. The Sprint 40
  dedupe fixed the double-toast and broke the second failure:
  it keys on the item alone, so a new run's failure looks like
  the same failure re-announced. This sprint dedupes per run,
  not per item.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## The evidence (what Round 9 saw vs what the code proves)

- **PC-102 — the retry's failure is silent, cause proven.**
  The blank photo's first failure toasted exactly once from the
  item page (~7:54). The retry's failure (~7:58) toasted zero
  times from the Wardrobe tab, and the "Generating…" toast
  stayed on screen ~5 min after the run had already failed
  into the max-attempts state. Cause proven from the code:
  `toastStdFailureOnce` keys on the item alone
  (`var key = itemId`, 10-min expiry) — Run 2's failure hit
  the same key as Run 1's and was suppressed on EVERY path.
  The snapshot listener DOES detect the new transition
  (`toastNewStdFailures`: prev "processing" → "failed" passes
  the `prev === "failed"` check) but the dedupe kills the
  toast; the foreground catch/then hit the same key. The
  "Generating…" toast (`showToast` at line 4372) is never
  dismissed on failure; it only disappears when another toast
  replaces it — so with the failure toast deduped away, it
  lingers and misleads. The max-attempts toast was not
  observed either (same suppression).
- **PC-102 — "Try again" two-tap is the designed confirm, not
  a bug.** Round 9 recorded a FAIL here against a criterion
  the delegation set ("must START with no second tap"), which
  conflated the Round 7 sheet bug with this button. The code:
  the Generate/Try again button is wrapped in `armOrRun`
  (line 4363) — the first tap arms ("Tap again to generate"
  + cost toast), the second starts the run. The Sprint 40
  sheet fix only skips the arm when the attribute sheet IS
  the confirmation, and no sheet appears on this path (the
  blank item had no missing attributes). The cost is disclosed
  before charging, which is the point of the confirm idiom
  (PC-90). Whether Try again stays two-tap or goes one-tap
  is a founder decision — it is NOT in this sprint's fix
  scope unless he says so.

## Scope (fix order)

1. **PC-102 (#167) — dedupe per run.** Clear the
   `stdFailureToasted` entry for an item when a new run starts
   (the snapshot listener sees the status leave "failed", and
   the foreground Generate handler clears it at call start),
   so a new failure always toasts once — from the item page
   and from elsewhere — and replaces the "Generating…" toast.
   A re-announced old failure still dedupes (the snapshot
   path's `prev === "failed"` check already skips it; the
   foreground path fires once per call). Client only, no
   server change. Tests in `tests/pc102-standardize-toast.test.js`.
2. **QA Round 10** after the build: retest the retry +
   max-attempts toast with the same forced failure (blank
   photo + manual Generate); the PC-111 gate-error case if it
   can be forced; the "Saturday, Nov 14" label via the
   founder's phone check.

## Open question (founder's call, not a fix)

- "Try again" on a failed item: keep the two-tap cost confirm
  (current behavior, cost disclosed before charging) or make
  it start on the first tap? If he picks one-tap, it lands in
  this sprint as a second card; if he keeps two-tap, the Round
  9 finding on this point closes as by-design.

## Build results

- **PC-102 (#167) — client only, no server change.** The
  dedupe is per run now, not per item. New
  `clearStdFailureToast(itemId)` deletes the entry; it runs
  in three places: both foreground call sites clear it just
  before `callStandardize` (Generate + Refresh), and the
  snapshot listener clears it when a run starts
  (`toastNewStdFailures`: status "processing" with prev not
  "processing" — this covers runs started anywhere else: the
  direct call, the sweeper, another tab or device). A
  re-announced old failure still stays quiet (the snapshot
  path's `prev === "failed"` check is untouched, and the
  10-min expiry stands). A fired failure toast replaces the
  "Generating…" toast via `showToast`, as before. Note on the
  stale-toast question: the code auto-hides toasts after 3 s
  (`showToast` sets a 3 s timer), which conflicts with Round
  9's observed ~5 min linger — the likeliest read is that QA
  watched the inline "Standardizing…" status line, not the
  toast; Round 10 will check the toast lifecycle explicitly.
  3 new tests in `tests/pc102-standardize-toast.test.js`
  (23 passing there, was 20).

Suite: **842 passing, 0 fail** (full gate before deploy; was 839, +3).

Deployed: hosting release `1795796038328000`
(2026-11-27T16:13:58Z); live HTML carries
`clearStdFailureToast` ×5 (1 definition + 3 call sites + 1
comment). No function deploy (client only). Audit
`scripts/verify-function-secrets.js`: 20 functions checked,
secrets + config clean; only the 14 known nodejs20 runtimes
remain (PC-99).

## Retest

(TBD — QA Round 10 after the build; the founder's manual
checks after QA, per the loop design.)
