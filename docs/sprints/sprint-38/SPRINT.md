# Sprint 38 — Standardization actually runs

- **Status:** APPROVED by the founder 2026-11-26 ("Yes — open Sprint 38 for the five fixes").
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

- **PC-101 (#166) — wiring rebuilt; live proof pending.** The
  function was deleted and recreated with its Firestore trigger
  (document `users/{uid}/items/{itemId}`, event
  `google.cloud.firestore.document.v1.created`, triggerRegion
  `nam5` — the (default) database lives in nam5, not
  us-central1). Three causes found in sequence: (1) the Nov 5
  REST create never sent an eventTrigger, and an HTTP function
  cannot be PATCHed into an event-triggered one; (2) the trigger
  region must be the database's region; (3) the REST create
  grants nobody publisher on the trigger's Pub/Sub topic — its
  IAM was empty, so no event could publish; `roles/pubsub.publisher`
  is now granted to both the Eventarc and the Firestore service
  agents (verified by read-back). Live tests #1–#3 (fresh items,
  donor photo) did NOT fire; test #4 is running after the grants
  had time to settle. `deploy-create.js` now grants the topic
  publisher at create time for any future event-triggered
  function, and `scripts/verify-function-secrets.js` audits
  eventTrigger presence. `function-config.json` is the single
  source of truth for deployed function config (timeout/memory/
  trigger) — committable, no secrets.
- **PC-104 (#169) — SHIPPED 2026-11-26.** Live PATCHes: standardizeItem
  → 300s/1Gi, planPacking → 300s, parseOutfitPhoto → 120s,
  shopCheck → 120s (all ACTIVE; planPacking/parseOutfitPhoto/
  shopCheck also bumped nodejs20 → nodejs22; fleet nodejs20:
  15 of 21 left, PC-99). `deploy-create.js` reads timeout/memory/
  eventTrigger from `function-config.json` at create;
  `deploy-update.js` applies serviceConfig after every
  buildConfig PATCH; the audit script checks secrets + runtime +
  config drift. Audit after the PATCHes: secrets clean, config
  clean — the only remaining mismatches are the 15 retired
  nodejs20 runtimes (PC-99).
- **PC-105 (#170) — SHIPPED 2026-11-26.** `fetchWithTimeout`
  (AbortController, 30s default) + poll opts
  (`deadlineAt`/`fetchTimeoutMs`/`pollIntervalMs`) in
  `runFluxStandardization`; the deadline is checked at the top
  of every poll iteration; the pipeline passes `deadlineAt`.
  5 new poll tests + 1 pipeline wiring test (28 passing across
  the standardize files). Deployed to `standardizeItem` AND
  `autoStandardizeItem` (both redeployed 2026-11-27T03:15Z);
  the trigger survived the update (verified by GET).
- **PC-102 (#167) — SHIPPED 2026-11-26.** New
  `standardizeFailureToast(name, err)` beside
  `standardizationFailureNote`; the Generate catch and the
  Refresh-Go catch both toast the named failure ("The burgundy
  sweatshirt's AI version didn't come out right. (Ref:
  req_9758)") — never the generic text that reads as the
  foreground action failing. 7 tests
  (`tests/pc102-standardize-toast.test.js`). Hosting release
  `1795749366797000`; live markers verified.
- **PC-103 (#168) — SHIPPED 2026-11-26.** Four fixes in
  `public/index.html`: `standardizationFailureNote` maps
  `processing_interrupted` to the timeout sentence; the
  `watchItems` snapshot refreshes the open dialog's photo +
  standardization UI from the fresh doc (never the name/title
  fields); `itemPhoto` error/load listeners — one cache-busted
  retry per base URL, then fall back to `photos[0].url`; the
  Generate catch carries `lastError` into the local failed
  state. 5 tests (`tests/pc103-item-dialog.test.js`). Same
  hosting release as PC-102; live markers verified.

Suite: **770 passing, 0 fail** (full gate before deploy).

## Retest

(TBD — QA Round 6 after the build; the founder's manual checks
after QA, per the loop design. Retest target: a NEW item
standardizes automatically within minutes of creation, or is
marked already-clean; manual generation completes a 3-attempt
run inside the budget; a background failure never reads as an
upload error; a failed item's page shows a real photo.)
