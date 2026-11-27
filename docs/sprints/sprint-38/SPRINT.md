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
| 1 | PC-106: Replace the trigger with a direct call + sweeper | #171 | M | Replaces PC-101 (#166, superseded 2026-11-26): the automatic path has never run, and the trigger is deleted, not fixed |
| 2 | PC-104: Deployed functions run at 60s timeouts the source never declared | #169 | M | A 3-attempt standardization cannot complete in 60s; the 240s deadline is dead code under it |
| 3 | PC-105: The FLUX poll ignores the pipeline deadline | #170 | S/M | Fixing the timeout alone moves the kill from 60s to 300s on a slow fal day |
| 4 | PC-102: A background failure's toast looks like the upload failed | #167 | S/M | The founder must never again be told an upload failed when it succeeded |
| 5 | PC-103: Item page goes blank after a failed standardization | #168 | S/M | The item must never look photo-less on its own page |

**Build order note (amended 2026-11-26):** PC-101 was first (re-wire + live proof), then PC-104, PC-105, PC-102, PC-103 — all four shipped 2026-11-26. PC-101 is now **superseded by PC-106** (founder decision): the trigger is deleted and replaced with a direct call + sweeper, so PC-106 closes the sprint instead.

**Explicitly not in scope:**
- Any change to the FLUX prompt or the color gate — the gates
  worked correctly on the navy tee (two bad draws rejected,
  third passed); PC-100's verdict stands.
- The parked Round 4/5 P2s — a planning walk promotes them,
  not this sprint.
- The orphaned navy pending render in Storage (noted; trivial
  cleanup, not a card).

## Build results

- **PC-101 (#166) — wiring rebuilt twice; live proof still failing.**
  The function was deleted and recreated with its Firestore trigger
  (document `users/{uid}/items/{itemId}`, event
  `google.cloud.firestore.document.v1.created`, triggerRegion
  `nam5` — the (default) database lives in nam5, not
  us-central1). Three causes found in sequence: (1) the Nov 5
  REST create never sent an eventTrigger, and an HTTP function
  cannot be PATCHed into an event-triggered one; (2) the trigger
  region must be the database's region; (3) the REST create
  grants nobody publisher on the trigger's Pub/Sub topic — its
  IAM was empty, so no event could publish; `roles/pubsub.publisher`
  is now granted to all four plausible publishers (Eventarc,
  Firestore, GCF admin robot, compute SA — verified by
  read-back). Live tests #1–#5 did NOT fire. Test #6 ran after
  the function + trigger were FULLY recreated via
  `deploy-create.js` (new topic
  `eventarc-nam5-autostandardizeitem-348874-892`) — still did
  NOT fire. **Decisive correction (2026-11-26, log history): the
  trigger NEVER fired, not once — Cloud Run logs Oct 28–Nov 27
  show ZERO invocations, including the CLI era (Oct 28–Nov 5).
  The "Nov 5 recreate unwired it" theory is wrong; the 55
  already_clean marks came from manual callable runs, not the
  trigger.** The trigger cannot be recreated through the
  Eventarc API directly (proven by its own error: a
  cloudFunction destination "is not supported on the Eventarc
  API" — it must be set at function deploy). The source probe
  (a Pub/Sub-destination trigger) could not run: Pub/Sub is not
  a valid trigger destination, only a transport. Every
  checkable resource is correct; the break is in the
  Firestore→Eventarc source link, unobservable from this VM
  (Monitoring hangs; pull is unsupported on the managed push
  subscription). Next: Firebase Console inspection of the
  trigger's delivery, or replace the trigger with a direct call
  (founder decision). **SUPERSEDED 2026-11-26 by PC-106 (#171): the founder chose the direct call — the trigger was deleted, not fixed.** `deploy-create.js` now grants the topic
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

- **PC-106 (#171) — SHIPPED 2026-11-26.** Replaces PC-101 (#166, superseded by founder decision): the trigger is deleted, not fixed. Client helper `requestStandardization(itemId)` — fire-and-forget call to the `standardizeItem` callable (no force) — invoked after every item creation: parse confirm (`applyParseGarmentDecisionsInner`, also serves chat add), both single-item add flows, shop-check one-tap add (4 call sites, pinned by test). The already-clean check moved into `runStandardizationPipeline` (it lived only in the trigger): it reads the ORIGINAL photo, never the cutout (a cutout is transparent by construction — checking it would skip every cutout-backed item's FLUX run); force bypasses it; the callable returns the skipped result. New `scripts/standardize-sweeper.js` (REST adapters shared in `scripts/rest-adapters.js`) + cron `closet-standardize-sweeper` every 30 min: items with NO standardization field older than 10 min, max 5 per user per run, pipeline run in-process. The deployed `autoStandardizeItem` function was DELETEd (GET 404 — trigger/topic/subscription gone with it); its code export, `function-config.json` entry, and `SECRETS_BY_FUNCTION` entry removed; audit clean except the 15 known nodejs20 (PC-99). Live proof: sweeper dry-run found 43 items with no status (112 checked); live run healed 8 (founder's Olive fleece joggers → pending_review; Teal Nike Tech Fleece joggers + Black tee with red back graphic → failed, systematic color ΔE=26.5 / 58.4, rejected renders saved; the other user's 5 → already_clean). Two adapter bugs found and fixed by the live run (array values in toValue; runTransaction must await collected updates). Deployed: `standardizeItem` (ACTIVE, nodejs22, 300s/1Gi, FAL_API_KEY bound, updateTime 2026-11-27T05:41:29Z); hosting release `1795758107348000` (live HTML carries all 4 call sites). 16 new tests (4 pipeline + 4 client + 8 sweeper).

Suite: **786 passing, 0 fail** (full gate before deploy).

## Retest

(TBD — QA Round 6 after the build; the founder's manual checks
after QA, per the loop design. Retest targets: a NEW item created
in the app standardizes automatically within minutes, with no tap
(PC-106 direct call); an item whose direct call never sent is
healed by the sweeper within ~30 min (PC-106); manual generation
completes a 3-attempt run inside the budget; a background failure
never reads as an upload error; a failed item's page shows a real
photo.)
