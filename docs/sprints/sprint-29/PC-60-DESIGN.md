# PC-60: Automated Cutout Check — Design

**Status:** Design for founder validation (Sprint 29, 2026-11-04)
**Owner:** Bramble (design), Founder (verdict)
**Replaces:** Nothing. This design unifies the two existing gate layers into one check.

## Purpose

The app cuts garments out of photos automatically (background removal). Sometimes the cut is bad — a sleeve is missing, a bag strap rides along, the garment has a hole in it. Today two separate checks catch some of these failures, but they were built at different times, for different reasons, and were never tested against a known set of good and bad cuts.

This design creates **one check** that judges every cut the same way, against one written checklist, and proves it works on a labeled set of real cuts before it gates anything.

## Words used in this document

| Word | Meaning | Example |
|------|---------|---------|
| **Cut** | The output of background removal: the garment on a transparent background. | The PNG file the app stores after BiRefNet or SAM 3 runs. |
| **Check** | The automated process that judges a cut and returns a verdict. | PC-60's unified check (this design). |
| **Verdict** | The check's answer for one cut: pass or fail, with named reasons. | `{ pass: false, reasons: ["missing-sleeve"] }` |
| **Checklist** | The seven things the check looks at, written down in this document. | Whole garment, nothing extra, no holes, clean edges, right garment, upright, full-size pixels. |
| **Calibration set** | A fixed set of cuts with known good/bad labels, used to test the check. | The 69 verified renders plus the known failures. |
| **Flag** | To mark a cut as failed and show the reason to a human. The cut is never hidden. | A failed cut shows in the review queue with its reasons. |
| **Gate** | To block a cut from showing until it passes. | A gated cut does not appear in the wardrobe until it passes. |
| **Surface** | One place in the app where a cut appears. | The wardrobe grid, an outfit card, the item page. |
| **Fail-direction** | Which mistake the check prefers when it is unsure: pass a bad cut, or fail a good cut. | "Fail safe" means prefer failing a good cut over passing a bad one. |

## The problem with the current checks

Two checks exist today. They catch different failures and were never calibrated together.

**Layer 1 — mask heuristics** (`functions/imagenorm.js`, `judgeMask`).
Reads the cut's alpha channel (transparency data) and checks numbers: is there enough foreground, is it one piece or fragments, does the shape match the original photo's shape. Catches catastrophic failures: empty cuts, background grabs, shattered cuts, wrong aspect ratio. Costs nothing (pure math on pixels). Cannot tell whether the cut shows the right garment — a clean cut of the wrong object passes.

**Layer 2 — vision judge** (`functions/extractcheck.js`, `checkCutout`).
Sends the original photo and the cut (on a magenta background) to Gemini and asks one question: does the cut show exactly the main garment, whole, with nothing extra? Catches semantic failures: a bag strap that rode along, a neighbor garment, a hole showing magenta through the middle. Costs one Gemini call per cut (~$0.001). Was added after a real failure (the bag strap). Its prompt was written once and never tested against a labeled set.

**What is wrong:**
1. The two layers were never tested against the same labeled set, so nobody knows their combined agreement rate with the founder's own verdicts.
2. Their fail-directions differ by surface. Layer 1 fails safe (rejects on doubt). Layer 2 also fails safe. But the surfaces that consume them do not all handle a rejection the same way — some show the original, some show nothing.
3. Scores misled twice: a 0.91-scored cleanup was blank; a 0.54 cut was broken. A number is not a verdict.
4. No checklist exists in writing. The founder's manual checks live in his head and in chat messages, not in a document the check can be tested against.

## The checklist

Distilled from the founder's own manual checks (chat, 2026-10-28). The check judges each item. A cut passes only when all seven hold.

