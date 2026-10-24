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

### BUG-1: Diagnose the upload bounce (S — diagnosis only) — KILLED 2026-10-24
2 of 8 uploads bounced to the home screen on 2026-10-05; cause unknown.
Parked 2026-10-11 at the founder's call — it hasn't recurred. KILLED at
the Sprint 20 planning walk (founder-approved disposition): three weeks
of heavy uploading since, zero recurrence. If it ever recurs it re-files
as a new card with real data.

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

- **Stylist as an agent (founder vision 2026-10-18):** chat as a first-class
  interface to the whole app — some users live in the UI, others do
  everything through the stylist (like Muse). Reads first (wardrobe
  search, wear history), then writes (log wear, save/rate, edit items);
  tool calls execute client-side against Firestore rules. Sequencing:
  reads before writes; revisit when the stylist lane is solid. See
  `docs/VISION.md` ("Long-term: the stylist as an agent").
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
- **"Surprise me" shuffle:** one-tap random outfit suggestion per category.
  Sprint 2 pull-in candidate if time.
- **Backfill AI descriptions for existing items:** run `describeItem` over
  the ~8+ pieces catalogued before PC-7 exists. Earns a card only if the
  founder wants the old pieces described too.
- **Chat stylist:** conversational outfit picks over the cached
  descriptions, reusing the PC-6 proxy. The v1 core loop's second half —
  **in Sprint 3 (approved 2026-10-14).**

### PC-13 (remaining): wear logging in the photo-parse flow (S) — Sprint 14
- **Status 2026-10-18:** the photo half shipped ("Match a photo" — AI
  identifies articles, user confirms from shortlists, saves outfit with
  source "photo"; see SHIPPED.md). What remains: logging the wear in the
  same flow — today it's photo → save → open outfit → "I wore this"
  (three steps, two screens). The cut: "Save & log as worn today" in one
  tap, doubling photo-parse as the lowest-friction wear logger.
- Original full-scope card archived in git history; this is the remainder.

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

### PC-23: Archive layer for outfits/articles (M) — parked
- **Idea (founder 2026-10-16):** soft-delete instead of hard-delete across
  objects — archived items hidden from views but restorable, old outfits
  and wears keep resolving instead of showing "Unknown item".
- **Value case:** undo for destructive actions; referential integrity for
  history; keeps the Personalization learning substrate intact.
- **Cost case:** every query + the stylist wardrobe builder needs an
  `archived == false` filter — one missed filter and the AI recommends
  ghost clothes. Plus archive/restore/purge UI.
- **Trigger to build:** founder says "I deleted something I wanted back",
  or an article delete visibly breaks an old outfit. Parked until then
  per founder 2026-10-16.

### PC-24: Wearer style preference — "shop for me like" (S/M)
- **Idea (founder 2026-10-16):** clothing norms are heavily gendered, and
  the stylist currently has zero signal about the wearer — it guesses or
  defaults. Capture an explicit, optional wearer preference: shop
  menswear-leaning / womenswear-leaning / no preference (mix).
