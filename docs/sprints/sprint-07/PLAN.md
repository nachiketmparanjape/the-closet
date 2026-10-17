# Sprint 7 — Trustworthy history, referenceable chat

**Dates:** 2026-10-17 → 2026-10-31 (fixed; unfinished cuts roll over, no guilt)
**Status:** proposed by PM 2026-10-16, awaiting founder approval.
**Theme:** the data the app learns from must be correct (wear history,
outfit identity), and the chat grows from answering questions into a
surface you can point things at.
**Planning note:** first sprint run under the new prioritization rule —
the full backlog was scored on user value, effort, data-model risk of
delay, dependencies, and founder energy; the ranked list was presented
and approved without veto.

## Cuts

### PC-20 + PC-21: Wear history correctness (S, Loop lane) — DONE 2026-10-17
- Shipped: date picker on "I wore this" (defaults today, capped at today;
  past dates stored at local noon, createdAt always server time) + per-entry
  delete with confirm (derived stats un-count automatically). 77/77 tests,
  live via CI.
- **Problem:** "I wore this" stamps today only, and entries can't be
  deleted — mis-taps append forever and wrong dates poison the learning data.
- **In scope:**
  - Date picker on the wear action, defaulting to today; history shows the
    chosen date. Existing entries keep their server timestamps.
  - Delete a wear entry (confirm first); derived article stats un-count it.
- **Out of scope:** editing a wear's note/occasion after the fact; bulk ops.
- **Done looks like:** log yesterday's outfit with yesterday's date; delete
  a mis-tapped entry and watch the "Worn N×" count drop.
- **Size:** S. **Constitution check:** passes (no non-goal conflicts).

### PC-18: Outfit dedup (S/M, Outfits lane)
- **Problem:** saving the same pick twice mints two unrelated docs —
  wear history and ratings fragment across duplicates.
- **In scope:** content hash over sorted itemIds (+ source) computed at
  save time; saving an identical combination surfaces "you already saved
  this exact outfit" with a shortcut to the existing one instead of a
  silent duplicate. Interacts with versioning: a re-save of an identical
  *version* is the dup case; edited versions are still new versions.
- **Out of scope:** merging already-existing duplicates (forward-only);
  fuzzy/near-duplicate detection.
- **Done looks like:** save an outfit, ask for the same thing again, save
  again — second save nudges to the existing outfit, one doc exists.
- **Size:** S/M. **Constitution check:** passes.

### PC-22: Chat references (M/L, Stylist lane) — design first
- **Problem:** the chat can't be pointed at things — "this outfit but
  warmer", "build around this tee" has no mechanism.
- **In scope:** design doc first (founder validates), then build:
  @-style reference chips in the chat input; payload carries
  `{articleIds, outfitIds}`; server resolves to wardrobe lines + outfit
  context. Generalizes PC-16's previousPick (implicit, last-pick-only)
  into an explicit, reusable component.
- **Out of scope:** referencing across products; rich link previews;
  multi-outfit comparison.
- **Done looks like:** reference an outfit, say "warmer version of this",
  get an iterated pick without leaving chat; reference an article, say
  "build around this", get a full outfit containing it.
- **Size:** M/L (split design + build). **Constitution check:** passes.

## Parked this sprint (ranked, not selected)
- Lane metrics instrumentation (S/M) — rank 4.
- PC-13 outfit photo parsing (M/L) — rank 5, natural Sprint 8.
- PC-14 shop compatibility (M) — rank 6.
- PC-19 article dup detection (M) — parked per founder (not high priority).
