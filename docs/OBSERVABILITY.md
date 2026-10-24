# Observability — Closet (living design doc)

How the app watches itself: what broke, what it cost, and what the
user was doing when it happened. This is the presentable design
surface for a structure that is invisible by nature — if it can't
be read and challenged here, it doesn't get to be load-bearing.

**History.** OBS-1 (2026-10-19): structured logs + client error
capture. OBS-3 (2026-10-23, founder chose full instrumentation in
one pass): the `ai_usage` cost ledger. OBS-2 (2026-10-24, Sprint
20): the error taxonomy repair, the `error_events` ledger, client
correlation, and the quality report. This doc is the single
living spec for all three; cut records live in `docs/SHIPPED.md`
and the sprint folders.

**How to suggest an improvement.** The open points at the bottom
are numbered (OP-n). Improvements are proposed against a section
or an OP, decided with the founder, and this doc is edited in the
same commit as the code — the doc lagging the code is itself a
defect under the studio's load-bearing-invisibles doctrine.

---

## The three questions

1. **What broke?** — per function: success/failure rates, which
   named errors, and the failures that *aren't* errors (rejected
   model output, degraded fallbacks, self-heal retries).
2. **What did it cost?** — per AI call: tokens or predict-seconds,
   latency, a versioned USD estimate, and the headline figure,
   **cost per successful outcome**.
3. **What was the user doing?** — client failures carry the
   session and the last few actions, so "it broke at 9:28" can be
   matched to its moment and its server events.

## Principles

- **Events for aggregation, logs for traces.** Anything we roll
  up is written as a structured event at the moment it happens —
  never reconstructed by scraping logs after the fact.
- **Metadata only.** No prompts, no photo bytes, no user content
  in any event. Ids, counts, timings, outcomes, and *shapes*
  (which fields a rejected payload had — never their values).
- **One join key per request.** Every event carries the request's
  `correlationId`, so cost, outcome, and latency for a single
  call read as one story across logs and ledgers.
- **Errors carry their names.** A failure's catalog key must
  survive from the throw site to the log, the ledger, and the
  report. A failure recorded without its name is a failed
  recording (this was a real bug class — see Taxonomy).
- **Nothing silent.** If the system handled it, the system can
  show it: a fallback, a rejection, a retry, or a degradation is
  an event, not an absence.
- **Estimates are stamped, inputs are kept.** Cost events store
  the raw units *and* the USD estimate under a named
  `pricingVersion`. Price changes never rewrite history; history
  can be re-priced on demand.
- **Fail-safe.** An observability write must never break the
  user-facing call: fire-and-forget, and its own failures degrade
  to a log line.

## Shape of the system

```
 request ──► callable boundary (functions/index.js)
               │  ├─ success ─► logSuccess ──────────────┐
               │  └─ failure ─► logError (key resolved) ─┤ Cloud Logging
               │                                          │ (30-day traces)
               ├─ AI calls ─► ai_usage event ────────┐    │
               ├─ outcome ───► error_events event ───┤ Firestore ledgers
               └─ sub-events ► error_events event ───┘ (append-only,
                                                        server-only)
 browser ──► reportError ──► users/{uid}/client_errors
               (+ sessionId + action trail)

 ledgers ──► scripts/quality-report.js  (health lens)
         └─► usage-report.js            (cost lens)
```

Writers: `functions/errors.js` (taxonomy + logs),
`functions/events.js` (error_events), `functions/usage.js`
(ai_usage), the stylist's `emitEvent` funnel (sub-events via
`hooks.onEvent`). Client: `reportError()` in `public/index.html`.
Rules: both ledgers deny all client access (`firestore.rules`);
`client_errors` is owner-create-only.

## The error taxonomy (`functions/errors.js`)

One catalog (`CATALOG`) is the single vocabulary of failure.
Every entry: a **key** (`AI_BAD_RESPONSE`), a **category**
(`auth | validation | dependency | internal`), a **gRPC code**
(what the client receives), and a **client-safe message** (the
client sees catalog messages verbatim — never internals).