| # | Check | What it means | How it is tested |
|---|-------|---------------|------------------|
| 1 | **Whole garment** | Every part of the garment is present. No cut-off sleeves, legs, straps, or edges. | Vision judge: compare cut against original photo. |
| 2 | **Nothing extra** | No other objects, body parts, furniture, or background remnants came along. | Vision judge: look for objects that are not the garment. Mask heuristics: extra components. |
| 3 | **No holes** | No gaps inside the garment where the background shows through. | Vision judge: magenta showing through the middle. Mask heuristics: holes in the largest component. |
| 4 | **Clean edges** | The garment's outline is smooth, not jagged or fringed, on dark and light grounds. | Mask heuristics: semi-transparent fringe share. Vision judge: edge quality on magenta. |
| 5 | **Right garment** | The cut shows the main garment from the photo, not a neighbor. | Vision judge: match cut against the garment description. |
| 6 | **Upright** | The garment is the right way up (collar at top, waistband at top for bottoms). | Orientation verdict (existing layer 3, not this card's job to build). |
| 7 | **Full-size pixels** | The check reads the final pixels at full size, not a thumbnail. | The check always runs on the stored render file, never a preview. |

**Boundary:** This card judges the CUT, not the photo. Source-quality warnings (photo too small, garment too far away) stay PC-59's job. Orientation stays the pipeline's layer 3. This card does not change how cuts are made — only how they are judged.

## The design

### One verdict shape

Every check returns the same shape, no matter which layer produced it:

```
{
  pass: true | false,
  reasons: ["missing-sleeve", "extra-object", ...],  // empty when pass
  layers: {
    mask: { pass: true | false, reasons: [...] },
    vision: { pass: true | false, reasons: [...] }
  },
  checkedAt: "2026-11-04T12:00:00Z"
}
```

**Reasons** come from a fixed list (no free text from the model — the model picks from the list, so reasons are countable and searchable):

- `missing-part` — a sleeve, leg, strap, or edge is cut off.
- `extra-object` — something that is not the garment came along.
- `hole` — a gap inside the garment.
- `ragged-edge` — the outline is jagged or fringed.
- `wrong-garment` — the cut shows a different garment than the main one.
- `empty` — no garment pixels at all.
- `fragmented` — the garment is in disconnected pieces.
- `aspect-mismatch` — the cut's shape does not match the original photo's shape.

### Three layers, one check

The check runs three layers in order. Each layer can fail the cut. All three run even after a failure, so the verdict lists every reason (a cut can be both missing a sleeve AND have a hole — the founder needs to know both).

**Layer 1 — Mask geometry (free, instant).**
Reads the cut's alpha channel. Extends the existing `judgeMask` with three new measurements:
- **Fringe share:** the share of foreground pixels that are semi-transparent. A healthy cut has a thin fringe at its edges (under 5%). A failed matte is semi almost everywhere (over 20%).
- **Hole count:** the number of background regions fully enclosed by foreground. A healthy cut has zero. Any hole is a failure.
- **Edge-touch signal:** whether the garment touches the image border on more than one side. A garment that touches the border was likely cropped by the photo frame, not by the cut.

**Layer 2 — Vision judge (one Gemini call, ~$0.001).**
The existing `checkCutout`, with two changes:
- The prompt is rewritten to use the checklist's words and the fixed reason list. The model picks reasons from the list instead of writing free text.
- The judge sees the cut on magenta AND on white AND on black (three images instead of one). A fringe that is invisible on magenta shows on white; a dark remnant invisible on black shows on magenta. This is the "clean edges on dark AND light grounds" checklist item.

**Layer 3 — Semantic match (reuses PC-36's embedding machinery, no new cost).**
Compares the cut's image embedding against the garment's description embedding (the same description the app already generates). Catches the "wrong garment" case when two similar garments are in one photo and the cut picks the wrong one. Pass when cosine similarity is above 0.80; fail when below 0.70; between 0.70 and 0.80, the vision judge's verdict decides (the embedding is a signal, never a verdict on its own).

### Fail-direction per surface

The check always fails safe (prefers failing a good cut over passing a bad one). What happens after a failure depends on the surface:

| Surface | On failure | Why |
|---------|-----------|-----|
| Wardrobe grid | Show the original photo. Flag the cut in the review queue. | The grid must never show a broken cut. The original is always safe. |
| Outfit card | Show the original photo. Flag the cut. | Same as the grid — the outfit must look right. |
| Item page | Show the original photo. Show the failed cut in the review section with its reasons. | The founder can see what failed and why, and decide. |
| Review queue | List the cut with its reasons. Never hide it. | The queue exists so the founder can see failures. Hiding a failure is worse than showing it. |

**Flag, never hide.** A failed cut is always visible somewhere with its reasons. The app never silently discards a cut.

### Calibration

Before the check gates anything, it must prove it agrees with the founder on the calibration set.

**The calibration set (already exists):**
- The 69 verified renders (cuts the founder has seen and approved).
- The known failures: the broken 0.54 cut, the zero-detection holds, the Qwen inventions, the bag-strap cut.

**The calibration report:**
A script runs the check against every cut in the set and reports, per checklist item:
- Agreement rate: how often the check's verdict matches the founder's verdict.
- False-pass rate: how often the check passed a cut the founder rejected (the dangerous mistake).
- False-fail rate: how often the check failed a cut the founder approved (the annoying mistake).

**The bar:** the check must agree with the founder on at least 95% of the set, with a false-pass rate under 2%, before it gates anything. If it does not meet the bar, the thresholds are tuned (not guessed) and the report is re-run. The report is filed in the repo before the gate is turned on.

**Scores are not verification.** The check returns a pass/fail verdict with named reasons, never a score. A 0.91 that is blank taught us that.

## Cost

| Layer | Cost per cut | Notes |
|-------|-------------|-------|
| Mask geometry | $0 | Pure math on pixels, runs in the function. |
| Vision judge | ~$0.001 | One Gemini Flash call with three images. |
| Semantic match | $0 | Reuses the embedding the app already computes for matching. |
| **Total** | **~$0.001 per cut** | Cheaper than the cut itself ($0.005). |

At 70 items, calibrating the full set costs under $0.10. At 10 new cuts a week, the ongoing cost is about $0.01 a week.

## What this card does NOT do

- Does not change how cuts are made (BiRefNet, SAM 3, FLUX — untouched).
- Does not change the review gate (#128) — the review gate is the human verdict; this check is the automated second opinion that feeds it.
- Does not build the review queue UI — the queue exists (Sprint 28 Card 2); this check adds reasons to the items in it.
- Does not handle source-quality warnings (PC-59) or orientation (pipeline layer 3).

## Sequencing

1. **Design** (this document) → founder validates.
2. **Calibration script** → runs the check against the 69 + failures, files the report.
3. **Threshold tuning** → adjust until the bar is met (95% agreement, <2% false-pass).
4. **Gate wiring** → the check runs on every new cut; failures flag (never hide).
5. **Review queue** → failed cuts appear with reasons; founder reviews.

Steps 2–5 are the build. This card is step 1.

## Questions for the founder

1. Is 95% agreement with under 2% false-pass the right bar, or should it be stricter?
2. Should the vision judge see three backgrounds (magenta, white, black) or is magenta alone enough?
3. When the check fails a cut, should the founder get a notification, or is the review queue enough?

## History

- 2026-10-28 — Card filed from PC-36's Q6. Founder: "let's steal the review gate, that seems to be make or break." Decided: automated check gets its own well-designed card, not rushed into PC-36 v1.
- 2026-11-04 — Design written (Sprint 29 Card 1). Awaiting founder validation.
