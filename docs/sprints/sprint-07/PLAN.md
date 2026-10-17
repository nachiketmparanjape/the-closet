# Sprint 7 — Trustworthy history, referenceable chat

**Dates:** 2026-10-17 → 2026-10-31 (fixed; unfinished cuts roll over, no guilt)
**Status:** in progress — all three planned cuts shipped; founder testing.
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
- **Out of scope:** editing a wear's note/occasion after the fact; bulk ops.
- **Size:** S. **Constitution check:** passes (no non-goal conflicts).

### PC-18: Outfit dedup (S/M, Outfits lane) — DONE 2026-10-17
- Shipped: content hash (sorted itemIds + source) stored as `dedupHash` at
  save; both chat and builder saves check first — identical save links to
  the existing outfit with a toast instead of minting a duplicate.
  Forward-only; 80/80 tests (3 new hash tests), live via CI.
- **Problem:** saving the same pick twice mints two unrelated docs —
  wear history and ratings fragment across duplicates.
- **Out of scope:** merging already-existing duplicates (forward-only);
  fuzzy/near-duplicate detection.
- **Size:** S/M. **Constitution check:** passes.
- Bonus, founder-requested mid-sprint: **delete outfit** — danger button in
  the outfit view; confirm names the wear count if worn; wear events stay
  (history is factual), outfit doc goes; the live listener refreshes and
  closes the view. Firestore rules already allowed owner delete.

### PC-22: Chat references (M/L, Stylist lane) — DONE 2026-10-17
- Shipped: `@` in chat opens a picker (Pieces + Outfits sections, name
  search); selections become removable chips above the input, sent as
  structured `{articleIds, outfits[]}` (outfit contents resolved client-side,
  every id re-validated server-side against the real wardrobe). New
  EXPLICIT REFERENCES prompt block outranks the implicit previousPick.
  87/87 tests (7 new), `askStylist` redeployed ACTIVE, live via CI.
- Design doc: `PC-22-DESIGN.md` (approved by founder before build). One
  deviation: outfit contents resolved client-side rather than via a server
  Firestore read (same trust level, no added latency).
- **Problem:** the chat can't be pointed at things — "this outfit but
  warmer", "build around this tee" has no mechanism.
- **Out of scope:** referencing across products; rich link previews;
  multi-outfit comparison.
- **Size:** M/L (split design + build). **Constitution check:** passes.

## Founder feedback round (2026-10-17, phone testing)

- **@-tags not ingested?** Founder reported the chat ignoring a tagged item.
  Investigated: prompt construction verified locally, then ran his exact
  scenario against the live model — it built the outfit around the tagged
  joggers correctly. His screenshot showed the tagged message composed but
  unsent. No code change; asked him to tap Send and report.
- **Outfit naming + rename — SHIPPED 2026-10-17.** All chat saves were
  "Outfit · \<date\>", indistinguishable same-day. New outfits now get
  descriptive default names from their pieces
  ("Black Nike Air joggers + White Cotton Tee +1"); the outfit view has a
  Rename button (metadata-only, no version bump). 90/90 tests, live via CI.

## Parked this sprint (ranked, not selected)
- Lane metrics instrumentation (S/M) — rank 4.
- PC-13 outfit photo parsing (M/L) — rank 5, natural Sprint 8.
- PC-14 shop compatibility (M) — rank 6.
- PC-19 article dup detection (M) — parked per founder (not high priority).
- PC-23 archive layer (M) — parked per founder 2026-10-16; trigger: a
  "deleted something I wanted back" moment or an article delete visibly
  breaking an old outfit.
