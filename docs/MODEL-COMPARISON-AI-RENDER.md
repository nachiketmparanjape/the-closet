# AI Render Model Comparison

> **Purpose:** DECIDE — a reader knows which render model won (FLUX Kontext) and the evidence: print accuracy beats garment accuracy.
> **Earns its place if:** a render-model change is decided against this evidence instead of re-litigated.
> **Owner:** Bramble. **Status:** living.
> **Last verified:** 2026-11-06, against the 2026-11-01 test case and the deployed `buildFluxPrompt`.

**Date:** 2026-11-01  
**Test case:** Green white beige shirt (short sleeve, vertical stripes)  
**Goal:** Find the best model for garment standardization

## The Two Criteria

1. **Garment accuracy** — Structural correctness (sleeve length, fit, collar, etc.)
2. **Print accuracy** — The graphic/pattern stays EXACTLY as in the original photo

## Models Tested

### FLUX Kontext Dev (via fal)
**Current production model.**

- ✅ **Print accuracy:** GOOD — Preserves stripes, colors, and patterns from the input. It's an image EDITOR, not a generator, so it keeps what you give it.
- ❌ **Garment accuracy:** POOR — Ignores structural instructions like "short-sleeve". Generated long sleeves despite explicit "Sleeves: short-sleeve" in the prompt and short sleeves visible in the input cutout.

**Verdict:** Better for our use case, but sleeve/fit instructions need stronger prompt engineering.

### GPT Image 2 (via fal)
**OpenAI's flagship image model.**

- ✅ **Garment accuracy:** GOOD — Correctly generated short sleeves when instructed.
- ❌ **Print accuracy:** TERRIBLE — Completely redesigned the print. Input had vertical green/white/beige stripes; output had floral/camo blobs. It generated a new shirt from scratch, ignoring the input image's pattern.

**Verdict:** Unusable for our use case. A wrong sleeve is fixable; a redesigned print is worthless. The whole point is "preserve the EXACT colors, patterns, prints, graphics."

## Key Wisdom

### Generative vs Editing Models
- **Generative models** (GPT Image 2, DALL-E, Midjourney): Follow text instructions well, but treat the input image as loose inspiration. They REDESIGN.
- **Editing models** (FLUX Kontext): Preserve the input image structure, but may ignore text instructions that conflict with what they see.

### For Closet's Use Case
**Print accuracy > Garment accuracy.** Here's why:
- If the sleeve is wrong, we can fix the prompt and retry. The print is still there.
- If the print is redesigned, the render is useless. No prompt fix can recover the original graphic.

### The Sleeve Problem
FLUX Kontext sees short sleeves in the input cutout but generates long sleeves. This is bizarre — it's an editor, it should preserve. Possible causes:
1. The prompt's "professional e-commerce product photograph" triggers a "long-sleeve shirt" prior
2. "Short-sleeve" isn't weighted heavily enough in the prompt
3. The model needs the instruction repeated or emphasized

**RESOLVED (2026-11-01):** Tested two stronger phrasings — both worked:
- V2 (emphatic): "CRITICAL: This shirt has SHORT sleeves ending above the elbow. You MUST preserve the short sleeves. Do NOT generate long sleeves." ✅
- V3 (repeated): "Short-sleeve shirt. This is a short-sleeve shirt with sleeves ending above the elbow. Keep the short sleeves exactly as shown in the input." ✅

The fix: use CRITICAL/MUST/Do NOT pattern instead of the weak "Sleeves: short-sleeve." Now in `buildFluxPrompt`.

## Decision (2026-11-01)
**Stick with FLUX Kontext.** Fix the sleeve issue via prompt engineering, not model switching. Print preservation is non-negotiable.

## Cost Comparison
- FLUX Kontext Dev: ~$0.025/run
- GPT Image 2: ~$0.01-$0.41/image (quality-dependent)
- FLUX is cheaper and better for our needs.
