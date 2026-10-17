# Closet — product doc

Living reference for humans and AIs picking up this project: what the product
does, grouped by capability, and *why* each exists. Deliberately not verbose.

## Maintaining this doc (read before editing)
- **Revise, don't append.** When a capability changes, rewrite its bullet in
  place. This doc always describes the product *as it is now* — never as a
  history of how it got here.
- **Capabilities, not paper cuts.** Group by what the user can do, not by
  sprint or PR. A paper cut that extends an existing capability edits that
  capability's bullet; only a genuinely new capability earns a new section.
- **Every bullet earns its place with a why.** One line. If you can't say
  why, it doesn't belong here yet.
- **History lives elsewhere.** Per-update detail goes in `SHIPPED.md` and
  sprint plans — never duplicated here.
- **Research ends in a decision, kept compact.** Open topics get findings;
  findings get a decision, even "don't build it." Decided topics stay as a
  short record — question, key findings, decision — so the reasoning remains
  visible. Full reports live in `research_notes/`.

Not a changelog — per-update history lives in `SHIPPED.md` and the sprint
plans under `sprints/`. If something here disagrees with those, this doc wins
and the history is just history.

## What it is

An AI wardrobe stylist: catalogue your clothes, get outfit picks. The morning
decision is the core loop — wake up, get an outfit, no scrolling. Full scope
and non-goals: `VISION.md`.

## Capabilities

### Catalogue a piece
- **Add with up to 4 photos.** Why: one photo can't capture a garment — front,
  back, fabric detail each matter. First photo is the cover.
- **Auto-suggest tags at upload.** Why: manual tagging is the biggest
  cataloguing friction. Canvas dominant-color sampling pre-fills the palette
  hex; the AI description (below) fills the rest. User confirms before
  saving. (The on-device MobileNet category guess was removed 2026-10-15 —
  the API is more accurate and the model download was pure overhead.)
- **AI description at upload (shipped 2026-10-14, PC-7).** One vision call on
  the cover photo generates name, description, category, colors (constrained
  to the canonical palette), pattern, fit, fabric guess, formality, warmth,
  brand (parent brand), subtype, and style tags — cached in Firestore, user
  confirms/edits before saving. The on-device category guess was removed
  2026-10-15 (the API is more accurate); the canvas dominant-color sampler
  stays for the palette hex.
- **Canonical color palette (shipped 2026-10-15).** 32 color families with
  hex anchors and alias mapping; AI colors are prompt-constrained to it,
  user-added colors resolve to the nearest family by hex (OKLCH distance).
  Every color carries a hex (sampled or palette-anchor) so swatch and label
  can't contradict. Foundation for color-theory reasoning.
- **Brand normalization (shipped 2026-10-15).** Parent brand from the model
  ("Uniqlo UT" → "Uniqlo") plus a lowercase `brandKey` for grouping.
- **Edit name / category / colors / attributes / brand / subtype / style tags.**
  Why: mistags happen; fixing shouldn't require delete + re-upload. AI
  entries are replaceable, user entries untouchable (source authority rule).
  (Photo replacement stays out — delete the piece instead.)
- **Delete a piece.** Why: obvious. Removes the Firestore record *and* all of
  the item's Storage photos — no orphans.
- **Bulk upload (shipped 2026-10-14).** One photo per article auto-creates
  items for batch cataloguing, then curate.

### Get an outfit (shipped 2026-10-15, PC-12; quality rework Sprint 5)
- **Conversational stylist.** Ask for an outfit; the model picks from the
  real wardrobe (stable handles, server-validated), judged against a
  versioned styling rubric (color theory, formality, weather, proportion,
  occasion). Returns sub-scores per dimension; confidence is computed in
  code from the score mean. Slot validation (one top, one bottom) with one
  repair attempt.
- **Saved outfits with versions.** Edits create new versions (stable
  versionGroup, supersedes chain) — the original recommendation is kept.
