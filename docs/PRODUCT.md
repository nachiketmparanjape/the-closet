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

- **SAM 3 / SAM 3D for garment photos (2026-10-25)** — full
  report `research_notes/closet-sam3-sam3d.md`. SAM 3 (Meta,
  Nov 19 2025) does promptable concept segmentation: one text
  prompt per garment type returns every instance mask — it
  replaces PC-36's planned parser+boxes finding step; the SAM
  License permits commercial use, hosted at ~$0.0025–0.005 per
  image (fal; per-concept calls possible). Recommendation:
  the PC-36 prototype becomes SAM 3 via fal → BiRefNet edge
  refinement, judged on the founder's real outfit photos as
  chartered. **Founder verdict (2026-10-25): SAM 3D ruled
  out.** The flow is adopted in his shape: SAM 3 crops each
  garment; the crop is normalized to a standard item shape
  (the Google Wardrobe presentation — isolated, centered,
  uniformly framed); the same standard view is generated
  for wardrobe items generally. The render standard is
  geometry (canvas, centering, margin, fill), not a baked
  background; PC-34's renders adopt it too. PC-34 stays on
  BiRefNet — SAM 3 makes masks, not alpha mattes. SAM 3D is
  mesh reconstruction, not try-on: ruled out above, its
  watch trigger stays recorded on PC-49.
  - Virtual try-off (the generative clean-view step the
    founder asked about next; note research_notes/
    closet-virtual-tryoff.md): the models exist and are
    lightweight, but the best one is license-blocked
    (academic use only), none is hosted, and the method
    invents hidden garment parts — against this catalog's
    promise that the picture is the user's own piece.
    Recommendation filed on PC-36: extraction stays
    canonical; try-off only as a labeled, opt-in second
    view behind a license gate and a fidelity test on
    real garments. **Founder verdict (2026-10-25):
    adopted as recommended.** The experiment runs as
    its own card, PC-57, independent of PC-36 and
    PC-34; its verdict decides whether a feature card
    is written. Google's "model-like" views are
  generative imagery (try-on/Doppl); its Photos "Wardrobe"
  (rolled out Sept 24, 2026) is extraction + generated
  previews — the two stages are different technologies.


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

### [OPEN 2026-10-17] UI/UX audit approach for the polish phase
- **Question:** the app is functionally complete but visually clumsy — are
  there tools/services to audit the UI and suggest improvements, and how
  should the polish work be planned?
- **Findings:** AI audit tools exist and several are free (UX Pickle $0;
  SecretUXD free tier with Nielsen-heuristics + WCAG 2.2; Pixelait/Fleck
  screenshot-based; UX Pilot trial) — but they're first-pass instruments,
  weak on "can a user figure out the flow." URL-based auditors can't pass
  the Google sign-in; only screenshot tools work here. Paid usability
  platforms are overkill: the FB-1 feedback form + daily digest already is
  unmoderated usability testing with his own testers. Microsoft Clarity
  (free heatmaps/recordings) is a later decision with a privacy tradeoff.
