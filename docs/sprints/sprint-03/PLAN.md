# Sprint 3 — Closet

**Dates:** 2026-10-29 → 2026-11-11 (fixed; unfinished cuts roll over, no guilt)
**Status:** APPROVED by founder 2026-10-14. **Started early 2026-10-14** at the
founder's go-ahead — Sprint 2 fully closed (PC-7 phone-tested, bugs fixed),
same early-start precedent as Sprint 2 (which began 10-11 against a 10-15
plan date).
**Theme:** The v1 core loop, complete — catalogue at speed, then ask the app
what to wear.

## Founder's call (2026-10-14)

PM proposed PC-8 (data model + editable fields) + PC-9 (bulk upload) first,
stylist in Sprint 4 — the design session's "data-model cut to take first"
order. Founder overruled: **ship bulk upload + chat stylist now; editable
descriptions slide to Sprint 4.** Known limitation accepted: AI-written
descriptions and attributes stay read-only through this sprint (only
name/category/color are editable). Bulk review/edit covers keep/delete,
fixing tags, and retrying failures; a wrong AI guess (e.g. the back-print
tee) gets flagged but can't be hand-fixed until PC-8 lands. This is a
conscious tradeoff for the payoff: a working v1 loop by Nov 11.

## Cuts

### PC-9: Bulk upload (M)

- **Problem:** Cataloguing is one tedious photo at a time. The real
  behavior is "photograph 50 things, curate later" — and the founder is
  on leave with couch time to do exactly that.
- **In scope:** "Bulk add" mode: select N photos → N items created, one
  `describeItem` call each (bounded concurrency, 3–4 in parallel, progress
  UI; ~$0.001 per photo — 50 photos ≈ $0.05). Per-item failures are
  isolated and reported with a retry affordance; one bad photo never
  blocks the batch. New items land newest-first in the gallery for review.
  Single-photo per item in bulk mode; extra photos via the existing
  add-photos flow (PC-5).
- **Out of scope:** multi-photo bulk items; reordering within a batch;
  auto-retries on failure; editing AI-written descriptions/attributes
  (that's PC-8, Sprint 4 — known limitation, see above).
- **Done looks like:** founder bulk-uploads 10 photos on his phone,
  watches progress, lands on the gallery with 10 new items at top; one
  deliberately broken file shows as failed-with-retry while the other 9
  succeed.
- **Known risk:** 10+ parallel vision calls hammering the function.
  Design answer: bounded concurrency (3–4 at a time), progress UI keeps
  it honest.
- **Constitution check:** passes — cataloguing acceleration, squarely in
  v1 scope; no weather API, calendar, social, or commerce (VISION.md
  "Explicitly not v1").
- **Status:** in build 2026-10-14.

### PC-10: Chat stylist (M)

- **Problem:** The catalogue has no payoff yet. V1's core loop is "wake
  up → get an outfit → no scrolling" — the conversational half is missing.
- **In scope:** A chat surface in the app. The stylist reasons
  **text-only** over the cached descriptions + attributes from PC-7/PC-9
  (no vision at recommendation time, per the decided research); occasion,
  weather, and preferences come from the conversation, never from
  integrations. Reuses the PC-6 backend pattern for the API key (new
  callable or an extension of the proxy — whichever is smaller).
- **Out of scope:** weather/calendar integrations (VISION.md: the user
  types three words); outfit ratings, vibe-based picks, anchor-piece
  composer (inbox ideas — they reason through this chat later); image
  generation of outfits; editing descriptions mid-chat (PC-8, Sprint 4).
- **Done looks like:** founder opens chat on his phone, says "casual
  dinner, 60°F", gets an outfit assembled from pieces actually in his
  wardrobe, with names he recognizes.
- **Known risk:** the stylist invents pieces that don't exist. Design
  answer: ground the prompt with the real item list (names +
  descriptions) and instruct it to pick only from listed items; at a few
  hundred items max, the whole catalogue fits in context.
- **Constitution check:** passes — conversational recommendation *is*
  the v1 scope; integrations stay out per VISION.md.

## Sprint 4 seed

- **PC-8: Color palette + future-proof item data model (M)** — design
  done (`DATA_MODEL.md`): top-level editable fields, first-class colors
  array (name+hex), provenance tracking, lazy migration. Deferred here at
  the founder's call — bulk upload and the stylist both get better once
  wrong AI guesses are fixable.

## Notes

- Approved 2026-10-14; founder on medical leave — async as always, phone
  testing whenever he's up to it.
- Sprint 2's remaining work (PC-7 build + founder test) is independent;
  all AI work shares the `describeItem`/proxy pattern.
