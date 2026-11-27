# Sprint 38 — Standardization actually runs

- **Status:** PROPOSED (Round 5 retest, 2026-11-26; founder's go pending).
- **Theme:** QA Round 5 found standardization broken end to end
  for new items — but the investigation proved the round's
  headline ("manual generation fails on a plain navy tee") wrong
  in the interesting way: the render SUCCEEDED (a perfect navy
  tee, orphaned in Storage); what failed was the plumbing around
  it. The trigger was never wired, the functions run at timeouts
  the source never declared, and the error toasts lie about which
  action failed. This sprint fixes the plumbing, not the model.
- **Goal in his words (2026-11-14, still the standing brief):**
  "the goal is to make the app easy to use."

## The evidence (what Round 5 saw vs what the logs prove)

- The auto trigger never fired on the new navy tee (created
  5:26 PM, checked 5:31/5:33 PM). Proven cause: the deployed
  `autoStandardizeItem` has NO `eventTrigger` — `deploy-create.js`
  creates functions via raw REST and its body contains none; the
  in-code `onDocumentCreated` is only metadata for the Firebase
  CLI. Zero executions in 24h of logs. The Nov 5 recreate
  unwired a trigger that had worked before (55 items carry
  `already_clean` marks). The missing key (PC-96) was a second,
  independent defect — fixed, but irrelevant while the handler
  can never run.
- Manual generation on the navy tee: attempt 1 failed color
  (ΔE=72.2) + geometry, attempt 2 failed color (ΔE=75.7) —
  FLUX rendered the wrong color twice, correctly rejected; the
  signatures differed, so no systematic stop (correct). Attempt 3
  PASSED and produced a correct navy tee
  (`standardized-pending.png`, 1,030,146 bytes, viewed). The
  HTTP response died at exactly 59.99s — Cloud Run 504 — because
  the deployed `standardizeItem` runs at a 60s timeout while the
  source declares 300s (`deploy-create.js` hardcodes 60s/512Mi;
  `deploy-update.js` never touches serviceConfig). The pipeline
  kept running in the background; the final transaction failed
  NOT_FOUND only because QA deleted the test item mid-run.
- req_9758 (the "upload error") was the sweatshirt's own
  standardization failure (01:26:39Z) — the upload succeeded.
  Global toasts from background failures read as foreground
  failures.
- The item page went blank after the failed run. The round's
  "rejected render" attribution is disproven (no client code
  reads it); the dialog holds a stale `activeItem` and the photo
  has no load recovery.

## Scope

The five cards, in fix order:

| # | Card | Issue | Effort | Why it's in |
|---|------|-------|--------|-------------|
| 1 | PC-101: The auto trigger never fires — never wired | #166 | M | The core journey's automatic path has never run since Nov 5 |
| 2 | PC-104: Deployed functions run at 60s timeouts the source never declared | #169 | M | A 3-attempt standardization cannot complete in 60s; the 240s deadline is dead code under it |
| 3 | PC-105: The FLUX poll ignores the pipeline deadline | #170 | S/M | Fixing the timeout alone moves the kill from 60s to 300s on a slow fal day |
| 4 | PC-102: A background failure's toast looks like the upload failed | #167 | S/M | The founder must never again be told an upload failed when it succeeded |
| 5 | PC-103: Item page goes blank after a failed standardization | #168 | S/M | The item must never look photo-less on its own page |

**Build order note:** PC-101 first (re-wire + live proof with a
fresh item), then PC-104 (timeouts — unblocks the multi-attempt
run), then PC-105 (poll deadline — the timeout's backstop), then
PC-102 (toast scoping), then PC-103 (dialog refresh + photo
recovery + note mapping). PC-104's deploy-script fixes cover
the whole fleet; the live PATCHes cover the five mismatched
functions (standardizeItem, planPacking, parseOutfitPhoto,
shopCheck, autoStandardizeItem).

**Explicitly not in scope:**
- Any change to the FLUX prompt or the color gate — the gates
  worked correctly on the navy tee (two bad draws rejected,
  third passed); PC-100's verdict stands.
- The parked Round 4/5 P2s — a planning walk promotes them,
  not this sprint.
- The orphaned navy pending render in Storage (noted; trivial
  cleanup, not a card).

## Build results

(TBD — filled per card as it ships.)

## Retest

(TBD — QA Round 6 after the build; the founder's manual checks
after QA, per the loop design. Retest target: a NEW item
standardizes automatically within minutes of creation, or is
marked already-clean; manual generation completes a 3-attempt
run inside the budget; a background failure never reads as an
upload error; a failed item's page shows a real photo.)
