# Sprint 4 — Closet

**Dates:** 2026-11-12 → 2026-11-25 (fixed; unfinished cuts roll over, no guilt)
**Status:** APPROVED by founder 2026-10-15. **Started early 2026-10-15** —
design-first process: PC-12's design was written, interrogated by the
founder (two fixes: outfit versioning — edits create new versions;
per-article wear history confirmed as derived), then approved.
**Theme:** Foundations for the outfit era — editable data, trustworthy
errors, and the outfit object with its full loop.

## Founder's call (2026-10-15)

PM pitched PC-8 + PC-11 with an optional "Surprise me" shuffle as third.
Founder: skip the shuffle — **the outfits data model and everything around
it matters more**. Sprint 4 is therefore two schema tracks (PC-8 items v2,
PC-12 outfits v3) plus the error-handling standard (PC-11). The outfit
*features* build in the same sprint once the design is approved — the
founder explicitly asked for the whole end-to-end mechanism working.

## Cuts

### PC-8: Color palette + item data model v2 (M)

- **Problem:** AI-written descriptions and attributes are read-only. Every
  AI misfire (the back-print tee) just sits there, unfixable.
- **In scope:** first-class `colors` array (name+hex, up to 3,
  source/provenance, primary flag — AI suggests, user confirms/edits,
  user entries untouchable by AI re-runs); promote AI attributes
  (description, pattern, fit, fabric, formality, warmth, brand) to
  top-level editable fields; palette editor UI in upload and edit views;
  lazy migration (read `colors` if present, else fall back to v1 `color`;
  no backfill script).
- **Out of scope:** embeddings, multi-photo AI analysis.
- **Done looks like:** founder opens any item, edits the AI description
  and fixes a wrong color; the palette shows AI chips he can add to,
  remove, or re-mark primary; old items keep working untouched.
- **Design:** `DATA_MODEL.md` v2 (done 2026-10-14).
- **Status:** SHIPPED 2026-10-15. `colors[]` (name/hex/source/primary,
  max 3); top-level editable `description`, `pattern`, `fit`,
  `fabricGuess`, `formality`, `warmth`, `brand`; `ai` blob extended with
  modelVersion/analyzedAt/photoIds. Palette chip editor in upload + edit
  views; edit saves delete the v1 `color` field. Lazy migration in
  gallery dot, search (now matches color names), and stylist prompt.
  Provenance shown as ✨ on AI colors. Tests:
  `tests/pc8-helpers.test.js`.

### PC-11: Standardized error handling (S)

- **Problem:** ~10 client catch sites each invent their own message
  (mostly raw Firebase `error.message`); server throws ad-hoc errors
  with no IDs, so a user report can't be matched to a log line.
- **In scope:** `functions/errors.js` server catalog (`fail(key)` with
  categories auth/validation/dependency/internal + short error IDs in
  HttpsError details); client `friendlyError(err)` choke point mapping
  Firebase codes to consistent copy (auth → sign-in wording, retryable →
  "try again", invalid-argument → server message, internal → generic +
  ID, network → "check connection"); structured logging with correlation
  IDs per the studio standard; mechanical swap of catch sites; unit
  tests for both mappings; function redeploy + CI.
- **Out of scope:** changing AI-failure-never-blocks-upload, silent
  storage cleanup, or the specific validation strings (already good UX).
- **Done looks like:** every user-visible error comes from the catalog;
  no raw SDK message reaches the UI; a reported error ID locates the
  server log line.
- **Design:** proposed and accepted 2026-10-14 (this plan).
- **Status:** SHIPPED 2026-10-15. `functions/errors.js` catalog (11 keys,
  4 categories; `fail(key)`, `codedError`, `newCorrelationId`, structured
  `logError`); both callables route through a `boundary()` (HttpsErrors
  pass through, downstream failures map via key, correlation ID on every
  log line); both functions redeployed and ACTIVE.
  Client: `public/js/friendly-error.js` choke point (13 call sites
  swapped — no raw SDK message reaches the UI), `window.onerror` +
  `unhandledrejection` root handlers with client error IDs, `reportError()`
  as the Sentry hook. Tests: `tests/errors-server.test.js` +
  `tests/errors-client.test.js` (25 assertions total across the suite).
  Reconciliation notes: (a) Sentry explicitly deferred — needs a Sentry
  account/DSN, the hook is ready; (b) vanilla-JS app, so "error
  boundaries" are window-level handlers + per-feature toasts, documented
  in code; (c) AI-failure-never-blocks-upload and silent storage cleanup
  preserved by design.

### PC-12: Outfit object + the end-to-end loop (L)

- **Problem:** Chat recommendations evaporate as text. There's no object
  to save, no history, no record of what was worn, no ratings — so the
  stylist can't learn the founder's taste.