- `fail(key)` throws an `HttpsError` carrying the message *and
  the key itself* (`err.key`).
- `codedError(key, detail)` is the downstream counterpart: a
  plain Error whose internal detail is logged but never sent.
- `keyOf(err)` resolves a key from any carrier: explicit `.key`,
  a reverse lookup of the catalog message, or a `.code` that is
  itself a key. `logError` and the boundary both go through it.

**The failure this prevents:** before OBS-2, `fail()` did not
attach the key, so a boundary logging the thrown HttpsError saw
only "internal" and the failure landed in metrics as
*(uncoded)* — the name existed at the throw and was lost in
transit. The taxonomy is now guarded by tests: every catalog
entry has a message + valid gRPC + category, `fail()` provably
carries its key, and every gRPC code the catalog uses has a
human line in the client's `friendlyError` map.

## The ledgers

### `ai_usage` — one event per AI call (OBS-3)

Written by `makeUsageRecorder` (`functions/usage.js`) through the
per-request tracker in each callable.

| Field | Meaning |
| --- | --- |
| `ts` | server timestamp |
| `correlationId` | joins to logs + error_events |
| `feature` | callable or sub-call (`describeItem`, `askStylist`, `extractGarment.provider`, …) |
| `provider` | `vertex` \| `replicate` |
| `model` | model id as called |
| `uid` | caller |
| `surface` | `upload` \| `chat` \| `trip` \| `shop` \| `background` |
| `tokensIn` / `tokensOut` / `tokensThinking` | provider-reported usage, when available |
| `predictSeconds` | Replicate predict time, when applicable |
| `latencyMs` | wall time of the AI call itself |
| `outcome` | `success` \| `error:<key>` \| `gate_rejected` |
| `costUsd` | estimate under `pricingVersion` |
| `pricingVersion` | which pricing table priced this event (`functions/pricing.js`) |
| `refId` | item / photo / trip id where one exists |

Pricing: Vertex per-1M-token rates per model (thinking tokens
bill as output); Replicate per-second by hardware class. A price
change ships as a new `pricingVersion`; any window can be
re-priced from the stored raw units.

### `error_events` — one event per outcome or notable non-outcome (OBS-2)

Written by `makeErrorEventRecorder` (`functions/events.js`).
The callable boundary writes `success` (with duration) and
`failure` outcomes; feature code writes the rest through one
funnel per module.

| Field | Meaning |
| --- | --- |
| `ts` | server timestamp |
| `kind` | `success` \| `failure` \| `rejection` \| `degraded` \| `self_heal` |
| `fn` | callable, or `callable:event` for sub-events (`askStylist:outfit_discarded`) |
| `key` | catalog key when the event is a failure |
| `category` | the key's catalog category |
| `correlationId` | joins to logs + ai_usage |
| `uid` | caller |
| `durationMs` | successes only |
| `detail` | shape-only context (arg keys, stage names), capped at 300 chars |

The **non-failure kinds** are the point of the design — the
failures that used to be invisible because nothing threw:

- `rejection` — the system refused a result: trip packing args
  that didn't map (`trip_tool_args_rejected`), a packing plan
  drafted but not applied, a stylist outfit discarded after
  validation (`outfit_discarded`).
- `degraded` — the user got a lesser result and nobody knew: a
  best-effort profile read failed (`subcall_degraded`), a slot
  repair threw and the chat fell back to text-only.
- `self_heal` — the system caught its own problem and retried:
  the trip packing re-ask, the slot-validation repair attempt.
  Counted, so "how often does the first attempt fail?" is a
  number, not a feeling.

### `users/{uid}/client_errors` — the browser's side (OBS-1 + OBS-2)

`reportError()` writes (owner-create-only, capped per session,
loop-guarded): `where`, `code`, `message` (capped), `page`,
`userAgent`, `createdAt` — plus, since OBS-2, **`sessionId`**
(one per page load, `sessionStorage`) and **`trail`**: the last
12 stamped actions (`view …`, `open <window>`), fed by hooks in
`switchView` and `openOverlay`. An error report is now joinable
to the session's other errors and, by time, to the server's
events for that user.

