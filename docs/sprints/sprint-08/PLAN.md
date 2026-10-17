# Sprint 8 — Close the loop

**Dates:** 2026-10-31 → 2026-11-14 (fixed; unfinished cuts roll over, no guilt)
**Status:** proposed by PM 2026-10-17, approved by founder (no veto).
**Theme:** the outfit lifecycle end to end — from a photo of what you wore
to a logged outfit, AI feedback on your own picks, and the lanes finally
measured instead of vibed.
**Planning note:** ranked backlog per the prioritization rule (value,
effort, data-model risk of delay, dependencies, founder energy); founder's
yes/no acted as veto over the proposal.

## Cuts

### PC-13: Outfit photo parsing (M/L, Loop lane)
- **Problem:** logging what you wore means remembering it and manually
  rebuilding the outfit piece by piece. A photo of the fit should do it.
- **In scope:** photo upload → AI identifies the visible articles →
  matches proposed against the wardrobe (user confirms each match;
  unknown garments flagged, not invented) → outfit created with
  `source: "photo"` → optional wear logging with date.
- **Out of scope:** cataloging garments that aren't in the wardrobe (that's
  PC-3 territory); multi-person photos.
- **Done looks like:** photo of yesterday's outfit → correct articles
  matched and confirmed → outfit saved → wear logged with yesterday's date.
- **Size:** M/L. **Design first:** matching/confirm UX doc for founder
  validation before build. **Constitution check:** passes.

### PC-27: "Score my outfit" AI critique (M, Stylist lane)
- **Problem (founder 2026-10-17):** manual outfits get no AI feedback, and
  the stylist's scores don't apply to them.
- **In scope:** an explicit "AI take" action on a manual outfit → a new
  critique prompt path (not the pick rubric) → sub-scores + an honest
  2–3 sentence critique, clearly labeled as critique with provenance
  (`scoredBy: "critique"`). Never auto-applied, never blocks saving.
- **Out of scope:** auto-scoring on save; mixing critique scores into the
  pick-calibration metric (different distributions).
- **Done looks like:** tap "AI take" on a manual outfit → labeled scores +
  critique appear → pick calibration stays clean.
- **Size:** M. **Design first:** prompt + provenance design for founder
  validation. **Constitution check:** passes.

### Lane metrics instrumentation (S/M, studio machinery)
- **Problem:** the five lanes were defined in Sprint 6 but never measured —
  planning can't be data-driven until they are.
- **In scope:** queries + a script computing, per lane —
  - Catalogue: AI tag acceptance rate (AI-suggested fields kept as-is vs edited at upload)
  - Outfits: wear-through rate (saved → worn)
  - Loop: rating completion rate (wears that get rated)
  - Stylist / Personalization: calibration gap (predicted confidence vs actual ratings; report what's there — needs rating volume)
  
  Numbers recorded in the sprint-close notes. No UI.
- **Out of scope:** real-time dashboards, metric-drift alerting.
- **Done looks like:** one command outputs the four numbers; they're written
  into the Sprint 8 close notes and used at Sprint 9 planning.
- **Size:** S/M. **Constitution check:** passes.

## Parked this sprint (ranked, not selected)
- PC-14 shop compatibility (M) — rank 4, nice-to-have.
- Outfit versioning (edit → new version) — designed in DATA_MODEL.md; only
  matters once piece-editing exists.
- PC-19 article dup detection (M) — parked per founder (not high priority).
- PC-23 archive layer (M) — trigger: a "deleted something I wanted back"
  moment or an article delete visibly breaking an old outfit.
- PC-24/25/26 gender-aware work — parked per founder; sized and waiting.