- **In scope:** v3 schema (`outfits`, `wear_events`, `ratings`,
  `style_profile` — see `DATA_MODEL.md` v3); `askStylist` returns
  structured `{ reply, outfit: { itemIds, confidence, reasoning } | null }`
  with server-side ID validation; new `reflectOutfit` callable; outfit
  card in chat with Save; outfits history tab; one-tap "I wore this";
  user ratings (0–10 + note) on outfits and articles; app reflection +
  suggested preference with user confirm → style profile; manual outfit
  builder (gallery multi-select); per-article "worn N times" on item
  detail; Firestore rules for the four collections (manual deploy).
- **Out of scope:** article-direct wear logging (outfit-centric v1),
  offline support, push nudges, embeddings, implicit-negative consumption
  (reserved, later cut).
- **Done looks like:** founder gets a chat outfit, saves it, taps "I wore
  this", rates it 6/10 with "felt overdressed", and sees the app's
  reflection acknowledging the miss with a preference he can add to his
  style profile. History shows the outfit; the article shows its wear
  count.
- **Known risks:** capture friction killing the wear log (mitigated:
  one-tap logging on the chat card and in history); model returning
  unlisted item names (mitigated: server-side ID validation, degrade to
  text-only); the cut is large — build order inside it: schema + chat
  save + history → wear + ratings → reflection + style profile →
  manual builder + stats.
- **Constitution check:** passes — this is the v1 loop growing up, not
  scope creep: no social, commerce, or integrations.
- **Design:** `DATA_MODEL.md` v3 (written 2026-10-15) + the edge-case
  list below. **APPROVED by founder 2026-10-15 after interrogation**
  (two fixes: outfit versioning, per-article wear history confirmed).
- **Status:** SHIPPED 2026-10-15. Backend: `askStylist` returns
  `{ reply, outfit: { itemIds, confidence, reasoning } | null }` with
  server-side name→ID validation; new `reflectOutfit` callable
  (idempotent per rating via `reflectionFor`); style-profile grounding
  in the stylist prompt (best-effort read); Firestore rules for outfits,
  wear_events, ratings, style_profile (deployed via CLI — the REST
  release call needed a field the helper lacked). Client: Outfits tab +
  history (latest version per group), chat outfit card with Save, outfit
  detail (items, confidence, reasoning, versions, favorite), one-tap "I
  wore this", 0–10 rating + note, app reflection with suggested
  preference (confirm → style profile, cap 50, prune oldest app-sourced),
  manual builder (+ Build, source: manual), per-article "worn N× · last
  worn" on item detail. As-built refinements: v1 versionGroup == doc ID;
  user ratings written client-side direct to Firestore (reflection can't
  block them); reflection retry reuses the same ratingId. Tests:
  `tests/pc12-stylist.test.js` (34 assertions total across the suite).

## PC-12 edge cases (founder: "cover for all the cases")

1. Empty wardrobe → existing behavior (stylist asks for pieces); no card.
2. Model names unlisted/misspelled items → server drops misses;
   <2 valid IDs → `outfit: null`, text-only reply.
3. Double-tap Save → button disables on first tap (client guard).
4. Item deleted after outfit saved → outfit shows "Removed item";
   wear snapshots keep names, history intact.
5. Outfit edited → creates a NEW version (new doc, same versionGroup,
   supersedes set, favorite copied forward, appConfidence nulled). What
   was recommended is preserved. Wear events and ratings pin exact
   version IDs, so history stays precise forever. History lists latest
   version per group.
6. Rating without wearing → allowed (`wearEventId` null).
7. Wear without a saved outfit → v1: not supported (outfit-centric);
   noted limitation, fast follow if wanted.
8. Reflection call fails → rating stands, reflection "unavailable",
   retry offered. Model failure never blocks the rating (PC-7 rule).
9. Style profile unbounded → cap 50, oldest app-sourced pruned first,
   user can delete any entry.
10. Duplicate outfit names → allowed (names aren't keys).
11. Offline → friendly error via PC-11 (no offline persistence).
12. Occasion intent vs actual → both stored, labeled; disagreement is
    signal, not a bug.
13. Score comparability → UI labels "your rating" vs "app confidence";
    the delta is informational, never a single blended number.

## Notes

- Sprint 3 closed 2026-10-14 (PC-9 phone-tested by founder; PC-10 fix
  deployed, founder retry pending).
- PC-8's editable fields are a quiet prerequisite for the outfit loop:
  outfits built on uncorrectable AI descriptions inherit every misfire.
- Build order in-sprint: PC-8 → PC-11 → PC-12 (schema first, then
  features in the phase order listed above).
