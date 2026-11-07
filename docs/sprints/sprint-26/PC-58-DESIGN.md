# PC-58: Stage 3 — Garment Image Standardization

**Status:** Design approved by founder 2026-10-31. Ready for implementation.
**Issue:** #128
**Sprint:** 26 (Card 1)

## Problem

Wardrobe items have inconsistent photography: wrinkled flat-lays, occluded outfit crops, varied backgrounds and lighting. The catalog looks messy. Stage 3 transforms each garment into a **complete, standardized product shot** — whole garment, consistent shape, clean presentation.

**Scope:** "Make it whole and make it standardized." (Founder, 2026-10-31)
- *Make it whole:* reconstruct missing/occluded geometry (tucked hems, hidden sleeves, detached pieces).
- *Make it standardized:* normalize to a consistent product-shot presentation.

**Not in scope:** Background removal alone (SAM 3 already does this). Artistic reinterpretation. The garment's colors, patterns, prints, and construction details must be preserved exactly.

## Architecture

### Model: Single-model, no cascade

**Decision** (founder 2026-10-31): Use one model — `fal-ai/flux-kontext/dev` via fal.ai. No backup/expensive-model cascade for now.

- **Cost:** ~$0.025/run. With ~15% retry rate: ~$0.03/item.
- **Settings:** `guidance_scale: 2.5`, `num_inference_steps: 30`. Low guidance keeps output close to source pixels (proven: minimal prompts beat detailed ones; describing the garment invites regeneration from words).
- **Prompt template:** "Transform this garment photo into a professional e-commerce product photograph: complete whole garment with proper standardized shape, centered on a pure white background, front-facing, even studio lighting. Preserve the EXACT colors, patterns, prints, graphics, and construction details exactly as shown. Do not redesign the garment. Do not add text, logos, labels, or tags."

### "Already Clean" Detection

**Problem:** Some items are already clean product shots (e.g., 55 Google Photos imports). Running diffusion on these wastes money and risks degrading them.

**Detection** (runs at item creation, zero AI cost — pure pixel heuristics):
1. If the image has meaningful alpha transparency → already clean.
2. Else, sample border pixels: if >90% are near-white/uniform → likely a studio product shot → already clean.
3. Otherwise → real photo → needs standardization.

**Marking:** Items get `standardization: { status: 'already_clean' | 'pending' | 'processing' | 'ready' | 'failed', reason: string, markedAt: timestamp }`.

**Backfill:** 55 Google Photos imports (all created 2026-10-21) already tagged `already_clean` with reason `google-photos-import` (2026-10-31).

**Escape hatch:** Items marked `already_clean` show a "Generate standardized view" CTA in the detail card. Deliberate tap, cost disclosed. Covers misattribution edge cases.

### Quality Gates

Output must pass all gates before it's shown to the user. Failed outputs are hidden, not displayed.

1. **Color fidelity (Delta-E):** Extract dominant colors from input garment region and output garment region. Compute Delta-E in LAB space. **Threshold: <15.** (Proven: teal joggers scored 44.3 = visible shift = correctly flagged as FAIL.)
2. **Label/text detection:** Check for hallucinated labels, tags, or text that wasn't in the input. (Known issue: FLUX invents collar labels. Negative prompt helps but isn't sufficient. This gate catches what slips through.)
3. **Geometry completeness:** Verify the output contains a complete garment silhouette (no truncation, no detached floating pieces).

**On gate failure:** The output is discarded. The item stays in `processing` state. A retry can be triggered (see Refresh below). After 3 auto-failures, mark as `failed` and surface to the user with the refresh option.

### Processing Flow

```
Item added
  → Clean-check runs (pixel heuristics, ~ms)
  → If already_clean: skip, show CTA for manual override
  → If real photo:
      → status = 'processing'
      → FLUX runs in background (Cloud Function, async)
      → Quality gates check output
      → If pass: status = 'ready', standardized image revealed in UI
      → If fail: retry (up to 3) or mark 'failed'
```

**Trigger:** Passive. Runs automatically in the background when an article is added. No user action required.

