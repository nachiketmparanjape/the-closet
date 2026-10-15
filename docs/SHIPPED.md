# Closet — shipped log

What went live. Momentum you can see.

## Sprint 1 (2026-09-30 → 2026-10-14)

- **PC-1: Delete a wardrobe piece** — shipped 2026-09-30 (PR #1).
  Founder-tested on phone 2026-10-06. Done.
- **PC-2: Edit a piece's tags/category** — shipped 2026-09-30 (PR #1).
  Founder-tested on phone 2026-10-06. Done.
- **PC-3: Auto-suggest tags at upload** — shipped 2026-09-30 (PR #1).
  Founder-tested on phone 2026-10-06. Done. (Category accuracy mediocre —
  known on-device limit; real fix is the API caption, needs Blaze call.)
- **PC-4: Multiple photos per item (up to 4)** — shipped 2026-10-05 (direct
  to main). Founder-tested on phone 2026-10-06. Done.
- **PC-5: Add/delete individual photos + choose cover** — shipped 2026-10-05
  (direct to main). Founder-tested on phone 2026-10-06. Done.
- **Color suggest: most-frequent color** — shipped 2026-10-05 (direct to
  main). Founder-tested on phone 2026-10-06. Done.

## Sprint 2 (2026-10-11 → 2026-10-28)

- **PC-6: Backend proxy (`describeItem`)** — deployed 2026-10-14 (direct
  Cloud Functions API; CLI transport broken in this VM). Verified
  end-to-end: auth gate, live Vertex AI call, HTTP 200 in ~4s. Blaze
  confirmed on.
- **PC-7: AI description + name suggestion at upload** — shipped
  2026-10-14 via CI (`a8998ad`). Founder phone-tested same day: AI worked,
  two UI bugs found (dark-mode invisible text, stale on-device hint) —
  both fixed and redeployed (`a37d410`, `7603467`).

## Sprint 3 (2026-10-29 → 2026-11-11) — started early 2026-10-14

- **PC-9: Bulk upload** — shipped 2026-10-14 via CI (`bb4a8ca`).
  Awaiting founder phone test.
- **PC-10: Chat stylist** — shipped 2026-10-14: new `askStylist` callable
  (us-central1, manual REST deploy) + chat UI via CI (`4c3b446`).
  Awaiting founder phone test.
