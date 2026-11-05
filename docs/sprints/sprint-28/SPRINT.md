# Sprint 28 — approved 2026-11-04

## Cards
1. **Full auto-FLUX on item-add** (Sprint 27 caveat) — DONE 2026-11-04. Pipeline extracted to `functions/standardize-pipeline.js` (FLUX -> Delta-E/geometry gates with 3x retry -> SAM cutout -> upload -> photo swap). `standardizeItem` callable and `autoStandardizeItem` trigger both call it. Gates wired into the pipeline (was a TODO). 469/469 tests pass.
2. **PC-58 review gate (#128)** — DONE 2026-11-04 (deploying). Pipeline now marks renders `pending_review` instead of `ready`; `approveStandardization` / `rejectStandardization` callables swap or discard. Item page shows side-by-side Original vs AI render with Approve / Try again / Keep original. Design decisions: generated renders need human eyes, review inline per item, side-by-side always.
3. **PC-59 (#129)** — Uniform display scaling + too-small-in-photo warning. Every garment renders at a consistent size; warn when a photo is too small to work with.

## Housekeeping done at planning (2026-11-04)
- #134 CLOSED (done in Sprint 27).
- #127 (PC-57) CLOSED — Qwen experiment verdict was FAIL (2026-10-28).
- PR #80 left OPEN with a comment — design docs awaiting founder review. Not merging without it.
- Sprint 26 Cards 2, 3: KILLED. No SPRINT.md, no issue, no record of what they were — proposed but never approved, content lost to context compaction. If the work matters, re-file as a new issue. (Founder: no context to decide; Bramble made the call per the aging rule.)
- PR #133 (Pooja, UX-16 audit docs) — still open, mergeable state unknown. Needs review.

## Carried / undecided
- #129 (PC-59), #130 (PC-60) — #129 is in this sprint; #130 stays backlog.
- Sprint 26 Cards 2, 3 — killed (see above).

## Planning notes
- Full inventory walk: 19 open issues, BACKLOG.md, studio inbox. No aging flags beyond already-parked items.
- Founder approved the 3-card slate as proposed.
