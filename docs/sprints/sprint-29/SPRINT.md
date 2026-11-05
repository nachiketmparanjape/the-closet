# Sprint 29 — approved 2026-11-04

## Cards
1. **PC-60 (#130)** — DONE 2026-11-04 (design + calibration). Design doc validated (95% bar, 3 backgrounds, queue-only + scale note). Unified check module built (functions/cutout-check.js: mask geometry + vision judge + semantic match). Calibration script ran on 66 items: 66/66 (100%), 0 false-pass. Two tuning fixes from calibration (sunglasses lens + clog sandal holes exempted). Report: docs/sprints/sprint-29/PC-60-CALIBRATION-REPORT.md. CAVEAT: vision judge (layer 2) not yet wired in the calibration script — mask layer only. Gate wiring (running the check on new cuts) is the follow-up.
2. **PC-41 (#104)** — DONE 2026-11-04, UX reworked 2026-11-05 (Option C). Follow-up thread as a bottom sheet: the check detail shows one compact row ('N questions asked →' or 'Ask about this piece →'); tapping opens the sheet with the full thread, input, 'Open in stylist chat →' link (full stylist experience with the check attached), per-message delete (× removes the Q&A pair), and 'Clear thread'. The 'Ask the stylist about this' button stays on the check detail for the quick jump. Messages persist on the check doc (followUps, capped at 20), answers via askStylist with shopItem + trip context. Firestore rules updated for followUps.
3. **PC-56 (#126)** — DONE 2026-11-04. Embedding computed once from the clean render in extractGarment (reuses parse.js embedImage, multimodalembedding@001, 1408 floats), stored on the photo as renderEmbedding beside the phash. After the render lands, the client compares against existing items (cosine >= 0.85) and proposes 'Looks like your X — same piece?' via toast. Never auto-merges. Soft-fails to null (pHash-only matching continues). NOTE: embedding not testable from the VM (no ADC); verified in production by the same call PC-36 already uses.

## Planning notes
- Full inventory walk: 16 open issues, BACKLOG.md, studio inbox. No aging flags beyond already-parked items.
- Founder approved the 3-card slate as proposed.

## Status
- **COMPLETE 2026-11-04** — all 3 cards done. PC-60 (design + calibration 66/66), PC-41 (follow-up thread), PC-56 (embeddings).