- **Wear logging + ratings + reflection.** One-tap "I wore this", 0–10
  rating with note, model reflection on the prediction/outcome gap.
  Reflection is history-aware: preferences are suggested only for explicit
  statements or repeated patterns (never one-offs), with cited evidence,
  and only enter the style profile on explicit user confirmation.
- **Manual outfit builder.** Same outfit schema, source "manual".
- **Per-article wear stats.** "Worn N× · last worn …" derived from wear events.

### Manage a piece's photos
- **Choose the cover photo.** Why: the cover drives the gallery card (and
  later, recommendations). Picking beats the delete-until-right dance.
- **Add / delete individual photos.** Why: wrong uploads happen; you shouldn't
  have to nuke the whole piece to fix one bad photo. A piece always keeps at
  least one photo.

### Browse the wardrobe
- Category filter chips, text search, photo cards. Why: the catalogue is only
  useful if you can find things in it.

## Research

Topics we investigate *before* building, so product decisions rest on
findings — feasibility, cost, overengineering risk — instead of vibes.
Decided topics stay as compact records; full reports live in `research_notes/`.

### [DECIDED 2026-10-06] Article understanding for outfit recommendations
- **Question:** how well must the app "understand" each article for outfit
  recommendations — one photo + tags, or multi-photo understanding?
- **Findings:** one photo + a cheap vision model reliably yields category,
  color, pattern, fit, formality (fabric is best-effort — label it a guess).
  No published evidence that multi-photo analysis improves *outfit decisions*.
  At 300 items the whole catalogue fits in chat context — embeddings solve a
  scale problem we don't have. One-time analysis at upload (~$0.0001/item)
  beats vision at recommendation time on cost, latency, and privacy.
- **Decision:** one vision call on the cover photo at upload → description +
  {pattern, fit, fabric_guess, formality, warmth} cached in Firestore; the
  chat stylist reasons over text only. Needs a Cloud Functions proxy for the
  API key (Blaze card on file; free tier covers usage).

### [DECIDED 2026-10-14] Color representation for AI recommendations
- **Question:** for outfit recommendations, should garment colors be stored
  as names, hex codes, or both — and how many colors per garment? What does
  the industry do?
- **Findings (representation):** ColorGPT (arXiv 2025, LLM color
  recommendation) found hex alone is a strong baseline for precise color
  tasks, but the **name+hex combination performed best** for palette
  generation — adding color names helped LLMs grasp the task. Separately,
  NumColor shows models natively fail to parse hex codes (subword
  tokenization fragments them). Industry fashion-AI apps (e.g. seasonal
  color analysis) compute in pixel/hex space, then reason over *named*
  palettes — the same hybrid.
- **Findings (cap):** the entire retail industry models **one** color per
  product variant — schema.org `color` is singular Text; Google Merchant
  Center's color attribute takes one descriptive name ("Red", not
  "#FF0000"), with multi-color garments reduced to the predominant color;
  PIMs put color at the variant-group level. There is no multi-color
  palette to copy from Uniqlo-style catalogs: retail models color for
  *selling variants*, not for *matching outfits* — different job. For
  summarization, k-means palette extraction standardly uses k=3–6.
- **Decision:** keep **name+hex per color** (research confirms the
  combination beats either alone): names for LLM reasoning, hex for
  display and future programmatic color math (results fed back as words).
  **Cap stays at 3** — matches standard summarization practice, is richer
  than retail's 1 where it matters (accent matching), and 4th+ colors are
  usually shading noise. The single `primary` color keeps us compatible
  with the industry's one-color convention for display/filtering.

### [DECIDED 2026-10-16] Rating stays gated behind wearing
- **Question:** should a user be able to rate an outfit without logging it as worn?
- **Decision:** no — rating remains post-wear only. The rating is the
  reflection loop's input (predicted confidence vs actual outcome), and an
  outcome only exists once the outfit was actually worn. Founder call.
