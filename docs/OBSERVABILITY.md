# Observability & AI cost analytics — Closet

Living spec for how the app watches itself: errors, success rates,
and AI spend. Proposed 2026-10-23 (Bramble); validated by the
founder the same day, who chose full instrumentation in one pass.
OBS-3a/3b/3c built 2026-10-23 (see the OBS-3 card for the build
record). Cards: OBS-1 (shipped 2026-10-19), OBS-2 (error
quality), OBS-3 (this doc's cost lens).

## What exists today (2026-10-23)

- **Structured server logs.** Every callable emits `<fn> succeeded`
  / `<fn> failed` JSON via `functions/errors.js`
  (`logSuccess`/`logError`), threaded by a per-request
  `correlationId`. Store: Google Cloud Logging (30-day retention).
- **Client errors.** `reportError()` persists to Firestore
  `users/{uid}/client_errors` (owner-create-only rules).
- **Reporting.** `metrics.js` (local, gitignored) pulls Cloud
  Logging + the client_errors collection group and prints
  per-function success rates, durations, recent failures.
  On-demand and manual only.
- **AI cost: nothing.** Token usage surfaces only inside failure
  logs (`logAiFailure`); no call records tokens, model, or price.
  The only spend records are the providers' own bills, which say
  *how much* and never *which feature*.

## Principles

- **Events for aggregation, logs for traces.** Anything we roll up
  is written as a structured event at the moment it happens —
  never reconstructed by scraping logs after the fact.
- **Metadata only.** No prompts, no photo bytes, no user content
  in analytics events. Ids, counts, timings, outcomes.
- **One join key.** Every event carries the request's
  `correlationId`, so cost, outcome, and latency for a single call
  read as one story across logs and events.
- **Estimates are stamped, inputs are kept.** Each event stores
  the raw units (tokens / predicted seconds) *and* the USD
  estimate computed under a named `pricingVersion`. Price changes
  never rewrite history, and history can be re-priced on demand.
- **Fail-safe.** An analytics write must never break the
  user-facing call: fire-and-forget, failures degrade to a log
  line.

## The event: `ai_usage` (Firestore, append-only)

One document per AI call, written server-side (Admin SDK) via one
helper, `recordAiUsage()` in `functions/usage.js`, called at each
AI choke point.

| Field | Meaning |
| --- | --- |
| `ts` | server timestamp |
| `correlationId` | joins to Cloud Logging traces |
| `feature` | callable or sub-call (`describeItem`, `askStylist`, `extractGarment.provider`, `extractGarment.check`, …) |
| `provider` | `vertex` \| `replicate` |
| `model` | model id as called |
| `uid` | caller (the app's own analytics; owner-only rules) |
| `surface` | `upload` \| `chat` \| `trip` \| `shop` \| `background` |
| `tokensIn` / `tokensOut` / `tokensThinking` | Vertex `usageMetadata`, when the provider reports them |
| `predictSeconds` | Replicate `metrics.predict_time`, when applicable |
| `latencyMs` | wall time of the AI call itself |
| `outcome` | `success` \| `error:<key>` \| `gate_rejected` |
| `costUsd` | estimate under `pricingVersion` |
| `pricingVersion` | which pricing table priced this event |
| `refId` | item / photo / trip id where one exists |

## Pricing (`functions/pricing.js`, versioned)

- **Vertex (Gemini):** USD per 1M tokens, input and output rates
  per model; thinking tokens bill as output.
- **Replicate:** USD per second by hardware class ×
  `predict_time` returned with each prediction.
- **Flat per-call providers** (if any return): a per-call rate.

A price change ships as a new `pricingVersion` constant; the
report can re-price any window from the stored raw units.

## Reporting

- **`usage-report.js`** — local tooling extending the `metrics.js`
  pattern. Window rollups: spend by feature × provider × model;
  daily/weekly trend; success and error rates *next to* cost, so
  the headline figure is **cost per successful outcome**; unit
  economics (per item catalogued = describe + extract + check;
  per stylist turn); top cost drivers, named.
- **Ad-hoc analysis:** export a window to JSONL/CSV and query it
  with **DuckDB** locally — columnar SQL over files, zero infra.
  That is this stack's offline-analytics answer at current scale
  (hundreds to low thousands of AI calls a month).
- **Graduation path, only when volume demands it:** Firestore →
  BigQuery export with the same schema. BigQuery is the
  serverless SQL warehouse in this stack — the Hive/Presto role —
  and the event shape above drops into it unremodeled. No
  streaming pipeline, no warehouse, until a report actually hurts.

## Guardrails

- The report shows month-to-date spend against a founder-set soft
  budget; OBS-2's alerting slice can reuse these same events for
  failure-rate and spend-spike signals.
- GCP billing alerts stay the hard backstop for *total* cloud
  spend. `ai_usage` answers the question billing can't: **which
  feature spent it, on what, and whether it worked.**

## Slices

- **OBS-3a** — `usage.js` + `pricing.js`; instrument
  `extractGarment`'s two AI calls (provider + gate check). Rides
  the PC-34 build: new code, zero retrofit.
- **OBS-3b** — retrofit the existing callables (`describeItem`,
  `askStylist`, `critiqueOutfit`, `shopCheck`, `planPacking`,
  `parseOutfitPhoto`, reflect). Each funnels through a single
  model call site, so this is one emit per function.
- **OBS-3c** — `usage-report.js` rollups + unit economics.
- OBS-2 remains the error-quality overhaul; OBS-3 is the cost
  lens over the same events philosophy. The two reports can
  merge into one digest later if that proves useful.
