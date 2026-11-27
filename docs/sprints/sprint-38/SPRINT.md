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

QA Round 6 ran Thu Nov 26, 9:45–9:58 PM PST (13 min), signed in
via the saved Google session. Full report:
`qa-rounds/2026-11-26-round6.md`. Headline: **one P0, three P1s,
five P2s.** This round covers the Fri Dec 4 weekly round.

- **PC-106 — PARTIAL FAIL (P0 on the already-clean half).** The
  automatic call works: all three new items moved with no tap.
  But the single-item add ran FLUX and failed "wrong shape"
  instead of landing already_clean, and the same photo produced
  three different outcomes across the three items (wrong shape /
  pending_review / wrong color) — generation is nondeterministic.
  **Correction (Bramble investigation, same night): the
  already-clean check did not misfire.** The navy photo is
  grey-background (Round 5's description); the check needs >90%
  near-white border or >5% transparency, so it correctly returns
  not-clean. The saved Round 6 outputs prove the gates were right
  in all three cases (geometry rejection: 0% border-white, 100%
  opaque full-bleed draw; color rejection: 100% border-white
  proper render; pass: post-SAM cutout). The proven failures are
  FLUX nondeterminism and the single-item cutout race (PC-109):
  the pipeline snapshots its input once at start, before the
  ~2 min cutout exists.
- **PC-104 / PC-105 — PASS.** Manual generation on the White
  crew-neck t-shirt completed inside budget (~1.5–2 min,
  pending_review at 21:52, never stranded in "processing").
  Cost $0.03. Issues #169/#170 closed.
- **PC-102 — FAIL.** Two background failures (single-add "wrong
  shape", parse 2 "wrong color") and NO toast naming the piece
  was observed. The Sprint 38 fix covered only the two
  foreground catch sites; background failures have no toast path.
- **PC-103 — FAIL on the photo half; sentence PASS.** The
  sweatshirt's item page still shows a blank cream box (confirmed
  after a full reload; other items load fine). The failure
  sentence is present verbatim. Cause corrected the same night:
  both stored files are GONE from Storage (404 "No such object";
  the render was verified 200 at ~17:00) — see PC-107 (#172).
- **New cards:** PC-107 (#172, sweatshirt's stored photo gone),
  PC-108 (#173, bulk "Add 2 pieces" never resets — `bulkFinish()`
  never touches the button), PC-109 (#174, single-item direct
  call races the cutout), PC-110 (#175, `extractGarment` timeout
  orphans the render link — proven on the founder's Black tee
  the same night; the cutout was linked by hand).
- **Round 4 leftovers:** #139 PASS (two Today picks avoid the
  Nov 25 top+bottom; issue closed). "Yesterday" label confirmed.
  "Saturday, Nov 14" label and #138 rollover still untested live.
  #137 missing-photo slot: P2 (blank box, no placeholder).
- **P2s parked:** false duplicate flag (navy vs white, recurs);
  "Tap again to generate" double-confirm; transient "Untitled
  piece" dialog; wardrobe-count discrepancy (live baseline is 72
  pieces — the founder's Black tee, added Nov 26 — while the home
  page reads 71, stale).
- **Test data:** none left. All three QA test items + the test
  trip deleted and verified. Wardrobe 72, outfits 10, trips 0.
  Cost $0.03 (one manual generation).

The founder's manual checks come after QA, per the loop design.
Sprint 39 (fix pass for Round 6) is proposed next: PC-109 →
PC-110 → PC-102 → PC-108 → PC-107.
