# Sprint 29 — approved 2026-11-04

## Cards
1. **PC-60 (#130)** — DONE 2026-11-04 (design + calibration). Design doc validated (95% bar, 3 backgrounds, queue-only + scale note). Unified check module built (functions/cutout-check.js: mask geometry + vision judge + semantic match). Calibration script ran on 66 items: 66/66 (100%), 0 false-pass. Two tuning fixes from calibration (sunglasses lens + clog sandal holes exempted). Report: docs/sprints/sprint-29/PC-60-CALIBRATION-REPORT.md. CAVEAT: vision judge (layer 2) not yet wired in the calibration script — mask layer only. Gate wiring (running the check on new cuts) is the follow-up.
2. **PC-41 (#104)** — DONE 2026-11-04. Follow-up thread inside the saved check detail view: messages persist on the check doc (followUps, capped at 20), answers via askStylist with shopItem + trip context. The shop attach already covered 'ask follow-ups' in the stylist chat; this closes the gap (thread lives on the check, reopening shows it). Firestore rules updated for followUps.
3. **PC-56 (#126)** — Garment embeddings: real similarity signal for matching and duplicate detection.

## Planning notes
- Full inventory walk: 16 open issues, BACKLOG.md, studio inbox. No aging flags beyond already-parked items.
- Founder approved the 3-card slate as proposed.
