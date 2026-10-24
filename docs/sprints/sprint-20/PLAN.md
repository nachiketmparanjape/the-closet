# Sprint 20 — Nothing Fails Silently + the Trip Loop

_Founder approved 2026-10-24 ("Approve this slate") at the full
planning walk. Batch, not timebox._

## Goal

Two debts, one theme each. **Trust:** the week's live-testing
kept surfacing failures that were invisible until the founder
hit them (context never sent, tool calls dropped silently) —
OBS-2 makes failure loud, structured and reportable, and
PC-43 closes the specific silent-failure class that produced
"Untitled item" zombies. **Trips:** Hong Kong (Nov 23–29) is
four weeks out — PC-39 and PC-40 land the trip loop's two
missing pieces while there's still time for them to matter.

## Planning walk (2026-10-24, full inventory per the hard rule)

- **Backlog:** every card reviewed and scored (user value,
  effort, delay risk, dependencies, founder energy). Parked
  triggers checked: PC-23's trigger (deletion regret) has
  still not fired; UX-17's trigger (a user asks) has not
  fired.
- **Inbox:** nothing untriaged since the curator pass.
- **GitHub issues:** the mirror keeps issues == backlog cards;
  no orphans found at this walk.
- **Aging dispositions (founder-approved with the slate):**
  - **BUG-1: KILLED.** Three weeks of heavy uploading since
    the 2026-10-05 bounce, zero recurrence. If it recurs it
    re-files with real data.
  - **PC-23: KEEP.** Trigger unmet; cost case (ghost-clothes
    filter risk) still real.
  - **PC-24 / PC-25 / PC-26: KEEP as a set.** PC-24 is a
    context input — the UX-18 stylist audit reviews it there.
  - **UX-12: KEEP.** Flows still moving (last night's session
    is the evidence); its trigger stands.
- **Held with reasons:** PC-38, PC-32, PC-33 — chat work held
  one sprint so the UX-18 audit designs chat context first;
  PC-41 (depends on PC-40) and PC-42 form next sprint's
  shop-check cluster; PC-36 waits behind trip priorities;
  the Alta teardown was offered as the research slot and not
  taken — it stays queue head.
- **UX-18 (stylist audit session)** runs inside this sprint
  as the design track whenever the founder calls it; its
  outputs become next sprint's stylist cuts. UX-16 folds in.
- **PC-34** remains gated on the founder's Replicate token;
  when it lands it ships as a fix, outside the sprint.

## Cards

### 1. OBS-2 — Error logging & handling overhaul (M)

Scope refined at planning:
- **Coded errors only.** Audit every callable: expected
  failures throw codedError; the error logger reads the code
  consistently (tonight's `(uncoded)` key-loss: logError reads
  `.key` where HttpsError carries `.code` — fix the read and
  audit every logError call site). Client copy check:
  friendlyError has a human line for every code in the
  catalog (test-enforced).
- **Rejections are events.** Every dropped/invalid tool call,
  malformed model response, and self-heal retry writes a
  structured event (shape only, no user content) —
  generalizing `trip_tool_args_rejected` to all functions.
  Nothing fails silently server-side.
- **Quality report.** `scripts/quality-report.js` in the
  OBS-3 usage-report pattern: per-function success rate,
  top error codes, client error counts, latency percentiles,
  self-heal rate, over a window. Runnable on demand.
- **Alerting (scoped):** the report flags any function whose
  failure rate spikes vs its trailing baseline. A scheduled
  digest is a named follow-up decision, NOT built here.
- **Client correlation.** client_errors gain a per-load
  session id and a ring of recent callable invocations
  (name + timestamp), so "it broke at 9:28" matches the exact
  server call in the report.
- **Acceptance:** inject a malformed model response and an
  invalid tool call in tests → both appear as structured
  events; the report runs against live data and prints sane
  numbers; no `(uncoded)` in a log sweep; friendlyError
  coverage test green.

### 2. PC-43 — Unnamed items heal themselves (S–M)

Per the card (filed 2026-10-24 after the 8-item repair).
Flag at save (`needsAi`), quiet re-describe on load via the
existing callable (capped per session), "naming…" state in
the grid instead of the placeholder, manual rename remains
the escape hatch. Acceptance per the card.

### 3. PC-39 — Trip weather re-check (S)

Per the card: the Option 1 design the founder picked
2026-10-24 — a tappable weather pill on the trip page plus
a silent re-check when the forecast is missing or stale
(>24h or past the first leg day). No nagging, no banner.

### 4. PC-40 — Contextual shop checks (M)

Per the card: a trip-started check reads the trip doc
server-side and judges for the trip (destination weather,
formality, what the founder already owns for it); optional
"Anything specific?" question field saved on the check and
shown on the detail view. PC-41 (follow-up chat) builds on
this next sprint and must carry the check by construction
(UX-16/UX-18 discipline).

## Ship gates

Per card: tests green (incl. the layout invariants), deploy
via the manual path, live-marker verification, SHIPPED.md +
friction.md updated, founder phone validation is the final
gate per the standing rule — no "verified" before his phone
has done the thing.
