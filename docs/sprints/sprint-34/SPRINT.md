# Sprint 34 — Close the loop, second pass

**Theme:** the Round 2 failures. QA Round 2 (2026-11-23) verified
three Sprint 33 fixes (PC-82, PC-83, PC-85) and failed three
(PC-84, the PC-72 regressions) plus one new P1 (PC-87).
**Founder order:** 2026-11-23 19:25 PST — "Yes — open Sprint 34
for the four failures."

## Scope

Build order is the founder's: P0 first.

| Card | Issue | Size | What |
|------|-------|------|------|
| PC-88 | #152 | M | Three-outfit stylist ask errors out every time (P0) |
| PC-84 | #150 | M | "More formal" still replaces the outfit (retest fail) |
| PC-86 | #153 | S | Context bar still truncates mid-word in saved chats |
| PC-87 | #154 | M | Outfit Delete arms but never deletes |

**Retest:** QA Round 3 (Fri Nov 27, or earlier on the
founder's order), scope: the four fixes + smoke pass. Nov 27
falls in the Thanksgiving trip — the round records itself as
skipped if the sign-in approval does not arrive.

**Out of scope:** the three Round 2 parked P2s (dangling
"Unknown item" references after piece deletion; the stylist
dialog's "Today's pick" button no-op; duplicate-detection
false-positive). They stay parked per the loop's design.

## Investigation first

Two of the four fixes shipped in Sprint 33 and did not land
on the live site (PC-84, PC-86). The suite was green and the
deploys went out — so each of those cards starts with an
investigation, not a fix: read the live behavior, find which
path actually runs, and only then change code. A fix whose
cause is unknown is a guess, and the retest already caught
two guesses.

- **PC-88:** read error refs req_6f7c, req_72b4, req_4f06 in
  `users/{uid}/error_events` first. The failing step decides
  the fix.
- **PC-84:** find why the Sprint 33 prompt change (direction
  named, keep-most rule) did not change the model's reply.
  Possibilities to check: the deployed prompt is not the one
  the live function serves; the direction the model sees is
  not the chip's words; the keep-most rule is weaker than
  the model's pull toward a fresh pick.
- **PC-86:** find which code path opens a saved conversation
  ("Evening at The Battery") and whether it ever runs the
  trim after the overlay opens.
- **PC-87:** find the outfit delete handler and where it
  stops after arming.

## Build results

All four cards built, deployed, committed 2026-11-23. Suite
**638 passing** (628 in `tests/` + 10 in
`functions/cutout-check.test.js`). Client syntax OK.

- **PC-88 (#152, P0) — SHIPPED.** Cause proven from the error
  refs: `maxOutputTokens: 2500` (with a 1024 thinking budget)
  truncated a three-outfit JSON mid-object, so every
  three-outfit ask died with `AI_BAD_RESPONSE`. Fix: an
  `outfits` array contract in the prompt + `parseOneOutfit`
  validation (bad entries drop instead of failing the reply),
  and the token cap rises to 6000 only on multi-outfit turns.
  Client renders the extras as cards. Commit `1cbbbae`;
  hosting release `1795491241711000`.
- **PC-84 (#150) — SHIPPED.** The Sprint 33 prompt fix WAS
  live — the rule itself was the cause: "keep MOST / change
  only the slots that must change" left "must change" to the
  model's judgment, and for a casual-to-formal jump it judged
  every slot must change. Fix: a countable rule (keeps AT
  LEAST HALF of the previous pick) plus server enforcement —
  `iterationKeepProblem` triggers the one-shot repair when
  the floor is missed. Commit `c41655c`; `askStylist`
  redeployed (server-only, no hosting deploy).
- **PC-87 (#154) — SHIPPED.** Same failure class as PC-82:
  the outfit delete handler gated on native `window.confirm()`,
  which browsers auto-dismiss without showing it, so the
  handler returned early on every tap. Fix: the in-app
  two-tap confirm, mirroring PC-82. Commit `386f914`;
  hosting release `1795491672252000`. Finding recorded in
  the commit: 9 more native `confirm()` gates remain in the
  client — same latent class, follow-up candidates.
- **PC-86 (#153) — SHIPPED and VERIFIED LIVE.** The Sprint 33
  trim logic was sound in isolation (a probe page with the
  verbatim functions trimmed correctly) — the cause was
  inside `truncateAtWord`: the shown text ends in a pin label
  ("I like timeless …") that already ends in "…", so the
  step popped the trailing "…" and re-added it — a no-op.
  The loop spun its 60-step guard with the text unchanged
  and the CSS ellipsis cut mid-word ("Mountain Vie…"). Fix:
  a trailing "…" counts as a separator, and the loop breaks
  on no progress (`tests/pc86-trim.test.js`, 3 tests, plus a
  `truncateAtWord` regression). Commit `178fd5f`; hosting
  release `1795492436055000` (probe page removed from the
  live site in release `1795492532806000`). Live check
  2026-11-23 ~19:54 PST, signed-in browser, saved "Evening
  at The Battery" conversation: the bar reads "Today's pick
  · Estate Minimalist … · +2 more" — word boundary, no
  mid-word cut. Issue #153 closed with this verification.
  The probe page (`public/trim-test.html`) was a one-off
  diagnostic, deleted before this docs commit.

## Retest

QA Round 3 (Fri Nov 27, or earlier on the founder's order):
re-test PC-84, PC-87, PC-88 (P0 first) + smoke pass. PC-86
is already verified live (see above) and is re-tested only
if the round's scope keeps it. Nov 27 falls in the
Thanksgiving trip — the round records itself as skipped if
the sign-in approval does not arrive.