- **Shape:** a style-profile setting (framed as "when I say 'a shirt',
  which side do you shop?" — not "what is your gender?"); passed to the
  stylist prompt as recommendation guidance. Optional, changeable anytime.
- **Deliberate non-goals:** never inferred from photos, names, or existing
  clothes; binary is not the only option; does not constrain what the
  user may own or ask for.
- **Not yet sized** — parked; candidate for prioritization.

### PC-25: Garment gender tagging (S/M)
- **Idea (founder 2026-10-16):** tag clothes as menswear / womenswear /
  unisex — a property of the *garment's design intent*, kept separate from
  the wearer's identity (PC-24). A man can own womenswear; the data model
  must allow it.
- **Shape:** optional `gender` field on items; AI suggests at upload (it can
  usually read design intent off the garment), user confirms. Enables
  filtering and gives the stylist fit language ("women's blouse" vs
  "men's shirt").
- **Not yet sized** — parked; candidate for prioritization.

### PC-26: Gender-aware stylist prompting (M, depends on PC-24 + PC-25)
- **Idea (founder 2026-10-16):** once both signals exist, teach the rubric
  to use them with nuance: honor the wearer preference by default, use
  garment tags to avoid mismatches, and handle cross-shopping gracefully
  ("I want to try something from the other side") without lecturing.
  Includes a copy audit of prompts and UI for gendered assumptions.
- **Not yet sized** — parked; candidate for prioritization.

### UX-12: First-run tutorial / onboarding experience (not yet sized)
- **Idea (founder 2026-10-17):** a quick tutorial for new users so they can
  figure out what to do on their own.
- **Why parked:** the app is mid-UX-polish — flows are still changing, and a
  tutorial built now rots with every change. The empty states already teach
  (wardrobe empty state explains the loop; outfits hint names the three
  paths), and the labeled "Ask the stylist" button closed the biggest
  discoverability gap. If onboarding is needed, lightest touch first:
  coach marks on first run, not a carousel.
- **Revisit trigger:** a stranger (not a hand-held tester) gets lost in the
  app, or the UX polish sprint settles and the flows stop moving.

### AUTH-1: Privacy-friendlier sign-in — IN SPRINT 13
Anonymous-first auth with Google/email-link upgrade, one account per
email, guest banner + privacy note. Built 2026-10-18, in founder phone
validation. Design: `docs/sprints/sprint-13/AUTH-1-DESIGN.md`.

### Personalization: exploration vs. exploitation (open modeling question)
- **Problem:** the vibe profile only learns from what the user wears —
  untried vibes score ~0, so the stylist never suggests them, so they're
  never tried. A self-reinforcing loop (selection bias).
- **Shape (open):** occasional exploratory suggestions, counterfactual
  logging, or an explicit "surprise me" handle. Deliberately un-designed
  for v1 — parked until the profile has real data.
- **Spec:** `docs/PERSONALIZATION.md` ("Open: exploration vs. exploitation").

### PC-29: Trips — travel packing recommendations (L)
- **Idea (founder 2026-10-18):** packing for travel is stressful; it needs
  weather × personal taste × local culture. Trips tab; trip objects
  (destinations + dates + notes, multi-leg in the model); packing list
  from the wardrobe scored per leg against forecasts; outfits per leg;
  trip-aware chat and trip-aware shop check ("will this earn a place *for
  this trip*?").
- **Proposal:** `docs/proposals/TRIPS-PROPOSAL.md` — founder decisions
  recorded 2026-10-18 (articles + outfits lists, day-by-day optional,
  simple UI; chat mode; single destination v1; trip-tagged shop items).
  Open thread: trip preference curation (bloat-aware design).
- **Status:** Phase 1 shipped in Sprint 15 and Phase 2 shipped in
  Sprint 16 (both founder-validated 2026-10-19). Packing iteration is
  conversational: the trip detail CTA "💬 Talk to me for changes" opens
  trip chat, which rewrites the plan via the `updateTripPacking` tool
  call; the blind Re-plan button is gone. Remaining work split out:
  Phase 3 → PC-31; trip-preference curation stays an open thread here.
  Designs: `docs/sprints/sprint-15/TRIPS-PHASE1-DESIGN.md`,
  `docs/sprints/sprint-16/PHASE2-TRIP-CHAT-DESIGN.md`.

### PC-31: Trips Phase 3 — trip-tagged shop items + unified trip view (M)
- **Idea (founder 2026-10-18, PC-29 decision 4):** shop-list items can
  be tagged to a trip ("will this earn a place *for this trip*?"); they
  show in the generic Shop list AND in a unified trip view (packing +
  tagged shop items in one place).
- **Status:** In Sprint 19 (card 2). BUILT 2026-10-24 — tagging UI in
  the check detail, tag-at-birth from trip chat, trip name on
  Shop cards, "Shopping for this trip" section on the trip
  page. Founder phone validation pending.

### OBS-2: Error logging & handling overhaul (M)
- **Idea (founder 2026-10-19):** treat error data as *system quality
  data* — available for debugging now and for monitoring in the long
  run, not just ad-hoc log dives. Tonight's session is the evidence:
  the packing bug hid for two turns because a rejected tool call was
  silently dropped, and the "not signed in" flake surfaced in metrics
  as `(uncoded)`.
- **Scope (to be refined at sprint planning):**
  - **Taxonomy audit:** every callable throws coded errors only; fix
    the key-loss where HttpsError-carried codes log as `(uncoded)`
    (logError reads `.key`; make it read `.code`/catalog consistently).
    Client copy exists for every code (friendlyError coverage check).
  - **Rejections are events:** every dropped/invalid tool call,
    malformed model response, and self-heal retry is logged
    structured (args shape, no user content) — generalizing
    `trip_tool_args_rejected`. Nothing fails silently server-side.
  - **Quality report:** extend the OBS-1 metrics into a durable
    report — per-function success rate, top error keys, client error
    counts, latency percentiles, self-heal rate — runnable on demand
    and summarizable on a cadence. Decide where it lives (local
    script vs. scheduled digest) at planning.
  - **Alerting:** a cheap threshold signal when a function's failure
    rate spikes (mirrors the $50 budget-alert pattern; notify-only).
  - **Client side:** reportError already persists to `client_errors`;
    add session correlation so a user report ("it broke at 9:28")
    can be matched to the exact server call.
- **Status:** SHIPPED 2026-10-24 (Sprint 20). Live-smoke
  verified: failure events land in error_events with their
  catalog keys; the quality report reads them back.

### OBS-3: AI consumption analytics — cost attribution (M)
- **Idea (founder 2026-10-23):** know exactly where AI spend
  comes from — per feature, per model, per outcome — so
  optimize / cut-back decisions are made on data, not on a
  provider bill total. Raised alongside PC-34, which adds two
  new AI consumers (Replicate extraction + a Gemini gate check)
  to the existing seven Gemini callables. Design spec:
  `docs/OBSERVABILITY.md` (proposal v1, 2026-10-23).
- **Scope:**
  - One append-only Firestore event per AI call (`ai_usage`):
    correlationId, feature, provider, model, surface, token
    counts / predict seconds, latency, outcome, USD estimate
    stamped with its pricing version, raw units kept so any
    window can be re-priced. Metadata only — no prompts, no
    photo bytes. Written via one helper (`functions/usage.js`),
    fire-and-forget so analytics can never break a user call.
  - Pricing table in code (`functions/pricing.js`, versioned):
    Vertex per-1M-token rates per model; Replicate per-second
    hardware rate × predict_time.
  - Report (`usage-report.js`, extending the metrics.js
    pattern): spend by feature × provider × model, trend,
    success/error rates beside cost (cost per successful
    outcome is the headline), unit economics (per item
    catalogued, per stylist turn), top drivers named.
  - Offline analysis: JSONL/CSV export → DuckDB locally.
    Graduation path only if volume demands: Firestore →
    BigQuery export, same schema (BigQuery plays the
    Hive/Presto role in this stack; nothing fancier is
    warranted at hundreds–thousands of calls a month).
- **Slices:** 3a instrument extractGarment's two calls (rides
  the PC-34 build); 3b retrofit the seven existing callables;
  3c the report. Sibling to OBS-2 (error quality) — same
  events philosophy, cost lens instead of failure lens.
- **Status:** Validated by the founder 2026-10-23 with the
  widest sequencing: all three slices in one pass alongside
  PC-34. Built 2026-10-23 — `functions/usage.js` +
  `functions/pricing.js` (PRICING_VERSION 2026-10-23.v1;
  gemini-3.5-flash at the corroborated $1.50/$9.00 per 1M,
  BiRefNet at the T4 per-second rate), events on extract's
  two calls plus all seven existing callables (per-call
  tracker threaded through each module; one event per model
  call, so multi-call stylist turns attribute honestly), and
  `usage-report.js` (local, gitignored like metrics.js):
  spend by feature × provider × model, success/error rates
  beside cost, unit economics per catalogued item / stylist
  turn / passed extraction, month-to-date vs a --budget
  figure. Firestore rules deny client access to `ai_usage`
  (admin-side reads only). Suite green at 256. Data starts
  accumulating with the first AI call after the redeploys.

### PC-32: Chat threads — side chats per context (M)
- **Idea (founder 2026-10-19):** one chat for everything mixes
  contexts (a New York pin surfacing inside the Vancouver trip chat)
  and breaks continuity (reopening a trip chat re-anchored a fresh
  conversation). Threads = side chats: a general thread plus one
  persistent thread per trip, each with its own history and its own
  context scope — continuation of context at the right place, right
  time.
- **Design:** `docs/proposals/THREADS-PROPOSAL.md`. An interim
  threads-lite went live 2026-10-19 (session-scoped per-context
  message lists, anchor-once, trip-mode pin scoping server +
  chip). The full cut persists threads
  (`users/{uid}/chat_threads/{threadId}`), resumes them across
  reloads, and cleans up on trip delete.
- **Status:** Not started (proposal stage). Sprint candidate.

### PC-33: Trip steering in chat + pin discipline (M)
- **Idea (founder 2026-10-20):** asking the general chat about a
  trip *next week* produced a "Remember as current location?" pin
  proposal for the destination. Verified problem: pins carry an
  end date but no start date, so a saved pin would have taken
  effect immediately and outranked measured weather — and no trip
  object existed, because the chat never suggested one. His
  direction: trip questions should steer toward creating a trip
  object, with a one-line education on why working inside it is
  better; one-off advice stays available.
- **Design:** `docs/proposals/TRIP-STEER-PROPOSAL.md`. Three
  parts: (1) a trip-intent confirm card in general chat (prefilled
  destination/dates, create-or-dismiss, at most once per
  conversation, advice never gated); (2) the one-off path stays
  write-free — conversation-stated context already outranks
  everything; (3) pin discipline — location/weather pins are
  proposed only for facts true now; preference pins are unaffected;
  a steering card suppresses a pin proposal for the same fact.
  Future-dated pins (a `validFrom` field) were considered and
  rejected in the proposal, with a revisit trigger recorded.
  Principle: pins are the present-tense layer; trips own the
  future. The discipline half can split out as an (S) at planning.
- **Status:** Not started (proposal stage). Sprint candidate;
  sits next to PC-32 (threads) and CONTEXT-1 (pins).

### UX-13: Visual redesign + design system (L)
- **Idea (founder 2026-10-20):** the app looks extremely
  rudimentary next to modern apps; it has to feel modern and
  seamless, because feeling drives whether someone wants to use
  it — and this product's initial overhead (adding your clothes)
  means everything after onboarding must be really good.
- **Design:** `docs/proposals/REDESIGN-PROPOSAL.md`. System
  first: a living `docs/DESIGN.md` (tokens, component kit,
  motion rules, state patterns), 2–3 directions mocked on the
  wardrobe grid for the founder to pick, then behavior-preserving
  screen-by-screen re-skins in priority order. Flow changes stay
  separate decisions. The proposal also carries the
  framework-rebuild analysis (benefits, risks, the timing
  tension) and a concrete decision point: evaluate at the first
  planning walk after the design doc is validated and two screens
  are re-skinned, decided by a timeboxed one-screen spike against
  pre-agreed GO criteria; if GO, strangler-style, never a freeze.
- **Status:** In Sprint 18 — design foundation batch (plan:
  `docs/sprints/sprint-18/PLAN.md`). DESIGN.md v1 is the first
  card; direction validation happens on the explained doc plus
  the wardrobe-grid reference implementation.

### UX-14: Onboarding — cut time-to-first-value (L)
- **Idea (founder 2026-10-20):** onboarding is the biggest
  hurdle for the concept — the app is extremely useful once a
  wardrobe is in, and getting it in is the problem to solve for
  the long run.
- **Design:** `docs/proposals/ONBOARDING-PROPOSAL.md`. Metric:
  time-to-first-value (first pick the user rates good), not items
  added. Three attack lines: (1) cut cost per item — a
  closet-dump confirm queue (AI describes, user only confirms),
  capture in existing moments (packing, laundry), worn-today
  outfit capture that doubles as a wear log; (2) cut the
  threshold — greatest-hits first (~10 favorites unlock picks),
  a labeled demo wardrobe to feel the value before paying the
  cost; (3) grow the catalogue itself — chat-driven and
  gap-driven add prompts under a strict once-per-conversation
  budget. Subsumes UX-12's tutorial question (disposition at the
  planning walk); first-run is designed as part of UX-13.
