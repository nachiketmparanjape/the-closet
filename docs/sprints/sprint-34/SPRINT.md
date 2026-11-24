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

(To be filled as cards land.)
