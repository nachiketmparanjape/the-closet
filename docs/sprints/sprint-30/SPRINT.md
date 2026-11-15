# Sprint 30 — Chat attach consolidation (#141)

Approved 2026-11-14 (founder validated the design same evening).
Priority call (founder, 2026-11-14): this jumps the queue ahead of
parked items — firsthand usage showed the chat item-picking flow is
the weak seam, and ease of use is the goal.

## Card 1: Chat attach — one consolidated photo picker (#141, M)

Design: `docs/proposals/CHAT-ATTACH-PROPOSAL.md` (validated 2026-11-14).
One "Add to chat" bottom sheet: search on top, photo grid below
(scrollable, no cap), category filter chips, saved outfits section,
multi-select with Done. `+` button opens it; typing `@` opens the
same sheet with the query pre-filled. Old inline text dropdown
deleted. Chips carry photo thumbnails. Every item card gets "Style
around this" — opens the stylist chat with that item attached.

Acceptance criteria (from #141):
1. @ and + open the same sheet — one code path.
2. Every row shows a photo; grid scrolls, no cap; search filters
   live; category chips work.
3. Multi-select + Done attaches all as photo chips; each removable.
4. "Style around this" opens chat with the item attached.
5. Plain-name mention without @ still works.
6. Phone-verified by the founder — PENDING. Deployed hosting release 1794719967125000 (2026-11-15 05:19 UTC); client syntax OK; tests 481 passing (471 + 10 cutout-check).

## Follow-up fix (same evening, founder-reported)

Send latency: the founder's messages sat invisible for several
seconds after Send (both eventually appeared). Root cause: sendChat
awaited getWeatherSummary() (geolocation, up to 10s) BEFORE pushing
+ rendering the message. Fix: weather await moved to just before the
payload build — the message renders immediately, weather rides along
in the background. Regression tests in tests/sprint30-send.test.js
(render must precede the weather await). Deployed with the #141
release; phone verification still pending.