- **Status:** Not started (proposal stage). Each attack line
  becomes its own sized cut at a planning walk.

### UX-15: Sheets & popups feel native — motion, swipe, backdrop everywhere (M)
- **Size:** M
- **Value:** Founder report (2026-10-21): the stylist chat
  "looks like a bottom-up drawer but there is no visible
  smooth animation — jittery or none at all," with no
  swipe-down and inconsistent tap-outside dismissal. His
  instruction: one item that fixes this class of thing
  across the whole app, not a patch per sheet. Sheets are
  how everything in Closet happens — add, bulk, chat,
  trips, outfits, account — and right now each teleports
  in, vanishes on close, and follows its own dismissal
  rules. Per his UX-13 framing, feeling decides whether
  people stay; this is the feeling layer of every flow.
- **Current state (audited 2026-10-21, in the card so the
  cut starts from facts):** an entrance keyframe exists
  (.modal 260ms rise; chat 24px) but — (a) NO exit
  animation exists: closeOverlay hides instantly;
  (b) the backdrop dim pops with no fade; (c) 24px of
  travel on a 92dvh sheet doesn't read as a drawer slide;
  (d) backdrop-tap dismissal is wired on only 4 of 13
  overlays; (e) swipe-down exists nowhere; (f) Esc covers
  only some overlays; (g) openOverlay focuses the first
  focusable element instantly, which can jump layout on
  mobile.
- **Scope:** one sheet system for all 13 overlays (item,
  upload, bulk, chat, trip, outfit, builder, composer,
  photoParse, shopCheck, shopCheckDetail, account,
  feedback):
  - Motion both ways: backdrop fades; bottom sheets slide
    from the bottom edge with full travel (~280ms in,
    ~220ms out, standard easing), centered modals
    fade/scale subtly; transform/opacity only — no layout
    animation, no jitter; closeOverlay gains a closing
    state so the exit plays before hidden flips.
  - Dismissal parity on every sheet: close control,
    backdrop tap, swipe-down (drag follows the finger,
    threshold/velocity snap), Esc. Dismissal respects
    in-flight work — the bulk sheet's minimize semantics
    are the model; a dirty form's rule (confirm vs stay)
    is decided per sheet in the cut, never by accident.
  - No focus theft on open: focus moves only when the
    sheet's job needs the keyboard, never an instant
    programmatic focus that jumps scroll.
  - prefers-reduced-motion: crossfade only, no travel.
- **Acceptance:** on the founder's phone, every sheet in
  the app opens and closes with visible, smooth motion;
  every sheet dismisses by backdrop tap and swipe-down;
  nothing teleports; DESIGN.md §5 is updated to describe
  the system as built (the spec already promises motion —
  this cut makes the promise true).
- **Status:** In Sprint 19 (card 1). BUILT 2026-10-24 — one sheet
  system live on all 17 overlays; browser-smoke verified;
  founder phone validation (the acceptance gate) pending.

### PC-34: Garment extraction & clean rendering (research spike)
- **Size:** Spike S, then size from findings
- **Value:** Founder's long-term direction (2026-10-21): user photos
  are shot on beds and carpets, and no layout survives an ugly
  source photo — the Sprint 18 tiles read "clunky" partly for
  this reason. The apps he admires extract the garment itself
  and render it clean (cutout on a neutral ground). He also
  reports Google Photos (Android) auto-builds a wardrobe
  collection from photos of him wearing clothes — if users can
  export those, importing pre-extracted garments could collapse
  the cataloguing cost (an attack line for UX-14).
- **Scope:** Research spike, fixed protocol (TL;DR, findings,
  options + tradeoffs, recommendation, sources), answering:
  (1) server-side background-removal / segmentation options —
  quality on soft garments, per-photo cost at our scale, API
  vs self-hosted; (2) what Google Photos' clothing collection
  actually is and whether users can get those images out
  (founder-reported — verify, don't assume); (3) where
  extraction slots into the pipeline (upload-time clean render
  alongside the original — the original is never destroyed).
  Design keeps the photo honest for now: tiles render best-
  effort, extraction is a rendering layer, not a data change.
- **Status:** Not started. Filed 2026-10-21 from the founder's
  note; research runs on pull. Update same day: question (2) is
  founder-verified — the collection's images save to the camera
  roll and upload into Closet cleanly (see PC-35); the spike
  still owns the feature's name, limits, and platform reach.
  Founder expansion (2026-10-21, later): seeing the exported
  cutouts, he set them as the quality benchmark and posed the
  spike's two charter questions verbatim — (Q1) is it actually
  possible for us: is there a readymade solution, and if not,
  can we build it as good from scratch? (Q2) how expensive is
  it — per photo at our scale, and in build/maintenance if we
  roll our own? The spike's recommendation must answer both
  head-on, with the Google output as the bar. PC-36 (worn-photo
  decomposition) shares this spike — same segmentation core.
  Research landed same day (studio inbox + PRODUCT.md record);
  **founder approved Option A 2026-10-21**: Photoroom behind
  one `extractGarment` callable, provider-swappable, original
  never destroyed. First step is the evidence step — a
  ~20-photo trial on the founder's real bed/carpet photos
  (quality + latency) — then the build pulls through planning.
  Trial ran 2026-10-22 (10 production calls; quality record in
  the studio research note). **Build pulled 2026-10-22** —
  founder's call: implement for sure if costs stay low (Basic
  is $20/mo covering 1,000 images, inside the floor at our
  scale). The sandbox rerun on the 13 raw laid-out photos is
  extra evidence, not a gate. Hard requirements from the
  founder: the original photo is retained untouched, and the
  PC-19 pHash — computed on the original at selection time and
  stored per photo — stays the dedup reference; extraction is
  a render layer only, never a data change. Build shape:
  `extractGarment` callable with the provider behind
  `functions/photoroom.js`; render at
  `users/{uid}/renders/<sha256(storagePath)>.png`; the photo
  entry gains renderUrl / renderStoragePath /
  renderUncertainty; tiles prefer the render and fall back to
  the original on any failure. Build landed dark 2026-10-22
  (commit ce5d130; client live, callable awaiting its secret).
  Provider choice reopened the same day: the founder is
  weighing Photoroom's $20/mo floor against BiRefNet via
  Replicate (pay-per-use, ~$0.001/image, no floor, cold
  starts, no uncertainty score, no trial evidence yet). His
  call after deliberation; the provider seam makes it a
  one-module swap, and nothing costs anything while dormant.
  BiRefNet comparison evidence landed 2026-10-22: the open
  model (run locally on CPU) over the same 14 raw photos plus
  the 20 trial originals — quality parity with Photoroom on
  the 10 head-to-head items (alpha stats within ~0.3pt,
  visually near-identical), and on the translucent-lens
  sunglasses (Photoroom's weakest, uncertainty 0.84–1.0) it
  kept the source's dark lenses where Photoroom washed them
  translucent. All 14 raw photos extracted cleanly off
  bed/carpet; only blemishes were slivers of adjacent dark
  objects on the two most cluttered shots. Full record in
  the studio research note and `photoroom-trial/results.md`.
  Bramble's recommendation now: the no-floor route (BiRefNet
  via Replicate behind the same provider module), giving up
  the uncertainty score. Founder's call still open; if
  BiRefNet is chosen, the pending sandbox-key paste is moot
  and a Replicate token via the same secure-paste pattern
  takes its place.
  **Founder chose BiRefNet via Replicate 2026-10-23**, and
  approved the full package in the same pass: orientation
  baked into the pixels server-side before the provider call
  (with an aspect assertion in the gate, so a rotated render
  can never pass silently); a two-layer quality gate — mask
  heuristics, then a Gemini vision check on the cutout
  composited over magenta — where the client only ever
  points a photo at a passed render and a rejection leaves
  the original showing; extraction scoped to each item's
  first photo (the only photo any surface displays); both
  AI calls emitting ai_usage events (OBS-3a). Built
  2026-10-23: `functions/birefnet.js` replaces
  `functions/photoroom.js` behind the seam, the
  `REPLICATE_API_TOKEN` secret exists with its accessor
  grant (no version yet — the token value is the founder's
  laptop step), the client side is deployed, and the suite
  is green at 256. Remaining before this can run live: the
  founder adds the token version, Bramble deploys
  `extractGarment`, one smoke call verifies the model id /
  input name / hardware rate against the real API, and the
  founder's phone validation is the final gate.