## Reporting

- **`scripts/quality-report.js [--days N]`** — per-function
  success/failure counts and rates, top error keys, success
  latency p50/p95, the non-failure event counts, AI outcomes,
  client-error summary — and **spike flags**: a function's
  last-24h failure rate is flagged when it has ≥3 failures and
  runs ≥2× its window baseline. Notify-only by decision: the
  report is the alerting surface until a scheduled digest is
  built (OP-1).
- **`usage-report.js`** — spend by feature × provider × model,
  trend, success/error beside cost, cost per successful outcome,
  unit economics (per item catalogued, per stylist turn).
- **Ad-hoc analysis:** export a window and query locally with
  DuckDB over files — zero infra. **Graduation path, only when
  volume demands it:** Firestore → BigQuery with the same
  schema; the event shapes drop in unremodeled. No streaming
  pipeline, no warehouse, until a report actually hurts.
- GCP billing alerts stay the hard backstop for *total* cloud
  spend. The ledgers answer what billing can't: **which feature,
  on what, and whether it worked.**

## Decisions & alternatives (why it is this way)

- **Firestore ledgers, not just Cloud Logging queries.** Logs
  expire (30 days) and aggregate poorly; the questions above are
  longitudinal ("since when?"). Append-only Firestore events are
  queryable forever at this scale for ~no cost. Alternative
  rejected: a logging-only design (OBS-1) — it is why failures
  were undiscoverable without a user report.
- **Not Sentry (yet).** The studio standard names Sentry's free
  tier as the default crash surface; the Closet's failure modes
  are domain-shaped (rejections, gates, self-heals) that a crash
  tool doesn't model, and the ledger + report cover the need
  with zero new vendor. Revisit if a second product needs crash
  aggregation across stacks (OP-5).
- **Server-side writes only.** Clients can't be trusted to
  report their own server's failures (and a guest has no
  Firestore identity to write with); the boundary is the one
  place every outcome passes through exactly once.
- **Shape-only details.** `detail` records *structure* (which
  args, which stage) — enough to classify a failure, never user
  content. This keeps the ledger safe to keep forever.
- **One funnel per module.** Sub-events enter through
  `emitEvent` / `hooks.onEvent`, outcomes through the boundary —
  so "did we instrument X?" has exactly two places to check,
  and the invariant tests can guard them.

## Open improvement points

- **OP-1 — Scheduled digest.** The quality report is on-demand;
  a weekly digest (and spike push) is the named follow-up,
  deliberately not built until the on-demand report proves its
  shape.
- **OP-2 — Retention.** Ledgers are append-only forever at
  current volume (a few KB/day). If volume grows: TTL or
  rollup-and-prune, decided from real numbers.
- **OP-3 — Client-error grouping.** client_errors are raw rows;
  grouping by `where` + session already happens in the report,
  fingerprint dedupe does not.
- **OP-4 — Alert thresholds.** Spike flags are heuristic
  (≥3 failures, ≥2× baseline). Tune from the first month of
  real flags — or record why they're right.
- **OP-5 — Cross-product shape.** This design is Closet's. A
  second product adopting it is the trigger to lift the shared
  parts into the studio's logging-and-observability standard.

## Code pointers (as of 2026-10-24)

- Taxonomy + logging: `functions/errors.js` (`CATALOG`, `fail`,
  `codedError`, `keyOf`, `logError`, `logEvent`).
- Boundary + wiring: `functions/index.js` (`boundary`, `finish`,
  `recordErrorEvent`, the `onEvent` hooks wrap at the askStylist
  call).
- Sinks: `functions/events.js`, `functions/usage.js`,
  `functions/pricing.js`.
- Sub-event funnel: `emitEvent` in `functions/stylist.js`.
- Client: `reportError`, `closetSessionId`, `noteTrail` in
  `public/index.html`.
- Reports: `scripts/quality-report.js`, `usage-report.js`.
- Guards: `tests/errors-server.test.js`,
  `tests/errors-client.test.js`, `tests/usage-retrofit.test.js`.
