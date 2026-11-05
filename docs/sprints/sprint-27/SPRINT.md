# Sprint 27 — approved 2026-11-04, COMPLETE 2026-11-04

## Cards
1. **#134** — Centralize photo display rules: one function decides which photo + rotation everywhere.
   Status: DONE. `resolveDisplayPhoto` + `showDisplayPhoto` built, all surfaces migrated (wardrobe grid, outfit cards, outfit detail, trips, packing, builder, shop thumb, today chip, parse matches, category heroes, item page, match picker). Two follow-up fixes: `resolveRenderUrl` disabled (was overwriting correct src), 7 more surfaces found in global audit. Hosting releases 1793843143825000, 1793845791286000, 1793852225082000.
2. **#131** — Maintenance track: error taxonomy, stuck-state sweeper, deploy secret check,
   data quality probes, correlation-ID surfacing, Bug #4 (permissions audit), Bug #5 (REST-format lint check).
   Status: DONE. Bug #4: `match_rejections` Firestore rule added (was missing, client writes failed silently); rules deployed. Bug #5: `tests/rest-format-guard.test.js` scans for REST markers near Admin SDK writes. Sweeper + data-quality probe wired into Monday heartbeat cron.
3. **PC-58 completion** — Wire `parse.js` LIST_PROMPT to extract taxonomy attributes at photo time
   (top of funnel); wire Delta-E + geometry quality gates for real; implement `isAlreadyClean` heuristic;
   hook passive standardization into item-add path.
   Status: DONE (with one caveat). LIST_PROMPT extracts subtype/sleeve_length/neckline/collar/length/rise/cuff/closure/zip/hood; flows into item `ai` map via `saveOutfitParse`. Delta-E (LAB, median foreground color) + geometry (coverage + aspect) gates implemented in `standardize.js`. `isAlreadyClean` heuristic implemented (transparency + white-border). `autoStandardizeItem` Firestore trigger deployed — tags already-clean items on create. CAVEAT: full auto-FLUX on create is NOT wired — the trigger only tags clean items; running FLUX automatically needs the pipeline extracted into a shared module first (avoid duplicating the 200-line standardizeItem body). Manual Generate remains the path for non-clean items. Candidate for Sprint 28.

## Folded in
- #132 (fit taxonomy research) — CLOSED, remaining work folded into Card 3.

## Carried / undecided
- Sprint 26 Cards 2, 3, PR #80 — still unapproved; awaiting founder disposition (roll into 27 or kill).
- #129 (PC-59), #130 (PC-60) — backlog, not in Sprint 27.

## Planning notes
- Full inventory walk: 21 open issues, BACKLOG.md, studio inbox. No aging flags.
- Founder's yes = veto over proposal, not ranking from scratch (per process).