### PC-36: Photo of a person → individual articles + the outfit
- **Size:** Spike shared with PC-34, then size from findings
- **Value:** Founder (2026-10-21): the endgame of the
  Google-Photos-clean-view direction. Photograph yourself
  wearing an outfit — or reuse photos you already have — and
  the app identifies each worn garment, creates the
  individual articles (clean renders, per PC-34), and
  creates the outfit object matching what's being worn.
  Cataloguing cost per piece drops to ~zero and the outfit
  arrives free with the pieces: onboarding's front-loaded
  cost (UX-14's core problem) collapses. It also compounds —
  every outfit photo a user already owns becomes wardrobe +
  outfits in one step. Today's parseOutfitPhoto only MATCHES
  a photo against pieces already catalogued; this CREATES
  the pieces.
- **Scope:** Research first, as one spike with PC-34 (same
  segmentation core), answering the founder's two charter
  questions for this capability too: (Q1) feasibility —
  readymade fashion-parsing / human-parsing solutions vs
  from scratch, judged honestly against the Google
  benchmark; (Q2) cost — per photo at our scale, plus
  build/maintenance if scratch. Any build follows the
  spike's recommendation only. Shape of the eventual build:
  one worn photo → draft articles (clean render + AI tags)
  the user confirms or edits — nothing lands silently — plus
  one outfit composed of exactly those articles.
- **Status:** Not started. Filed 2026-10-21 from the
  founder's message; research pairs with PC-34. Research
  landed same day; **founder approved Option A 2026-10-21**:
  prototype on the PC-34 matting core, judged on the
  founder's real outfit photos before any build is sized.

- **Alta benchmark (teardown P3, 2026-10-24):** Alta's
  Prettify does this today (selfie → isolated pieces, per
  their own post and an independent stylist's hands-on). It
  is the acceptance bar for any PC-36 prototype: match its
  one-photo-to-pieces-and-outfit shape before calling the
  shape proven. Not a new card — the teardown point lives
  here. Still gated on PC-34's token.

### PC-37: Trip chat is a full stylist room — outfit suggestions you can add
- **Size:** M
- **Value:** Founder, from an experimenting session
  (2026-10-21): "I treat this trip page as its own
  dedicated chat and you should be able to do whatever you
  want." Today the trip chat only rewrites the packing
  plan, and the plan's ~2 suggested outfits are a closed
  set — ask for more and nothing happens; like one and
  there's no way to keep it. His model: suggest an outfit
  in the trip chat → it gets added to the trip AND to the
  overall list of outfits, tagged with the trip. A default
  plan with a couple of outfits is fine; the incomplete
  experience is having no way to ask for more or to keep
  the ones you like.
- **Scope:** (1) Trip mode gains outfit proposals on
  demand — "suggest more outfits" returns additional,
  distinct outfit suggestions (from the packed pieces; the
  whole-wardrobe scope from the 2026-10-21 fix applies),
  not a silent plan rewrite. (2) Suggestions render in
  chat as outfit cards with a Save/Add action, in the same
  card language as the trip page and normal chat.
  (3) Saving creates the outfit — dedup by hash, like
  saveChatOutfit — tagged with the trip (the outfit model
  already carries a tripId field), so it appears on the
  trip page and in the Outfits list with its trip tag.
  (4) The trip page's outfit section reflects saved trip
  outfits alongside the plan's suggestions.
- **Acceptance:** in the Vancouver chat: "suggest three
  more outfits from what I'm packing" → three outfit
  cards; saving one puts it on the trip page and in
  Outfits tagged Vancouver; asking again produces new
  suggestions, not repeats.
- **Status:** Built 2026-10-21 (the founder pulled it the
  same day it was filed): a dedicated suggestTripOutfits
  tool (suggestions never rewrite the plan), saveable
  outfit cards in trip chat, saves tagged with the trip,
  a "Saved for this trip" section on the trip page, and a
  trip tag in the Outfits list. Founder phone validation
  pending — the card flips when he confirms on device.
  Known v1 limits: an outfit carries one tripId (the same
  combination kept for a second trip links to the first
  save instead of re-tagging), and suggestion memory is
  per-session (chat history is not persisted), so a fresh
  session can re-suggest an older combination — save-time
  dedup still prevents a duplicate outfit. The two bugs
  from the same session — Today's Pick inside the trip
  chat, and a raw-JSON reply — went out as a fix buffer
  earlier that day.

### PC-35: Beginner guide — ways to add clothes (incl. Google Photos)
- **Size:** S
- **Value:** Founder discovery (2026-10-21, verified by doing
  it): Google Photos' wardrobe collection — auto-extracted
  garments on clean grounds, Items/Outfits — saves its images
  to the camera roll, and those upload straight into Closet.
  For a beginner this skips the worst onboarding step entirely
  (photographing clothes on a bed) and the pieces arrive as
  clean cutouts — the look the redesign wants (PC-34).
  Onboarding's core problem is cost front-loaded, value
  back-loaded (UX-14); a guide teaching the cheap paths is
  the cheapest attack on it.
- **Scope:** A short in-app guide, "Ways to add your clothes,"
  reachable in one tap from the wardrobe/Today empty states
  and from the Add flow. Three paths, a few lines each plus
  the action: (1) photograph a piece — the standard flow;
  (2) many at once — bulk add, one photo per piece; (3) bring
  them from Google Photos — open the wardrobe collection,
  save pieces to the camera roll, add them here like any
  photo. Copy stays honest: Closet doesn't connect to Google
  Photos directly; it's a download-then-add path. Founder's
  2026-10-21 screenshots (Items grid, "saved to the Camera
  Roll," sample cutouts on white) are the reference for how
  path (3) actually looks.
- **Acceptance:** a new user with an empty wardrobe reaches
  the guide in one tap, reads it in under a minute, and can
  follow the Google Photos path without guessing a step.
- **Status:** In Sprint 19 (card 3). BUILT 2026-10-24 — guide live from
  the zero card, wardrobe empty state, and capture screen;
  verified in a live guest session.

### NAMING-1: Short-name standard at the data level
- **Problem (founder, 2026-10-23):** outfit titles and shop-item
  titles render as full AI prose sentences ("White bear graphic
  crew-neck tee + The North…", "An off-white running hat with a
  dark green brim…") — wordy, truncated, ugly on cards. Teardown
  evidence (Essembl APK pilot, 2026-10-23): reference apps never
  title cards with prose; descriptions live in detail views.
- **Interim fix shipped 2026-10-23 (fix buffer):** display-layer
  formatters — outfit cards use the stylist look name, else hero
  piece + "+ N more"; shop cards cut the note to a short noun
  phrase. Stored data is still prose.
- **Scope:** give items, outfits, and shop checks a real
  `shortName` at creation time: describeItem and shopCheck return
  a ≤5-word label alongside the description; stylist outfits keep
  lookName as the short name; composer/photo outfits generate one
  at save. One-time backfill for existing docs. Cards/detail
  headers read shortName; full prose stays in detail bodies.
- **Acceptance:** no card in Wardrobe, Outfits, Shop list, or
  Today renders a title longer than ~6 words or ending mid-word;
  detail views keep the full descriptions.
- **Status:** In Sprint 19 (card 4). BUILT 2026-10-24 — shared cap rule
  server + client, minted at every creation path, backfill
  applied (72 docs). Founder phone spot-check pending.

### PC-38: Stylist chat — attach reference photos (M)
- **Origin:** Essembl teardown P3, adopted by the founder
  2026-10-24. Evidence: `research_notes/essembl-apk-pilot.md`
  (their stylist chat takes up to 4 attachable references).
- **Problem:** the stylist can only reason over pieces already
  in the wardrobe. There is no way to show it what you're
  aiming for — an inspo photo, a screenshot of a look, a
  friend's outfit — and ask "more like this, with what I own."
- **In scope:** attach up to 4 reference images to a message
  in the general stylist chat (photo picker + camera, same
  single-door pattern as Add); thumbnails in the composer,
  removable before send; references ride to `askStylist` as
  vision context for that turn; the reply may name elements
  it sees in the references.
- **Out of scope:** references never create wardrobe items
  (that is PC-36's worn-photo path); no reference persistence
  beyond the conversation; trip-chat parity (general chat
  first; trip rooms get it only if the pattern proves out);
  no outfit generation bypass — suggestions are outfit cards
  built only from owned pieces, as today.
- **Acceptance:** in general chat, attach 2 inspo photos and
  ask "more like this with what I own" → the reply visibly
  reasons over the references (names elements from them) and
  suggests outfits built only from owned pieces; removing a
  thumbnail before send excludes it; no items are created.
- **Lane:** Stylist. **Effort:** M.
- **Status:** Filed sprint-ready 2026-10-24 (teardown P3
  adoption). Competes at the next planning walk — adoption
  is not scheduling.

### PC-39: Trip weather re-check — the pill is the retry (S)
- **Origin:** Founder, 2026-10-24. The trip page shows a frozen
  `packing.weatherSnapshot` from plan time; if the forecast
  wasn't available then (trip beyond Open-Meteo's 16-day
  window) or has since changed, nothing ever refreshes it.
- **Design (founder-approved 2026-10-24, "Option 1"):** no new
  button. The weather pill under the trip dates becomes the
  retry: tappable, shows "Checking weather…" during a fetch,
  then the fresh forecast or "Forecast not available yet —
  tap to check again". Plus a silent assist: opening a trip
  whose forecast is missing or >3h old re-checks in the
  background. A successful refresh updates the stored
  snapshot (and therefore the packing summary's weather line).
- **In scope:** tappable pill states (snapshot / checking /
  unavailable), staleness guard so watcher re-renders never
  spam the API (per-trip checked-at, 3h for hits, 30min for
  misses), geocode fallback via `geocodeDestination` when the
  leg has no coords, snapshot write-back (`packing.
  weatherSnapshot` when a plan exists; a trip-level field
  when it doesn't).
- **Out of scope:** silently rebuilding the packing plan on a
  weather change (re-planning stays the explicit Plan button /
  trip chat); hourly forecasts; multi-leg weather.
- **Acceptance:** open a trip planned >16 days out once its
  dates enter the window → the pill fills in without any
  re-plan; tap the pill on a planned trip → it re-fetches and
  the shown forecast updates; with no forecast available the
  pill says so and stays tappable.
- **Lane:** Loop. **Effort:** S.
- **Status:** IN SPRINT 20 (pulled at the 2026-10-24 walk,
  ranked #3). Filed sprint-ready 2026-10-24 with the design
  already chosen.

### PC-40: Contextual shop checks — trip-aware by default, plus your own question (M)
- **Origin:** Founder, 2026-10-24: "The shop check should not
  be generic. It should be specific to the context of that
  trip by default, and people should be able to ask specific
  questions."
- **Problem:** `shopCheck` judges a photo against the
  wardrobe only. A check started for a trip knows nothing
  about the trip, and the user has no way to steer the
  judgment ("warm enough for evenings there?", "too formal
  for a beach wedding?").
- **In scope:** (1) When a check is trip-tagged, the server
  reads the trip doc itself (never client-supplied context)
  and the prompt judges FOR the trip first: destination,
  dates, stored forecast, trip notes, what's already packed.
  (2) An optional one-line question field on the check sheet
  ("Anything specific?"), available for generic checks too,
  folded into the prompt with an instruction to answer it
  directly; the sheet shows a "Checking for the {trip} trip"
  line when a trip context is armed. (3) The question is
  saved on the check doc and shown in its detail view.
- **Out of scope:** follow-up conversation on a check (that
  is PC-41); outfit suggestions re-ranked by trip (the
  verdict and reasons carry the trip judgment); price talk
  (existing ban stands).
- **Acceptance:** start a check from a trip page, ask "warm
  enough for evenings there?" → the verdict/reasons visibly
  judge against the trip's weather and destination AND
  answer the question; the saved check shows the question in
  its detail; a generic check with a question also answers
  it; a check with neither behaves exactly as today.
- **Lane:** Stylist. **Effort:** M.
- **Status:** IN SPRINT 20 (pulled at the 2026-10-24 walk,
  ranked #4). Filed sprint-ready 2026-10-24 (founder
  direction).

### PC-41: Follow-up chat on a shop check (M)
- **Origin:** Founder, 2026-10-24: "people should be able to
  ask specific questions as follow up — basically a chat
  that helps them make the decision."
- **Problem:** a check is one-shot. The follow-up questions
  that actually decide a purchase ("what would I wear it
  with in November?", "is the color too close to my navy
  blazer?") have nowhere to go.
- **In scope:** a compact chat thread inside the saved
  check's detail view; a new callable answers with the full
  context of THAT check (photo, analysis, wardrobe, and the
  trip context when tagged — rides PC-40's plumbing);
  thread persists on the check doc (capped history); answers
  may reference owned pieces by name but never invent items.
- **Out of scope:** chat on unsaved checks; the general
  stylist chat absorbing checks (contexts stay separate,
  per the context-mixing rule); voice input.
- **Acceptance:** on a saved check, ask two follow-ups →
  both answers reason over the check's photo/analysis and
  the real wardrobe; reopening the check shows the thread;
  a trip-tagged check's answers use the trip context.
- **Lane:** Stylist. **Effort:** M. **Depends on:** PC-40.
- **Status:** HELD for UX-18 (founder's call, 2026-10-24).
  The stylist chat gets one bottom-up redesign, designed
  completely rather than in stages — a chat feature built on
  the current architecture is rework by definition. PC-41
  lands as a designed entry point of the new chat. Its
  dependency (PC-40, contextual checks) stands shipped.

### PC-42: Crop the shop-check photo to the garment (M)
- **Origin:** Founder, 2026-10-24: in a store photo there
  are other clothes around — "users just want to make sure
  the right cloth is getting scanned."
- **Problem:** the check analyzes the whole frame; a rack
  photo can describe (and judge) the wrong garment.
- **In scope:** after picking a photo, a crop step inside
  the check flow before upload/analysis: fixed frame, drag
  to pan, zoom slider (+ wheel on desktop); "Use this crop"
  renders the region via canvas (long edge capped at
  1600px, JPEG) and that image is what uploads; "Use full
  photo" escape hatch; the cropped photo is also what gets
  saved on the check (it is the subject of record).
- **Out of scope:** wardrobe-add cropping (v2 if the pattern
  proves out — the component should be reusable); free-form
  corner dragging / rotation; multi-subject selection.
- **Acceptance:** check a rack photo, crop to one jacket →
  the analysis describes and judges the jacket only; "Use
  full photo" reproduces today's behavior exactly; the
  saved check's photo is the cropped one.
- **Lane:** Stylist. **Effort:** M.
- **Status:** DONE 2026-10-24 (Sprint 21).

### UX-16: Context-handoff audit — a chat opened from a surface carries that surface's subject (S)
- **Origin:** Founder bug, 2026-10-24: asking the stylist
  about Today's pick went in context-free (the pick was
  DISPLAYED in the chat but never SENT), with the standing
  note: "these kinds of things in general should not happen."
  The instance is fixed (the pick now rides the payload and
  is the iteration base). This card audits the CLASS.
- **Inventory to verify (each entry point: does the subject
  ride the payload?):** Today strip → stylist (FIXED
  2026-10-24, `todayPick`); trip chat → trip context (by
  design, TRIPCHAT-1 ✓); @-references (PC-22 ✓); piece /
  outfit card "ask" affordances if any exist; shop check →
  PC-41 (must carry the check by construction — acceptance
  there covers it); Today "Ask the stylist" button vs the
  chat opened from Wardrobe (no subject — correct for the
  generic room).
- **Acceptance:** every row of the inventory is either
  verified-carrying (with the payload field named), verified
  intentionally context-free, or filed as its own fix;
  results recorded on this card.
- **Lane:** Stylist. **Effort:** S.
- **Status:** Filed 2026-10-24. Competes at the next
  planning walk; the Today instance is already fixed.

### PC-43 — Unnamed items heal themselves (no permanent "Untitled item")

- **Problem (founder-found, 2026-10-24):** when the AI
  describe step fails during an add (bulk especially), the
  item saves with the literal placeholder name "Untitled
  item", no ai block, category Other — and nothing ever
  retries. 8 of the founder's 69 items were zombies of this
  kind, surfacing in pickers, picks and lists. The 8 were
  repaired by hand (re-describe from photo); this card makes
  it structural so it never needs a hand.
- **In scope:** at save time, an item whose describe failed
  is flagged (e.g. `needsAi: true`); on app load, flagged
  items are quietly re-described (existing describeItem
  callable, capped per session, only on the owner's own
  items) and the flag clears on success; the wardrobe grid
  shows flagged items with a subtle "naming…" state rather
  than the placeholder. Manual rename already exists as the
  escape hatch.
- **Out of scope:** re-describing healthy items; bulk
  re-cataloguing.
- **Acceptance:** kill the network mid-bulk-add → items
  land flagged, none displays "Untitled item" as its name
  after the next successful load; ai_usage shows the retry
  calls; a permanently unidentifiable photo ends as
  "Unidentified item" per the describe prompt's own rule,
  with the flag cleared.
- **Lane:** Catalogue. **Effort:** S–M.
- **Status:** SHIPPED 2026-10-24 (Sprint 20). Prevention
  live: needsAi flags at both save paths, capped on-load
  healer, "Naming…" grid state.

### UX-17 — Manual theme choice in Account (System / Light / Dark)

- **Origin:** founder curiosity, 2026-10-24 — explicitly NOT
  a priority ("the way we are right now looks pretty good").
- **Now:** theme follows the phone's system setting only
  (light base tokens, dark via prefers-color-scheme). No
  in-app control, no stored preference.
- **In scope (when pulled):** a three-way choice in Account
  (System / Light / Dark), stored per device, applied via a
  data-theme attribute that overrides the media query both
  ways; default stays System.
- **Why it might matter:** app-light on a dark phone for
  bright-sunlight readability; comparing the two looks
  without flipping the whole phone.
- **Revisit trigger:** first user request for it, or the
  next time Account is opened up for other work.
- **Lane:** Loop (settings/shell). **Effort:** S.
- **Status:** DONE 2026-10-24 (Sprint 21).

### UX-18: Stylist audit: one experience + architecture pass, founder session

- **Origin:** founder, 2026-10-24 — "the AI stylist feature
  has a lot of inconsistencies and we need to sit together
  and sort it out experience-wise and also architecture-wise
  at some point." NOT a patch queue: a sit-together design
  session. Patching entry-point semantics piecemeal is the
  process that produced the inconsistencies.
- **Exhibit #1 (headline):** today's pick attaches as chat
  context by default on EVERY general chat open — including
  a cold open from the Stylist tab, where the founder did
  not choose it ("not expected"). Entry-aware seeding was
  never designed; the context fix seeded unconditionally.
  The pin makes it visible and removable, but the DEFAULT
  is the open question.
- **Experience agenda:** every chat entry point and what
  context it attaches by default (Today ask, Stylist tab,
  trip page, outfit/item cards, @-refs); what "a fresh chat"
  means; pin visibility rules (UX-16 folds in here as the
  audit workstream); the strip vs pin duplication; thread
  restore semantics.
- **Architecture agenda:** the context assembly has grown
  five mechanisms (todayPick, previousPick, @-references,
  context pins, tripContext) with no single model of
  precedence or lifetime. Session outcome: one context
  model — what exists, who wins, when it expires — written
  into a living design doc (per the complex-systems rule)
  before any code moves.
- **Session shape:** Bramble brings the full inventory
  (entry points × attached context × disagreements) so the
  session is decisions, not discovery.
- **Lane:** Stylist. **Effort:** session + follow-on cuts TBD.
- **Status:** SPRINT 23 FOCUS (founder, 2026-10-24: "the
  key remaining big change that makes the app seamless").
  Bramble brings the audit inventory to the sit-down;
  the session's output is docs/CONTEXT-MODEL.md, then
  build waves follow from it. Held behind it: PC-38,
  PC-41, PC-45, PC-32, PC-33. UX-16 folds in.

### OBS-4: Data-model drift spot-check (S)

- **Origin:** the important-invisibles register (2026-10-24):
  the catalog data model (`docs/DATA_MODEL.md`, v2) has a
  design doc but no proof surface — nothing checks the live
  documents against it, so drift is discovered by accident
  (the Untitled-item incident was drift of exactly this kind).
- **In scope:** a drift section in `scripts/quality-report.js`
  — sample the founder's items, trips, and shop checks;
  verify the required v2 fields per DATA_MODEL.md and the
  NAMING-1 standard (shortName present, within budget, not the
  placeholder); report drift counts by kind with example ids.
  Read-only; no auto-repair.
- **Out of scope:** repair/migration (drift findings become
  their own cuts), other users' data.
- **Acceptance:** the report prints a drift section with sane
  numbers on live data; a deliberately corrupted test doc is
  flagged.
- **Lane:** platform/observability. **Effort:** S.
- **Status:** DONE 2026-10-24 (Sprint 21).

### PC-44: Non-photo catalogue intake — link & lookup first (L)

- **Origin:** Alta teardown P3, saved by the founder
  2026-10-24. Alta offers receipt forwarding, a product
  database, pasted links, and photo→original-image lookup;
  reviewers confirm they work.
- **Problem:** our intake is photo-only, and cataloguing
  cost is the product's core hurdle (UX-14). A piece you
  just bought online already has a perfect product photo —
  making the user re-photograph it is pure friction.
- **In scope (first slice):** paste a product link (or pick
  from a small lookup) at add-time → the app fetches the
  retail image + name/details as the draft; the source is
  labeled on the item ("retail photo — not yours") and the
  user can replace it with their own photo anytime.
- **Out of scope:** receipt forwarding (a later slice),
  scraping retailers that block it, price/affiliate data,
  silently substituting a found image for the user's photo
  (PC-34 doctrine: originals always retained, labeled).
- **Acceptance:** paste a link for a real product → a draft
  piece appears with the retail photo + suggested fields,
  source-labeled; saving works; swapping in your own photo
  later keeps everything else.
- **Lane:** Catalogue. **Effort:** L.
- **Status:** DONE 2026-10-24 (Sprint 22) — then the link
  slice was REMOVED + PARKED the same day (founder call):
  plain fetching only works for Open-Graph-friendly
  stores (Uniqlo yes; Amazon/Patagonia/REI no), and
  offering users a door that fails most of the time is
  worse than not offering it. UI removed from Add pieces;
  the `fetchLinkItem` function stays deployed but
  unreferenced, and the retail-label plumbing stays for
  pieces saved during its life. **Revisit trigger:** a
  fetch approach measured at 90%+ success across a fixed
  representative store panel (incl. Amazon) — e.g.
  headless-browser rendering or a product-data API.
  Screenshot / copy + paste (PC-51) is the sanctioned
  path meanwhile.

### PC-45: Explain-the-no → a proposed, confirmable style rule (M)

- **Origin:** Alta teardown P3, saved by the founder
  2026-10-24 (evidence second-hand: a hands-on review
  describes thumbs-down + reason → style rules at Alta).
- **Problem:** our learning hears only post-wear ratings
  and reflection. The earlier signal — "not this, because…"
  at suggestion time — evaporates.
- **In scope:** when the user rejects a pick with a reason,
  the app may PROPOSE a style rule ("skip wide-leg trousers")
  as a visible, confirmable pin — never learned silently
  (context-pin discipline); confirmed rules feed the
  stylist prompt and show in the profile.
- **Out of scope:** free-text rule editing v1, learning
  from unconfirmed rejections.
- **Acceptance:** reject a pick with a reason → a rule is
  proposed, not applied; confirming it changes later picks;
  dismissing it leaves no trace.
- **Lane:** Personalization + Stylist. **Effort:** M.
- **Status:** HELD for UX-18 (founder-saved 2026-10-24, but
  it extends the chat's learning loop — queues behind the
  bottom-up redesign like PC-38/PC-41).

### PC-46: Candidate-piece outfit previews inside shop check (M)

- **Origin:** Alta teardown P3, saved by the founder
  2026-10-24. Alta generates outfits including a not-yet-
  owned wishlist piece.
- **Problem:** PC-40's check judges a candidate in prose
  only — "would work with your navy trousers" is a claim
  the user cannot see.
- **In scope:** the check result shows 1–2 concrete outfit
  previews built around the candidate + owned pieces
  (existing pick machinery, candidate slotted in), so the
  verdict is visible, not just asserted.
- **Out of scope:** retail feeds, links, prices (VISION's
  no-commerce rule); candidates the user didn't supply.
- **Acceptance:** check a candidate → the result includes
  outfit previews naming real owned pieces; previews use
  the same composer as Today picks.
- **Lane:** Stylist. **Effort:** M.
- **Status:** DONE 2026-10-24 (Sprint 22).

### PC-47: Forgotten-pieces utilization surface (S/M)

- **Origin:** Alta teardown P3, saved by the founder
  2026-10-24. Alta sorts by most/least worn with a wear
  calendar; its founding premise is people wear a small
  fraction of their closet.
- **Problem:** we store every wear event and expose no
  aggregate view — the Loop lane has data with no surface.
- **In scope:** a wardrobe view sorted by wear (most /
  least / never), each neglected piece ending in an action
  ("build a look around this") that routes to the stylist
  with that piece pinned. Feeds the open exploration-vs-
  exploitation question in PERSONALIZATION.md.
- **Out of scope:** cost-per-wear (no price field exists),
  guilt mechanics, streaks.
- **Acceptance:** open the view → pieces order by real
  wear counts; a never-worn piece can start a look in one
  tap.
- **Lane:** Loop + Personalization. **Effort:** S/M.
- **Status:** DONE 2026-10-24 (Sprint 22).

### PC-48: Activity + luggage-aware trip planning (M/L)

- **Origin:** Alta teardown P3, saved by the founder
  2026-10-24 (Alta's own trip posts: per-activity planning
  across cities/climates, luggage size as an input, every
  packed item tied to a planned outfit).
- **Problem:** our trips are single-destination-first;
  activities live in free-text notes the planner cannot
  use; nothing respects a luggage constraint.
- **In scope:** activities as structured trip input (a
  short list per leg: e.g. hiking, dinner, work) shaping
  the packing plan; a luggage choice (carry-on / checked)
  capping the plan's volume; packed items stay tied to
  the outfits they serve.
- **Out of scope:** shareable lookbook links (a separate
  privacy decision), multi-city routing beyond legs as
  they exist today.
- **Acceptance:** a trip with activities + carry-on gets
  a visibly smaller, activity-shaped plan vs the same
  trip without them.
- **Lane:** Outfits (trips). **Effort:** M/L.
- **Status:** FIRST ALTERNATE (2026-10-24 walk). Ranked #1
  in the first proposed slate on a Hong Kong deadline that
  turned out not to exist (the in-app trips are test trips —
  founder correction, 2026-10-24). Pull trigger: a real
  trip lands on the calendar (the pre-Canada sprint, if the
  visa lands, is its natural home).

### PC-49: Personal avatar outfit preview (L)

- **Origin:** Alta teardown P3, saved by the founder
  2026-10-24. Alta's breakout surface (outfits rendered
  on a personal avatar). Ranked last by the teardown on
  purpose.
- **Problem it would solve:** seeing a pick "on you"
  before wearing it. Against it: reviewers in both
  directions call Alta's an impression, not fit; body-
  photo sensitivity; worst fit-to-effort ratio today.
- **In scope (when the trigger fires):** a design spike
  only — what an honest, labeled "impression, not fit"
  preview would take with our extraction stack.
- **Out of scope:** any build before the spike; marketing
  it as fit evidence, ever.
- **Acceptance:** the spike returns a go/no-go with the
  honesty labeling designed in.
- **Lane:** Stylist + Outfits. **Effort:** L.
- **Status:** Parked with a trigger (founder-saved
  2026-10-24): revisit after PC-34 is live AND the PC-36
  prototype has a verdict.

### PC-50: Link intake for shop check (S)

- **Origin:** Founder, 2026-10-24, minutes after PC-44
  shipped: link intake "should work for the shop check
  feature as well — that's perhaps more relevant, with a
  fallback to good old screenshot (what we already have)."
- **Problem:** checking something you're eyeing online
  starts from its product page, but the check demands a
  photo — so the user screenshots or saves the image first,
  pure friction at the exact decision moment. PC-44 proved
  the fetch machinery; the check is its most natural home.
- **In scope:** the shop-check sheet gains a link field +
  Fetch (same pattern as the capture screen): fetchLinkItem
  pulls the retail photo to Storage, and the check runs on
  it directly — no upload step, no crop step (a clean
  product shot needs neither). PC-40's context (trip tag +
  question) composes unchanged. Photo/screenshot stays as
  the fallback route, untouched, for in-store and for
  stores that block fetching (the catalog's friendly error
  already covers it). Retry on a link check re-runs the
  analysis on the same stored photo.
- **Out of scope:** bulk link checks, price extraction,
  retailer-specific parsers.
- **Acceptance:** paste a Uniqlo product link in the check
  sheet → verdict renders with the retail photo, saves to
  the shop list like any check; a blocked store shows the
  friendly message and the photo route still works.
- **Lane:** Stylist (shop). **Effort:** S.
- **Status:** SHIPPED 2026-10-24 (founder pulled it the
  same day it was filed), then REMOVED + PARKED the same
  day on the founder's reliability call — see PC-44's
  status for the reasoning and the 90%+ revisit trigger.
  The shared snapshot helper it introduced stays (the
  photo flow uses it).

### PC-51: Paste a photo from the clipboard (S)

- **Origin:** Founder, 2026-10-24: copied a product image
  from a website on his laptop and instinctively hit paste
  in the app — "there is no way to paste. that's a huge
  miss lol." Every intake route today demands a saved file
  or the camera; the clipboard — the natural desktop
  gesture when browsing products — is unsupported. It is
  also the escape hatch for stores whose pages expose no
  fetchable photo (Amazon serves fetchers a script shell
  with no image tags at all; verified 2026-10-24 on the
  founder's own a.co link → LINK_NO_IMAGE).
- **In scope:** a document-level paste handler that
  snapshots image files off the clipboard event (the
  FileList lesson: copy them out immediately) and routes
  by what's open — shop-check sheet open → shop check via
  the PC-42 cropper (first image); Add pieces open → the
  ordinary capture ingest (all images); nothing relevant
  open → a small chooser (Add to wardrobe / Shop check).
  Text pastes are never hijacked: if the clipboard carries
  text, text fields keep it (pasting a link into the link
  field must work exactly as today); the handler only
  claims an image-only paste, or an image paste whose
  target isn't a text field.
- **Out of scope:** an explicit "Paste" button via the
  async Clipboard API (permission prompts; revisit if the
  keyboard route proves undiscoverable), drag-and-drop
  (file if wanted separately), paste on the piece page.
- **Acceptance:** on desktop — copy a product image in the
  browser → open a shop check → Cmd/Ctrl+V → the cropper
  opens with that image; open Add pieces → paste → the
  capture flow takes it; paste with nothing open → the
  chooser appears; pasting a link into either link field
  still pastes text, untouched.
- **Lane:** Catalogue + Stylist (intake). **Effort:** S.
- **Status:** SHIPPED 2026-10-24 — pulled by the founder
  as the replacement path the same day link intake was
  parked ("advise users to take screenshots / copy images
  and paste them"). Awaiting founder phone/desktop
  validation.

### PC-52: The stylist may propose an attachment (S)

- **Origin:** Founder, 2026-10-24, on the UX-18 build: "can
  we educate user on attaching during conversation, or in
  some cases attaching things on our [behalf] based on chat
  context?" Decision 1 stands — nothing attaches silently,
  ever. But the app may notice the conversation has turned
  on something unattached and PROPOSE attaching it, exactly
  the way pinned facts are proposed today (model proposes,
  user taps, nothing happens without the tap). Education
  shipped alongside the question: the context sheet now
  also attaches (an Attach row for today's pick + the @
  tip), and the empty state teaches both routes.
- **In scope:** an `attachProposal` answer field alongside
  `pinProposal` in the general conversation — the model
  proposes attaching today's pick when the user's words
  clearly turn on it ("make it warmer", "why did you pick
  this?") and no pick is attached and the conversation has
  no pick of its own. The client renders a proposal card
  (Attach / Dismiss) mirroring the pin-proposal card;
  Attach runs attachTodayPick(). The assembler states the
  rule in the brief (propose only on a clear referent, at
  most one per conversation unless the subject changes).
- **Out of scope:** proposing pointers to pieces (the @
  gesture is the user's; a future card may generalize),
  any silent or timed auto-attach (barred by decision 1),
  trip conversations.
- **Acceptance:** in a fresh general conversation with a
  pick on Today, "make this warmer" earns an Attach
  proposal card; tapping Attach puts the pick in the
  context line and the next message iterates from it;
  Dismiss leaves the conversation pick-free and the model
  does not re-propose on the next turn.
- **Lane:** Stylist. **Effort:** S.
- **Status:** Filed 2026-10-24. Enters work only via a
  planning walk (no ad hoc build).

### PC-53: New-user empty states on every tab (S)

- **Origin:** Founder, 2026-10-24, phone-testing as a new
  user: the Start-here prompt belongs on every screen for
  users with zero things (the tabs are otherwise empty real
  estate), and users with few things get a designed "add
  more" treatment (that tier delegated to Bramble). Full
  design: `docs/proposals/NEW-USER-EMPTY-STATES.md`.
- **In scope:** tier 0 (0 pieces) intro cards on Outfits,
  Shop, Trips + the stylist empty state's extra line (Today
  and Wardrobe already comply); tier 1 (below the existing
  `todayThresholdMet()` bar: ≥4 pieces incl. top + bottom)
  slim gap-naming banner on Wardrobe and Outfits (Today's
  progress card is the same component); the shop list's
  stale "tap Save" empty line replaced (checks auto-save).
- **Out of scope:** banners on Shop/Trips at tier 1, any
  stored dismissal state (graduation is count-derived),
  a first-run wizard.
- **Acceptance:** fresh account sees an intro treatment on
  all five tabs; 2 tops-only pieces → the missing bottom is
  named on Today/Wardrobe/Outfits; threshold crossed → no
  intro UI anywhere.
- **Lane:** Catalogue (onboarding surface). **Effort:** S.
- **Status:** Filed 2026-10-24 with the design; founder
  reviewed it the same day and parked it — it enters work
  only via the next planning walk.