**UI state:** The item's enlarged (detail) card shows a brief "Standardizing…" indicator while processing. The standardized image appears only after gates pass.

### Refresh with Feedback

**Problem:** Gates aren't perfect. The user may see a result that's technically passing but visually wrong.

**Solution:** A "Refresh" action on the standardized image lets the user re-run with optional feedback text (e.g., "the color is still off", "the sleeve looks wrong"). Feedback is appended to the prompt for the retry.

**Anti-accident:** Refresh is a deliberate action — confirmation dialog with cost disclosed ("This will cost ~$0.03"). No accidental taps. Not in a swipe gesture or long-press.

### Expense Warning

**Threshold:** 10+ refreshes on a single article.

**Behavior:** Show an expense warning banner: "You've refreshed this item 10 times (~$0.30). The model may not be able to improve this one further."

**Rationale:** At $0.03/refresh, 10 refreshes is only $0.30 — the banner is about catching runaway loops, not real money. But the pattern matters for future expensive models.

## Data Model

### Item.standardization (new field on wardrobe items)

```javascript
{
  status: 'already_clean' | 'pending' | 'processing' | 'ready' | 'failed',
  reason: string,           // e.g., 'google-photos-import', 'pixel-heuristic', 'user-refresh'
  markedAt: timestamp,
  attempts: number,         // diffusion attempts (for retry counting)
  refreshCount: number,     // user-triggered refreshes (for expense warning)
  lastError: string,        // gate failure reason, if any
  standardizedUrl: string,  // output image URL (only set when status='ready')
  standardizedStoragePath: string,
}
```

### Cost Tracking

Each diffusion call logs to the existing cost infrastructure:
- Model: `fal-ai/flux-kontext/dev`
- Cost per call: ~$0.025
- Update `docs/API-INVENTORY.md` in the same commit (per standing rule).

## Implementation Plan

### Phase 1: Backend
1. **Clean-check function:** Pixel heuristics (alpha + background uniformity). Runs on item creation.
2. **Standardization worker:** Cloud Function that takes an item ID, runs FLUX, applies quality gates, updates Firestore.
3. **Quality gates:** Delta-E color check, label detection, geometry check. Each as a testable module.
4. **Retry logic:** Up to 3 attempts on gate failure, then mark `failed`.

### Phase 2: UI
5. **Processing indicator:** Brief "Standardizing…" in the enlarged card.
6. **Gated reveal:** Standardized image appears only when `status='ready'`.
7. **"Already clean" CTA:** "Generate standardized view" button on skipped items.
8. **Refresh with feedback:** Confirmation dialog → optional feedback text → re-run.
9. **Expense warning:** Banner at 10+ refreshes.

### Phase 3: Backfill
10. **Existing real photos:** Queue the ~15 non-Google items for background processing.

## Open Questions

- **Label detection implementation:** How exactly to detect hallucinated labels? Options: (a) vision model comparison, (b) OCR for text that wasn't in input, (c) founder's eye as the gate for v1 (simplest — gates 1 and 3 are automated, gate 2 is manual review). **Recommendation:** Start with (c), automate later.
- **Geometry completeness check:** What's the cheapest reliable signal? Bounding box analysis? Silhouette IoU against category template? Needs prototyping.

## Success Criteria

- [ ] Clean-check correctly identifies already-clean images (zero false negatives on the 55 tagged items).
- [ ] Real photos get standardized versions that pass the founder's visual bar.
- [ ] Color Delta-E gate catches shifts like the teal joggers (44.3).
- [ ] No standardized image is shown before passing gates.
- [ ] Refresh flow has no accidental triggers.
- [ ] Expense warning fires at 10+ refreshes.
- [ ] Total cost for full wardrobe backfill < $5.

## History

- 2026-10-30: Founder pasted Stage 3 brief from another agent. Bramble evaluated, ran FLUX experiments.
- 2026-10-31: Founder reframed as "make it whole and make it standardized." 14-garment batch test (all passed visual bar except teal joggers color). Color gate proven with Delta-E 44.3. Product-photography model tested and rejected (wrong framing). Founder approved single-model approach, passive background processing, and "already clean" detection. 55 Google imports tagged.
