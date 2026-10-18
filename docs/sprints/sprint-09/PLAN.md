# Sprint 9 — Open the doors

**Dates:** batch opened 2026-10-17 at founder's direction (sprints are work
batches — see playbook 2026-10-17).
**Status:** FB-1 shipped 2026-10-17 (rules deployed, app live, 124/124 tests).
WX-1 and PM-3 pending.
**Theme:** the app is about to meet other humans — feedback capture, weather
that just works, and the full history visible as GitHub issues.
**Planning note:** ranked backlog per the prioritization rule (value,
effort, data-model risk of delay, dependencies, founder energy); founder's
yes/no acts as veto. This planning follows the no-ad-hoc-work directive
(2026-10-17): the weather and feedback cuts were pulled mid-session and are
rolled into this batch instead of built ad hoc.

## Cuts

### FB-1: In-app feedback form (S)
- **Problem (founder 2026-10-17):** testers are coming; without in-context
  capture, feedback scatters across chats and DMs.
- **In scope:** floating "Feedback" button (always visible) → modal with one
  autofocused textarea (dictation via the native keyboard mic — no custom
  voice work) → writes to a top-level `feedback` collection with auto
  context (screen, uid, userAgent, timestamp). Firestore rules: signed-in
  create-only; reads via console/admin. Toast confirm on send.
- **Out of scope:** screenshot attachments, in-app feedback reading UI,
  categorization (happens at studio triage).
- **Done looks like:** tester taps Feedback, dictates two sentences, sends;
  the doc lands in the Firebase console with context attached.
- **Size:** S. **Constitution check:** passes.

### WX-1: Weather-aware stylist (S)
- **Problem (founder 2026-10-17):** the rubric already scores a `weather`
  dimension, but it runs on whatever the user typed or nothing at all.
- **In scope:** browser geolocation (permission-gated, graceful fallback) →
  Open-Meteo (free, no key, client-side, 30-min cache) → "Current weather:
  68°F, clear" attached to every stylist request as context + a visible
  chip in chat showing what the stylist knows. Lat/lng never leaves the
  device — only the weather description goes to the model.
- **Out of scope:** forecasts beyond "now", location-aware anything else,
  server-side weather.
- **Done looks like:** "suggest something right now" factors real weather;
  denying location leaves the app working as today.
- **Size:** S. Cost: $0. **Constitution check:** passes. (Revisits the
  2026-09-30 "weather is overengineering" call — the stylist is now the
  core loop and this removes friction from its top request.)

### PM-3: GitHub Issues adoption — full history migrated (S/M)
- **Problem (founder 2026-10-17):** adopting GitHub issues requires the
  whole history there, not just new work.
- **In scope:** labels (type/lane/size) + milestones (Sprints 1–9) on the
  repo; every backlog item as an open issue; every shipped cut as a closed
  issue with its sprint noted. Decision as part of the cut: extend
  `mirror.py` (currently showcase-repo-only) vs a product-repo-native
  layout — whichever keeps "markdown is the system of record" true.
- **Out of scope:** the status-board UI (awaits the founder's yes from
  Oct 16); hand-editing issues (generated from markdown, per mirror
  contract).
- **Done looks like:** the repo's Issues tab shows the full history —
  open backlog, closed shipped work, labeled and milestoned.
- **Size:** S/M. **Constitution check:** passes.

## Ranked, not selected
- **PC-14 shop compatibility** (M) — rank 4; natural next flagship once
  the doors are open.
- **PC-19 / PC-23 / PC-24-26 / outfit versioning** — parked per founder
  calls and triggers, unchanged.
