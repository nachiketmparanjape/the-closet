# Closet — backlog

Product #1. Live at https://closet-404e9.web.app ·
Repo https://github.com/nachiketmparanjape/the-closet ·
Sprints run in the wardrobe-app thread; records live here.

## Sprint 1 (2026-09-30 → 2026-10-14) — done

PC-1 (delete a piece), PC-2 (edit a piece), PC-3 (auto-suggest tags),
PC-4 (multiple photos per item), PC-5 (photo management + cover choice),
plus the most-frequent-color fix — all shipped and founder-tested
2026-10-06. Full cards: `sprints/sprint-01/PLAN.md`; history: `SHIPPED.md`.

## Sprint 2 (2026-10-11 → 2026-10-28) — approved 2026-10-11, started early

Full cards in `sprints/sprint-02/PLAN.md`. Blaze approved by founder
2026-10-11 — PC-6/PC-7 unblocked. BUG-1 parked (see below).

### PC-6: Backend proxy for AI calls (M) — DONE 2026-10-14
Callable Cloud Function (`describeItem`) holding the vision API key
server-side. Nothing else can use AI until this exists. Blaze approved
2026-10-11.

### PC-7: AI description + name suggestion at upload (M) — depends on PC-6
One vision call on the cover photo → name, description,
{pattern, fit, fabric_guess, formality, warmth}, cached in Firestore.
Decided 2026-10-06 (research in `PRODUCT.md`).

### BUG-1: Diagnose the upload bounce (S — diagnosis only) — PARKED
2 of 8 uploads bounced to the home screen on 2026-10-05; cause unknown.
Parked 2026-10-11 at the founder's call — it hasn't recurred. If it does,
he'll report the details (saved or lost? app closed or back to gallery?)
and diagnosis resumes; the fix becomes its own cut.

## Sprint 3 (2026-10-29 → 2026-11-11) — APPROVED 2026-10-14

Theme: the v1 core loop, complete. Full cards in `sprints/sprint-03/PLAN.md`.

### PC-9: Bulk upload (M)
"Bulk add" mode: N photos → N items, one `describeItem` call each
(bounded concurrency, progress UI, ~$0.05 for 50 photos). Per-item
failures isolated with retry; newest-first landing for review.
Single-photo per item; extra photos via PC-5's add-photos.

### PC-10: Chat stylist (M)
Conversational outfit picks over the cached descriptions + attributes
(text-only reasoning, per the decided research), occasion/weather/
preferences from conversation — no integrations. Reuses the PC-6 backend
pattern. The v1 loop's second half.

**Founder's call 2026-10-14:** PM proposed PC-8 (data model + editable
fields) + PC-9 first, stylist in Sprint 4; founder chose bulk upload +
stylist now, editable descriptions slide to Sprint 4. Known limitation:
AI-written descriptions/attributes stay read-only through Sprint 3.

## Ideas (untriaged)

- **Bulk upload (one photo per article):** select N photos → N items created
  automatically, AI describes each, user reviews/edits afterwards. Matches
  the real cataloguing behavior (photograph 50 things, curate later) instead
  of the tedious one-at-a-time flow. Founder-proposed 2026-10-14.
  PM notes: N photos = N `describeItem` calls (~$0.001 each — 50 photos ≈
  $0.05; run a few in parallel with progress UI); per-item failures must not
  block the batch (same principle as PC-7); gallery is already newest-first
  so new items surface at top for review; bulk mode is single-photo only,
  extra photos via PC-5's add-photos. **In Sprint 3 (approved 2026-10-14).**
- **View-aware AI descriptions:** the AI assumes the cover photo shows the
  front — founder uploaded a back-print tee 2026-10-14 and got "print on
  the front". Small fidelity detail, not a broken flow (and the description
  text isn't directly editable yet — only the name is). Proper fix: prompt
  must not assert front/back unless visible cues exist, plus make
  description/attributes user-editable (merges with PC-8's editable
  fields); the full fix belongs with the garment-model idea. Defer until
  the app is more mature.
- **PC-8: Color palette + future-proof item data model:** first-class
  `colors` array on items (AI-suggested, user-editable, provenance-tracked
  so AI re-runs never clobber user edits); promote AI attributes
  (pattern/fit/formality/…) to top-level editable fields; lazy migration
  from v1 `color`, no backfill script. Design doc: `DATA_MODEL.md`.
  Sprint 4 — deferred at the founder's 2026-10-14 call (bulk upload +
  stylist take Sprint 3).
- **"Surprise me" shuffle:** one-tap random outfit suggestion per category.
  Sprint 2 pull-in candidate if time.
- **Backfill AI descriptions for existing items:** run `describeItem` over
  the ~8+ pieces catalogued before PC-7 exists. Earns a card only if the
  founder wants the old pieces described too.
- **Chat stylist:** conversational outfit picks over the cached
  descriptions, reusing the PC-6 proxy. The v1 core loop's second half —
  **in Sprint 3 (approved 2026-10-14).**

### PC-13: Outfit photo parsing (M/L) — Sprint 5+ candidate

- **Problem:** Logging what you wore (or capturing an outfit you like)
  is manual assembly today. The fastest capture is a photo — mirror
  selfie or flat-lay — but there's no path from photo to outfit object.
- **In scope:** user takes/uploads an outfit photo; AI identifies each
  visible article (type, colors, pattern); user confirms each against
  wardrobe items via a shortlist picker (human-in-the-loop matching —
  auto visual-matching is the hard part, deferred); creates the outfit
  doc (source: "photo") and optionally logs a wear in the same flow.
  Doubles as the lowest-friction wear logging: photograph today's
  outfit, ~30 seconds.
- **Out of scope:** fully automatic visual similarity matching;
  parsing outfits on other people.
- **Done looks like:** founder photographs today's outfit, confirms 3
  articles from shortlists, taps save — outfit in history, wear logged.
- **Dependencies:** PC-12 (outfit object, wear events).
- **Known risk:** multi-garment parsing accuracy. Cost ~$0.001/photo.

### PC-14: Shop compatibility check (M) — Sprint 5+ candidate

- **Problem:** "Should I buy this?" is currently a guess. The wardrobe
  knows what you own and where the gaps are.
- **In scope:** user snaps a shop photo or online screenshot;
  describeItem extracts attributes; reasoning (new callable or
  askStylist extension) returns a compatibility score 0–10 *with
  reasoning* (color/formality/pattern harmony vs wardrobe), gap
  analysis ("fills your brown-shoe gap, duplicates your navy tops"),
  and 2–3 outfit suggestions incorporating it with existing pieces —
  only if asked.
- **Out of scope:** price/value judgment, purchase links, availability.
- **Done looks like:** founder screenshots a jacket → "8/10 — fills a
  gap, works with 6 existing pieces" + two outfits.
- **Dependencies:** wardrobe data + describeItem (both exist); richer
  with outfits/style profile, not required.
- **Known risk:** score calibration — label it "wardrobe fit", always
  show the reasoning, never a bare number.
