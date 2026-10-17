# Sprint 8 — Close the loop

**Dates:** batch started 2026-10-17 at founder's pull (sprints are work
batches — see playbook 2026-10-17); originally sketched Oct 31 → Nov 14.
**Status:** in progress — lane metrics shipped; PC-13 + PC-27 design docs
awaiting founder validation.

## Lane metrics baseline (2026-10-17, `node scripts/lane-metrics.js`)

| Lane | Metric | Baseline |
|---|---|---|
| Catalogue | AI tag acceptance | **97.6%** (n=42 fields; brand 75%, rest 100%) |
| Catalogue | AI color acceptance | **100%** (n=12) |
| Outfits | wear-through (saved → worn) | **0%** (0/2 — no wears logged yet) |
| Loop | rating completion | n/a (no wears) |
| Stylist | calibration gap | n/a (rated outfits were deleted in Sprint 7 testing; ratings dangle) |
| Personalization | suggestion acceptance | n/a (no suggestions yet) |

Notes: tag acceptance excludes v1/bulk items that never had the newer
fields written (vintage guard in the script). The 3 existing user ratings
reference deleted outfit docs — correctly excluded from calibration, not
misattributed. The wear → rate → reflect loop is still unexercised
end to end (Sprint 4 open item).
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