- **Recommendation:** Bramble runs a structured Nielsen-heuristics audit
  (free, immediate, knows the app's intent) as the first cut of a "UX
  polish" sprint; free AI tools cross-check accessibility/contrast; hire a
  designer only if big questions remain. Full report:
  `research_notes/closet-ux-audit-approach.md`.

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

### [DECIDED 2026-10-21] Garment extraction & worn-photo decomposition (PC-34 + PC-36)
- **Question:** can photos be parsed into clean garment cutouts
  (PC-34), and worn photos into individual articles + the outfit
  (PC-36) — readymade or from scratch, and at what cost? Benchmark:
  Google Photos' Wardrobe output.
- **Findings:** PC-34 is a commodity — Photoroom's API does
  benchmark-grade removal at $0.02/image ($20/mo floor covers 1,000
  images; per-response uncertainty score fits our confirm queue).
  remove.bg's API dies 2026-12-01 (traffic moves to Leonardo), so it
  is not an option. Open-source BiRefNet (MIT; BRIA's RMBG-2.0 is
  non-commercial — avoid) via per-second GPU hosting (Replicate/fal)
  lands ~$0.001/image. Gemini 2.5 Flash does segmentation masks but
  they are coarse, and Google dropped segmentation in Gemini 3.x —
  a label/box oracle, not the extraction engine. PC-36 has no
  readymade API: the buildable pipeline is a fashion parser (FASHN
  Human Parser, SegFormer, 18 classes — license needs a read) or
  Gemini boxes → per-garment BiRefNet refinement → describeItem tags
  → draft articles + outfit. It will trail Google on occluded/layered
  garments: a worn photo holds only visible pixels, and Google's
  renders benefit from whole-library best-shot selection and apparent
  generative cleanup — completion we would only ever ship labeled,
  with the raw cutout kept. Per onboarded user (~100 photos) every
  route costs cents-to-$2; the real difference is fixed cost
  ($20/mo buy vs a new GPU service to own).
- **Recommendation:** buy PC-34 (Photoroom behind one
  `extractGarment` callable, original photo never destroyed);
  prototype PC-36 on the same matting core and judge it on real
  outfit photos before sizing a build; never train from scratch —
  assembling open models is the from-scratch answer at our scale.
  Full report: `research_notes/closet-garment-extraction.md`.
- **Decision (founder, 2026-10-21):** Option A approved as
  recommended. First step is the evidence step, not the build:
  a ~20-photo Photoroom trial on the founder's real bed/carpet
  photos (quality + latency), then the PC-34 build and the
  PC-36 prototype get pulled through planning.
- **Amendment (founder, 2026-10-23) — provider decision
  superseded:** the trial ran (Photoroom, quality confirmed),
  the build landed behind the seam, and then the founder held
  on Photoroom's $20/mo floor and asked for a BiRefNet
  comparison on the same photos. Result: parity overall,
  BiRefNet stronger on translucent lenses. **Founder's call:
  BiRefNet via Replicate (no monthly floor) behind the same
  seam.** The full package was built the same day: provider
  swap, EXIF orientation baked in server-side, a two-layer
  quality gate (mask heuristics + a Gemini vision check; only
  passed renders are ever displayed), first-photo-only
  extraction scope, and ai_usage cost events on both AI calls
  (OBS-3a). Remaining: the founder adds his Replicate token
  to Secret Manager, the callable deploys, one live smoke
  call, and his phone validation.

### [RESEARCH 2026-10-23] Combina aesthetic study — copy / improve

- **Question (founder):** study Combina (iOS AI outfit planner)
  thoroughly, especially its aesthetic; what do we copy and
  improve? His bar: "It has to look like that for people to
  adopt."
- **Findings:** the polish is a system — warm ivory/ink + one
  brass accent; Didone serif doing all brand work with italic
  gold serif reserved for the payoff word; outfits as named
  magazine features ("Today's Feature: LOBBY HANDSHAKE");
  rationale composed as a "Behind the Look" bento sheet, not
  prose; wardrobe as category masonry of cutouts on cream
  cards (exactly what PC-34 renders unlock). Our DESIGN.md
  principles already agree; the gaps are temperature (Sprint
  18 just went cool Gallery-blue), named looks, composed
  explanation, and imagery discipline. Honesty notes: Combina
  has 5 ratings since 2026-04 (craft proven, adoption not);
  its frames are renders — its own site's real screenshot has
  a polo filed under "Shoes"; its hero imagery is AI models
  (PC-36 territory), and its register skews feminine-luxury —
  copy the system, re-aim the mood.
- **Options:** A adopt the register wholesale; B (recommended)
  warm-shift our tokens + type voice and add named looks,
  the Behind-the-Look sheet, and category masonry when PC-34
  lands; C file and wait.
- **Status:** Resolved 2026-10-23 — the founder widened the
  brief (UI elements included; any high-adoption design-led
  app as reference) and delegated the decisions to Bramble
  outright, iterating until he's happy. Direction: Option B,
  recorded as DESIGN.md §10 "Warm Editorial" (decisions
  A1–A5); W1 tokens live the same day, waves W2–W5 carded in
  the Sprint 18 plan. Full study:
  `~/workspace/studio/research_notes/closet-combina-aesthetic.md`
  (frames archived alongside it).

- **Reference app registry (2026-10-23, founder's rule:**
  keep the ones with a decent user base saved for detailed
  teardowns): `~/workspace/studio/research_notes/closet-reference-apps.md`
  — admission = ≥1,000 US App Store ratings. Tracked: Alta
  (4.9★, ~17K), Whering (4.7★, ~11.9K), Stylebook, Pureple,
  Fits, Acloset, Essembl (founder's find #2, 2026-10-23:
  4.5★, ~4.8K iOS + ~12K Android ratings, ~1.2M Android
  installs — the closest product-shape comp: Today / Studio /
  Rate my look / Shop tabs), Smart Closet, Indyx, Outfit
  Formulas (the founder's find, 4.4★, ~1.2K — qualifies at
  the threshold; formulas + community styling are the
  steal), Cladwell. Combina + PutTogether sit below the bar
  as design-only. Teardown queue: Alta → Essembl → Whering →
  Acloset → Indyx → Fits → Stylebook → Outfit Formulas.

### [RESEARCH 2026-10-27] tandpfun/wardrobe — open-source comp check

- **Question (founder):** What is github.com/tandpfun/wardrobe
  exactly? Is it direct competition? What can we use from it?
- **Findings:** An MIT-licensed, local-only, self-hosted web app
  (Vite + plain JS, local JSON database, no accounts, no
  hosted service). You feed it outfit photos plus your own
  OpenAI API key; a vision model (Responses API) detects every
  garment, the Images API (gpt-image) then *generates* clean
  product cutouts and optional "modeled" editorial photos of a
  reference person wearing the pieces. The import and outfit
  generation are packaged as agent skills run by Codex, with a
  review/regenerate/approve step before anything enters the
  library. Maturity check (high confidence, repo API): created
  2026-07-16, every commit landed that same day, zero pushes
  since; 2,258 stars / 329 forks rode a viral X post; no
  releases, no product, no users in the distribution sense.
- **Competition call:** Not direct competition today — no
  hosted product, no sync, no daily stylist loop, no
  maintenance since launch day; its user is a technical
  hobbyist willing to self-host. It is the closest
  open-source artifact to our concept, and its central bet is
  the opposite of ours: generative extraction accepted, with
  fidelity managed by a human/agent review gate, where our
  PC-34/PC-36 experiments (2026-10-27) chose segmentation
  (BiRefNet/SAM 3) because generation invents details
  (labels, removes sleeves) even with typed prompts.
- **Usable:** (1) The review-gate shape — jobs, originals kept,
  regeneration, explicit approval before a generated image
  joins the library — a worked example for PC-57's gating and
  any PC-49 revival. (2) The modeled-lookbook packaging
  (curate → generate → verify → save) as a template for PC-49
  if its triggers fire. (3) Independent validation of our
  pipeline shape: vision model lists garments first, then
  per-garment processing — the same Gemini-first flow the
  founder set for SAM 3. (4) Nothing to take on storage or
  extraction: local JSON doesn't transfer to a multi-device
  app, and per-image gpt-image cost is orders above our
  cents-per-image segmentation.
- **Status:** UPDATED the same evening — the founder adopted
  the review gate on sight ("make or break"); it is filed as
  PC-58 (issue #128), build timing deliberately later. The
  repo itself stays watch-only. Revisit trigger:
  the repo resumes activity, ships a hosted product, or PC-49
  un-parks. Full note also in the studio inbox (2026-10-27).
