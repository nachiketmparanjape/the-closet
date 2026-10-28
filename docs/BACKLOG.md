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
- **Status:** Killed as a separate card at the Sprint 24
  planning walk (2026-10-24) — the tutorial question folds
  into UX-14, which subsumes it. This card remains as the
  record of the idea and its trigger.
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

### AUTH-1: Privacy-friendlier sign-in
Anonymous-first auth with Google/email-link upgrade, one account per
email, guest banner + privacy note. Design:
`docs/sprints/sprint-13/AUTH-1-DESIGN.md`.
- **Status:** DONE 2026-10-18 (Sprint 13) — built and founder
  phone-validated the same day (his testing caught the guest
  Google-link conflict, fixed in the same pass: linking signs
  into the real account and offers guest-wardrobe migration).

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
- **Status:** DONE 2026-10-24 — absorbed into UX-18
  wave 4 (saved threads per context, shipped as part of
  UX-18). This card's ask is the shipped behavior.

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
- **Status:** DONE 2026-10-24 (Sprint 24). Correction
  to the walk's record, found while building: the
  discipline half had NOT fully landed in UX-18 — the
  present-tense principle was adopted in the context
  model, but the prompt rule itself was never written
  into the brief (the pin section still said "where
  they'll be"). Both halves shipped here: the TENSE RULE
  in the pin-proposal brief (present-tense only for
  location/weather; preferences unaffected), the trip
  proposal (sanitized: destination + real future dates
  or nothing), parse-level suppression (a trip proposal
  drops a same-reply location/weather pin proposal), and
  the steering card — Create runs the trips flow's own
  steps, success offers the jump without yanking, "Just
  advise me here" dismisses for the conversation, and a
  matching existing trip suppresses the card. The card's
  education line is Bramble's wording, flagged for the
  founder's copy verdict. tests/pc33.test.js.

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
- **Status:** DONE 2026-10-23 (Sprint 18) — the design
  foundation batch and all five Warm Editorial waves
  are live. (Status updated at the Sprint 24 walk; it
  still read "In Sprint 18".)
- **Original status:** In Sprint 18 — design foundation batch (plan:
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

### PC-34: Garment extraction & clean rendering
- **Status:** Built, not yet live. Next step is the
  founder's: add the access token for the outside service
  (see "What remains"). Then deploy, one smoke test, and
  the founder's phone check is the ship gate.
- **In plain words:** When a user adds a photo of a
  garment — usually the garment lying on a bed or a
  carpet — the app cuts the garment out of the photo and
  shows that cutout on a clean background on every screen.
  The original photo is never changed and never deleted.
  The feature is built. It cannot run yet, because the
  outside service that does the cutting needs an access
  key (a "token") that only the founder can add.
- **Why it matters:** The background of a photo decides
  how the whole wardrobe looks. Beds and carpets make
  every screen look cluttered, however good the layout
  is. Clean cutouts are also the base for two later
  cards: PC-36 (a photo of a person wearing an outfit
  becomes the separate pieces plus the outfit) and PC-56
  (recognizing the same garment in a different photo).
- **Key terms:**
  - *Segmentation* — the step that decides which pixels
    in a photo belong to the garment and which belong to
    the background.
  - *Render* — the cutout image. The app stores the
    render next to the original photo and displays it
    when it passes the quality gate.
  - *Quality gate* — two automatic checks a render must
    pass before the app displays it. A render that fails
    is never displayed; the app keeps showing the
    original photo.
  - *Provider* — the outside service that runs the
    segmentation model. The provider today is Replicate
    (a service that runs models on its own computers and
    charges per run), running an open-source model named
    BiRefNet.
- **What was decided:**
  - The original photo is retained untouched, always.
    Extraction is a display layer, not a data change.
  - Duplicate detection keeps using the PC-19 perceptual
    hash (a fingerprint of what a photo looks like),
    computed on the original photo. Renders play no part
    in it.
  - Only each item's first photo gets a render in this
    version. The first photo is the only photo any
    screen displays.
  - Provider history: the first choice (2026-10-21) was
    Photoroom, a managed service with a $20-per-month
    minimum covering 1,000 images. The founder chose
    BiRefNet via Replicate on 2026-10-23: pay per use at
    about $0.001 per image and no monthly minimum. At
    our volume the minimum costs more than the usage,
    and the trial (below) showed equal quality.
- **What was built (2026-10-23):**
  - A callable function, `extractGarment`, so the
    provider can be swapped by changing one module
    (`functions/birefnet.js`) and nothing else.
  - The steps: read the original photo; fix its
    orientation in the pixels on the server (a phone
    photo can carry a rotation flag instead of rotated
    pixels, and a rotated render must never pass
    silently); call the provider; run the quality gate;
    store the render at `users/{uid}/renders/` under a
    name hashed from the original's path; record the
    render's location on the photo.
  - The quality gate, layer 1: measurements on the
    cutout's mask (which pixels the model kept), plus a
    shape check that catches a wrongly rotated result.
    Layer 2: a vision model sees the original and the
    cutout side by side (the cutout shown on a magenta
    background) and answers pass or fail, with reasons.
  - The client displays the render when one exists and
    has passed, and the original photo otherwise.
  - Both AI calls (the provider call and the gate's
    vision check) write usage records, like every AI
    call in the app.
- **Evidence:** Trial, 2026-10-22, on the founder's real
  photos. Photoroom ran on 10 photos. BiRefNet ran
  locally on the same photos and more: 14 raw photos,
  20 trial originals. On the items compared head to
  head, quality was equal. On the hardest item —
  sunglasses with translucent lenses — Photoroom washed
  the lenses out and BiRefNet kept them dark, as in the
  source. All 14 raw photos cut cleanly off beds and
  carpets; the only flaws were thin slivers of nearby
  dark objects on the two most cluttered photos. Full
  record: the studio research note on this spike and
  `photoroom-trial/results.md` in the studio files.
- **Costs (measured or quoted, as labelled):** BiRefNet
  through Replicate costs about $0.001 per image,
  quoted, pay per use, no monthly minimum. Photoroom's
  $20-per-month minimum is quoted from its pricing at
  decision time. Running the model on our own servers
  was not chosen; the earlier research record says to
  revisit it only past about 5,000 images per month.
- **Questions for a reader:**
  1. The provider call has never run live. The model
     name (`zhengpeng-7/birefnet`) and the name of its
     image input are unverified against the real
     Replicate service; the smoke test below checks
     them. Do hosted versions of this model differ from
     the local run in any way we should expect?
  2. Layer 2 of the gate spends one vision-model call
     per photo to judge the cutout. Is there a cheaper
     or more reliable signal for "this cutout is wrong"
     that we are missing?
  3. A pay-per-use hosted model can be slow on its
     first call after idle time (a "cold start"). At
     one photo at a time, is that a real problem for a
     consumer app, or a non-issue?
- **What remains, in order:**
  1. The founder adds a version to the secret named
     REPLICATE_API_TOKEN. The secret exists in the
     project; it holds no value yet. This step is
     parked with the founder, by his instruction.
  2. Deploy the `extractGarment` function.
  3. One smoke test: a single call against the real
     service, checking the model name, the input name,
     and the price of the run.
  4. The founder checks the result on his phone. That
     check is the ship gate.
- **History:**
  - 2026-10-21 — The founder sets the direction after
    seeing Google Photos' auto-built clothing collection
    and its clean cutouts. The card opens as a research
    spike with his two questions: is this possible for
    us, and what does it cost? He approves the readymade
    route the same day: one provider behind one
    swappable function, the original never destroyed.
  - 2026-10-22 — Research and the trial (see Evidence)
    run. The founder's call: build it, if costs stay
    low. The build lands the same day, dark: the client
    side live, the function waiting for its key.
  - 2026-10-23 — The founder chooses BiRefNet via
    Replicate over Photoroom. The full package is
    built: orientation handling, the two-layer quality
    gate, first-photo scope.
  - 2026-10-24 — A document check catches this card's
    status still reading "Not started," three sprints
    after the build. Status corrected.
  - 2026-10-25 — This card rewritten in the studio's
    shareable-card structure (standards/shareable-cards)
    as the first worked example.
  - 2026-10-25 — A render standard joins the pipeline
    (founder's SAM 3 flow for PC-36, adopted the same
    day): every item view — from a flat photo here, or a
    worn photo there — is normalized to one shape:
    fixed canvas, garment centered, standard margin and
    fill, the cutout transparent over the app's own
    ground. Normalization joins this pipeline when it
    goes live, and the quality gate judges the final,
    normalized render. Deploy note: items already in the
    wardrobe have no renders (extraction has never run),
    so standard views for them are a one-time backfill,
    sized at deploy time.
  - 2026-10-25 — The standard's canvas is set from
    measurement: 4:5, the frame the app's item tiles
    already use; all 69 current photos measured (80%
    already square, median ~0.5 megapixels). The cutout
    is centered, its longest side filling a fixed share
    of the frame, set in the PC-36 prototype.
  - 2026-10-27 — The founder added the Replicate token
    (secret version 1, enabled), and extractGarment is
    deployed: state active, token binding confirmed,
    unauthenticated calls answered 401 (the healthy
    sign). The first live check caught a real defect:
    the pinned model id zhengpeng-7/birefnet does not
    exist on Replicate (its page returns 404, and it
    appears in no listing). The endpoint is now
    sprited/birefnet — a maintained packaging of the
    same MIT model — with the output format pinned to
    a cutout; tests updated, suite green. Remaining
    gate: the founder's phone test (add one new item
    with a photo; the clean cutout, right way up, is
    the pass). The three-experiment plan is
    docs/proposals/IMAGE-PIPELINE-EXPERIMENTS.md.

### PC-36: Photo of a person → individual articles + the outfit
- **Status:** Not started. A prototype is approved
  (founder, 2026-10-21) but waits for PC-34 to go live:
  both use the same garment-extraction core, and PC-34
  waits for the founder's token step (see its card).
  Next action after that: the prototype below.
- **In plain words:** Take one photo of a person wearing
  an outfit — a new photo, or one already on the phone.
  The app finds each garment in the photo, creates a
  wardrobe entry for each one with a clean cutout image,
  and saves the combination as an outfit. The user
  checks the new entries before anything is kept.
  Today the app can only recognize, in such a photo,
  pieces it already knows. This card makes it create
  the pieces.
- **Why it matters:** Adding clothes one by one is the
  app's largest cost to a new user, and it all falls at
  the start, before the app has given anything back.
  One photo the user already owns could do the whole
  job: the pieces enter the wardrobe and the outfit
  arrives with them. Every old outfit photo a user has
  becomes wardrobe plus outfits in one step. This is
  the direct attack on the onboarding problem (UX-14 —
  the card about getting a new user's wardrobe into the
  app without a long setup chore).
- **Key terms:**
  - *Worn photo* — a photo of a person wearing clothes,
    as opposed to a photo of one garment lying flat.
  - *Segmentation* — the step that decides which pixels
    in a photo belong to which garment. (Same term, same
    meaning as in PC-34.)
  - *Render* — a clean cutout image of one garment, as
    PC-34 produces from a flat photo.
  - *Draft article* — a wardrobe entry the app proposes
    from a photo. The user confirms or edits it; a draft
    is never kept silently.
  - *Human parsing* — the branch of image software that
    separates the parts of a person in a photo: each
    garment, the body, the background. This card needs
    it, and it is harder than flat-photo segmentation
    for two reasons: garments overlap each other, and a
    garment changes shape when a body wears it.
- **What was decided:**
  - Prototype before build (founder approved "Option
    A," 2026-10-21): try the capability on PC-34's
    extraction core, judge it on the founder's real
    outfit photos, and size any build only after that
    evidence exists.
  - Nothing lands silently. The build's shape is one
    worn photo → draft articles (clean render plus the
    app's usual descriptive tags) → the user confirms
    or edits → one outfit composed of exactly those
    articles.
  - The acceptance bar is named in advance: Alta (a
    competing wardrobe app) ships this feature today
    under the name Prettify — one selfie in, isolated
    pieces out. A prototype must match that shape
    before the shape counts as proven for us.
- **What exists today:** A function named
  `parseOutfitPhoto` reads a worn photo and matches it
  against pieces already in the wardrobe. It creates
  nothing. The gap between matching and creating is
  exactly this card.
- **Evidence:** The capability exists in production
  elsewhere: Alta's Prettify does it (their own post,
  plus an independent stylist's hands-on report, both
  reviewed in the studio's Alta teardown, 2026-10-24).
  Google Photos also builds a clothing collection on
  its own from photos of the founder wearing clothes
  (founder-reported, 2026-10-21 — the sighting that
  opened this card). What is not yet known: whether a
  readymade service, or a build of our own, reaches
  that quality at our cost. The founder's two questions
  for the shared PC-34/PC-36 research spike stand:
  (Q1) is it possible for us — a readymade solution, or
  one we build as good? (Q2) what does it cost, per
  photo and to maintain?
- **Questions for a reader:**
  1. Which route separates garments on a person most
     reliably today: a dedicated human-parsing model
     that labels every pixel, or a vision model that
     first locates each garment and a segmentation
     model that then cuts each one out?
  2. How much of a partly hidden garment (a shirt under
     an open jacket) can any current method recover —
     and is a partial piece better shown to the user as
     a draft, or refused?
  3. One worn photo becomes several model calls (one
     per garment, plus checks). Is the per-photo cost
     still sane at consumer scale, or does the shape
     need batching?
- **What remains, in order:**
  1. PC-34 goes live (its own card carries that chain:
     token → deploy → smoke test → phone check).
  2. The prototype: run real outfit photos of the
     founder through the extraction core, extended to
     several garments on a person.
  3. The founder judges the prototype against the Alta
     bar. Only then is a build sized, and it enters
     work through a planning walk.
- **History:**
  - 2026-10-21 — The founder files the direction after
    seeing Google Photos' auto-built clothing
    collection and its clean cutouts: parse a worn
    photo into its garments, create the articles and
    the outfit. Option A approved the same day
    (prototype on PC-34's core, judged on his photos).
  - 2026-10-24 — Alta's Prettify is set as the
    acceptance bar (Alta teardown, disposition round).
    At the Sprint 24 planning walk the card is kept;
    the round's vision-input slot went to the smaller
    PC-38 (reference photos in chat).
  - 2026-10-25 — This card rewritten in the studio's
    shareable-card structure (standards/shareable-cards).
  - 2026-10-25 — Research amendment (founder's question;
    report `research_notes/closet-sam3-sam3d.md`): SAM 3
    (Meta, Nov 2025) does the finding step directly —
    prompt it per garment type ("shirt", "trousers") and
    it returns every matching mask in the photo, under a
    license that permits commercial use, hosted at about
    $0.0025–0.005 per image. Recommended prototype shape,
    founder verdict pending: SAM 3 (via fal) finds and
    separates the garments; BiRefNet refines each cutout.
    The parser+boxes assembly stays as the fallback. What
    is unproven: mask quality on layered outfits — the
    prototype on the founder's real photos settles it, as
    chartered.
  - 2026-10-25 — Founder verdict on the SAM research:
    SAM 3D is ruled out, and the flow is adopted in his
    shape: (a) SAM 3 crops each garment out of the photo;
    (b) the crop is mapped to the standard item shape —
    the presentation Google Wardrobe uses for an item:
    isolated, centered, uniformly framed; (c) the same
    standard view is generated for wardrobe items
    generally, so every item presents the same way. The
    render standard is geometry, not a baked background
    (Bramble's design call): fixed canvas shape, garment
    centered, standard margin and fill; the cutout stays
    transparent and the app's surfaces provide the
    ground. This is now the prototype's shape; PC-34's
    renders adopt the same standard. Carried limit: a
    worn photo shows only the visible part of a garment,
    and the render shows what was seen — no silent
    generative completion.
  - 2026-10-25 — The standard's shape, measured on the
    founder's ask: all 69 wardrobe photos measured — 80%
    are already square, median ~0.5 megapixels — and the
    app's item tiles already present every piece in a 4:5
    frame. The standard canvas is therefore 4:5, the
    cutout centered, its longest side filling a fixed
    share of the frame; the exact share is set in the
    prototype. In the same exchange the founder asked why
    BiRefNet is still in this flow at all: it is not
    required here — SAM 3's mask may be enough on its own.
    The prototype tests mask-only against mask-plus-
    BiRefNet through the quality gate; if mask-only
    passes, BiRefNet leaves this pipeline. (BiRefNet
    stays PC-34's engine for flat photos, where it finds
    and cuts in one call.)
  - 2026-10-25 — Virtual try-off research (the founder's
    diffusion question; note research_notes/
    closet-virtual-tryoff.md): purpose-built lightweight
    diffusion models do exactly this step — they are
    called virtual try-off models; TryOffDiff is the best
    measured — but there is no usable route today. Its
    weights are academic-only by license (no commercial
    use), no try-off model has a hosted endpoint on
    Replicate or fal, and self-hosting is an unmeasured
    estimate (~$0.003–0.008 per image). The general
    image-to-image route is the research papers' own
    losing baseline. The deeper problem: the method works
    by inventing the hidden parts of a garment, and this
    catalog's promise is that the picture IS the user's
    piece; even Google's version reportedly ships with a
    'regenerate inaccurate render' button.
    Recommendation (founder verdict pending): extraction
    stays the canonical view; try-off may enter this
    prototype only as a labeled, opt-in second view, and
    only behind two gates — a license-clean model, and a
    pre-set fidelity test on the founder's real garments,
    including a printed-logo piece.
  - 2026-10-25 — Founder verdict: the try-off
    recommendation is adopted as written. Extraction
    stays the canonical view; try-off enters this
    prototype only as a labeled, opt-in second view,
    behind the license gate and the fidelity gate.
  - 2026-10-25 — The founder splits the experiment
    into its own card, PC-57, so it can be tested
    independently of this card and of PC-34; this
    card consumes PC-57's verdict when it lands. If
    the experiment passes, the generated view arrives
    here as a feature written from PC-57's findings.
  - 2026-10-26 — SAM 3 hosting for the prototype
    decided (founder): Replicate, the same API and
    token as PC-34's BiRefNet and PC-57's Qwen —
    checked live, there is still no official Meta
    SAM 3 model there; the community build
    (yodagg/sam3-image-seg, ~$0.0019 per run) is
    enough for a prototype whose real question is
    mask quality on the founder's photos. Caveat:
    community builds can drift or vanish; if SAM 3
    graduates to production, hosting is re-decided —
    the official weights deployed as our own pinned
    Replicate model, or that one call moved to fal
    (~$0.0025–0.005 per image there).
  - 2026-10-27 — This prototype is Experiment 2 in the
    image pipeline experiments plan
    (docs/proposals/IMAGE-PIPELINE-EXPERIMENTS.md):
    test set, steps, and pass bar are written there.
    It runs after Experiment 1 (PC-34's live
    verification) passes, because its finishing step
    is PC-34's pipeline.
  - 2026-10-25 — Two suggestions arrived via the founder
    from a friend, checked the same day: (1) Qwen Image
    Edit for the generated views — it is the first named
    candidate for the gated try-off slot above (hosted
    today at ~$0.02–0.04 per image; might clear the
    license gate through hosted terms — unverified; see
    the try-off note's addendum) and a candidate engine
    for on-model views under PC-49. It changes nothing
    about the canonical extraction view. (2) One-photo
    'what I wore today' logging — already shipped, as
    PC-13's 'Save + log worn today' in the Match-a-photo
    flow (Sprint 14); this card's stronger separation is
    what improves its matching when it lands.

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
- **Status:** DONE 2026-10-24 (Sprint 24). Built as
  specced: a 📷 door in the general-chat composer opens
  the one chooser (upload / camera); up to 4 photos,
  downscaled once at attach; thumbnails in the composer,
  removable before send; a photo-only message sends (the
  wire gives the model one factual line for it). The
  assembler threads them as inlineData on the last user
  turn under a REFERENCE PHOTOS brief section: inspiration,
  never inventory — name what you see, build only from
  the wardrobe. Context Standard: the duration is "this
  message," the same class as @ pointers; the composer
  thumbnails are that duration's shortcut view. The draft
  follows the attachments' lifecycle (cleared on send,
  thread switch, Start fresh, sign-out; restored when a
  send fails). Two recorded choices: (1) the image data
  never persists — the saved thread keeps only the count
  (base64 would bloat the thread doc toward the Firestore
  limit, and the card bars persistence anyway); the
  bubble shows the photos while their data lives in
  memory, and a quiet "(not saved)" line after a reload.
  (2) Trip threads ignore refImages server-side as well
  as hiding the door. tests/pc38.test.js pins the
  sanitizer + threading. Founder phone validation
  pending.

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
- **Status:** HELD — at the Sprint 24 walk (2026-10-24)
  the founder's decision on this card waits for his phone
  test of the shop attach built the same day: its core
  need (follow-up conversation about a check) may already
  be met there. On his word the remainder re-competes or
  the card closes.

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
- **Status:** DONE 2026-10-24 (Sprint 23) — all five
  build waves live the same day, followed by the
  phone-test fix buffers and the Context Standard.
  Everything it held is released: PC-38, PC-45 and the
  PC-33 remainder are in Sprint 24; PC-41 awaits the
  founder's shop-attach verdict; PC-32 was absorbed by
  wave 4. UX-16 folded in, as planned.

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
- **Status:** DONE 2026-10-24 (Sprint 24). Built on the
  Today pick's "Another" — the app's one rejection
  surface. When "Another" would generate a new pick, a
  reason sheet opens first (browsing today's existing
  set stays instant — that isn't rejection). The reason
  does two jobs, kept apart: it steers the regeneration
  (one turn, phrased into the generation request) and it
  may earn a PROPOSED rule. Situational reasons (too
  warm/cold, colors clash, not my style) steer only —
  never rules. Durable taste proposes: a named piece →
  "Skip <piece>"; the user's own words → the words;
  formality chips → a lean template. The proposal swaps
  into the sheet while the new pick composes; Save writes
  a preference fact through the one write path
  (factConflicts + deleteFacts + the standard doc shape),
  and a rule that is already a fact is never re-proposed.
  No thanks writes nothing — dismissing leaves no trace.
  Because the server reads facts from Firestore itself,
  a confirmed rule feeds the very next stylist call and
  shows in Account's facts like any other. Helpers pinned
  by tests/pc45-client.test.js. Founder phone validation
  pending.

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
- **Watch note (2026-10-25, SAM research —
  `research_notes/closet-sam3-sam3d.md`):** SAM 3D
  (single photo → a 3D mesh of an object or a body) is
  the named tool if this spike ever needs a real 3D
  view of a piece. It does not dress a body — try-on
  imagery is a generative technology, not this — and its
  garment quality is unevaluated. Revisit trigger: this
  spike's design work actually calls for a rotatable 3D
  view.

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
- **Status:** DONE 2026-10-24 (Sprint 24). Built as
  specced: an attachProposal field alongside pinProposal
  (strict literal "todayPick"), the brief section present
  only under the exact conditions (general chat, pick
  available and unattached, none dismissed), a server
  gate that drops out-of-turn proposals, and a client
  proposal card mirroring the pin card — Attach runs
  attachTodayPick(); Dismiss silences proposals for the
  conversation (Start fresh re-arms). Deviation from the
  brief text, recorded: the "at most once unless the
  subject changes" nuance is enforced as once per
  conversation by the client + server together — the
  pick is the only attachable subject in scope, so a
  subject change cannot occur. tests/pc52.test.js pins
  the brief gating and parse strictness. Awaiting the
  founder's phone validation.

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
- **Status:** DONE 2026-10-24 (Sprint 24). Built to the
  proposal doc as written: tier-0 intro cards on Outfits,
  Shop and Trips; the tier-1 gap banner on Wardrobe and
  Outfits sharing Today's component; the stylist's extra
  line at zero pieces; the shop empty line's stale "tap
  Save" copy corrected (checks auto-save). gapCopyFor is
  pinned by tests/pc53-client.test.js. Awaiting the
  founder's phone validation (his verdict is the gate).

### PC-54: Paste intake on phones (S)

- **Origin:** Founder, 2026-10-24, mid phone test of PC-51:
  "how would pasting from clipboard work on a smartphone?"
  It mostly wouldn't — PC-51 rides the keyboard paste event,
  which phones don't have. Phones gate the clipboard behind
  gestures and permissions; iOS Safari is the strictest (no
  programmatic clipboard read at all).
- **In scope:** a visible "Paste a photo" button in the shop
  sheet and the capture screen that tries the async
  clipboard read where the browser allows it (Android Chrome:
  works with a permission prompt) and degrades honestly where
  it doesn't (iOS: one line — "on iPhone, save the photo and
  upload it, or share it here" once the share target exists).
  Separately, the real phone answer: a Web Share Target so
  the system share sheet can send a photo straight into the
  app (manifest + service worker) — scope it in the walk.
- **Out of scope:** hijacking long-press paste in text
  fields (flaky, and text fields are for text).
- **Acceptance:** on Android Chrome, copy a product photo,
  tap Paste a photo in the shop sheet, land in the photo
  step; on iPhone, the same tap gives the honest fallback,
  never a silent nothing.
- **Lane:** Catalogue. **Effort:** S (share target may split
  out as its own card at the walk).
- **Status:** DONE 2026-10-24 (Sprint 24). Built as specced:
  a visible Paste a photo button on the capture screen and
  in the shop sheet; the tap tries the async clipboard read
  and routes any photo through PC-51's one routing (now a
  shared routePastedImages) — shop sheet → the cropper,
  capture → add. Every failure speaks: no read API (iOS)
  → the save-and-upload line; permission denied → Upload
  does the same job; clipboard holds no photo → copy one
  first. The guide's clipboard path carries the phone
  sentence too. pickClipboardImageType is pinned by
  tests/pc54-client.test.js. The share target split out
  as PC-55 during the build. Validation split: the
  founder's iPhone can verify the honest fallback tap;
  the Android read path needs an Android device — flagged,
  not claimed.

### PC-55: Web Share Target — photos from the share sheet (M)

- **Origin:** Split out of PC-54 during its Sprint 24 build
  (2026-10-24), on the evaluation recorded here.
- **Problem:** the real phone gesture for "I found a photo"
  is the system share sheet. PC-54's Paste button covers
  Android Chrome's clipboard read; iOS offers no clipboard
  read at all, so on iPhone the only frictionless door is
  Share → Closet.
- **Evaluation (2026-10-24):** the app has a manifest but NO
  service worker. A share target needs the manifest field
  (POST, multipart) PLUS a service worker to receive the
  POST, stash the file, and redirect into the app — and a
  service worker is new infrastructure for this app
  (update lifecycle, cache versioning, offline behavior),
  an important invisible that deserves its own design
  pass, not a bolt-on inside an S card. Platform truth:
  share targets surface only for installed PWAs, and iOS
  support is recent and partial — the payoff is real but
  narrower than the spec's promise.
- **In scope (when pulled):** a service-worker design note
  first (what it caches, how updates ship, how it can
  never serve a stale app), then the share_target field
  receiving an image into the same routing as paste
  (chooser: add or check).
- **Revisit trigger:** service-worker infrastructure gets
  pulled for any other reason (offline, install polish),
  or the founder's phone use shows screenshot → Photos →
  upload is a recurring friction.
- **Status:** Filed 2026-10-24 from the PC-54 split.
  Enters work only via a planning walk.

### PC-56: Garment embeddings — same-garment duplicate candidates (not yet sized)

- **Origin:** Founder, 2026-10-25, asking whether image
  embeddings would catch the duplicates the pHash can't:
  "would image embedding help identifying the garment
  duplicate also?" — filed on his "sounds good" the same
  day.
- **Problem:** PC-19's perceptual hash recognizes the same
  PICTURE (same photo re-saved/resized/recompressed —
  distance ≤5 of 64 bits). It cannot recognize the same
  GARMENT in a different photo (re-shot, different angle,
  light, background) — that gap is by design, and it is
  where real wardrobe duplicates would sneak in.
- **Shape (from the filing discussion):** a vision-model
  embedding per photo (a few hundred numbers describing
  what's depicted — kind, shape, color, pattern), compared
  by cosine similarity. Layered, never a replacement:
  pHash stays the only auto-acting layer (certain, free,
  instant); an embedding match only ever PROPOSES — a
  side-by-side "looks like your X — same piece?" the user
  confirms or dismisses, in the bulk-add warn pattern.
  Similar-but-different garments (two plain white tees)
  are indistinguishable to any visual system, so no
  threshold earns auto-delete or auto-link. Best input is
  the PC-34 clean render (background removed = the vector
  describes the garment, not the scene), computed once
  server-side when the render is made and stored beside
  the phash. The same vectors later serve PC-36's
  matching problem (recognizing owned pieces in a worn
  photo).
- **Costs to size at the walk:** one embedding call per
  photo at intake (money + latency, OBS-3 tracked) and a
  small vector stored per photo.
- **Revisit trigger:** PC-34 extraction live (the clean
  inputs exist), or garment duplicates become a felt
  problem in real use — whichever comes first.
- **Status:** Filed 2026-10-25. Enters work only via a
  planning walk.

### PC-57: Generated clean view — the Qwen experiment (not yet sized)

- **Status:** Filed 2026-10-25 on the founder's call to
  split this experiment out of PC-36 so it can be
  tested on its own. Not started. It does not wait for
  PC-34: it runs on photos the founder already has.
  Next action: on the founder's word, Bramble builds
  the run harness and runs the test panel below. (The
  Replicate token landed 2026-10-27 — one token
  serves PC-34, PC-36, and this card.)
- **In plain words:** Some photos hide part of a
  garment — it is being worn, it is wrinkled, another
  piece covers half of it. Software exists that can
  generate the missing view: a clean picture of the
  whole garment, as if it had been photographed flat
  on its own. This card is an experiment, not a
  feature. It tests whether that generated picture is
  faithful enough to show in the app, clearly labeled
  as generated. Only if the answer is yes does a
  separate feature card get written.
- **Why it matters:** The wardrobe's item pictures are
  extracted cutouts, real by construction, and they
  stay the canonical view (the picture the catalog
  stands behind) whatever this experiment finds. A
  generated view is the only way to offer a complete
  picture of a piece that was photographed badly —
  and the only honest way to decide about one is a
  test with its pass bar written down first, not
  impressions afterward. The same kind of engine is
  also a candidate for PC-49 (the card about previewing
  an outfit on a model of the user).
- **Key terms:**
  - *Generated view* — a picture produced by an
    image-editing model: it is given a photo and a
    written instruction and returns a new picture.
    Unlike a cutout, parts of it are invented by
    construction.
  - *Fidelity test* — the comparison defined below:
    generated views judged side by side against the
    real garments, against criteria written before
    the test runs.
  - *License gate* — before any generated picture
    could ship in the app, the model's terms must
    allow commercial use of its outputs. The best
    specialist model failed this gate in research
    (academic use only).
- **The experiment (shape):**
  - Candidate 1: Qwen Image Edit, hosted — an
    image-editing model from Alibaba, raised by a
    friend of the founder's on 2026-10-25. Published
    prices run about $0.02–0.04 per image; the real
    price is measured on the chosen host during the
    run.
  - Test panel: a fixed, small set of the founder's
    own garments — one printed-logo piece, one
    patterned piece, one plain piece, and one
    hard-edge piece (the sunglasses) — each starting
    from a worn or wrinkled photo, so the hidden-part
    problem is real.
  - The bar, set before running: side by side, the
    generated view must be recognizably the same
    piece; print and pattern must survive; no
    invented details (buttons, logos, text) may
    appear. The founder judges; his verdict is the
    gate.
  - License pin: the exact host, model version, and
    the commercial-use term relied on are recorded
    here before the run.
  - Outcomes. PASS → a feature card is written for
    the labeled, opt-in generated view, for PC-36 to
    consume (and PC-49 to consider). FAIL → the
    verdict and the failing examples are recorded
    here, and the gated slot on PC-36's card closes
    unless a new candidate earns a re-run.
- **Questions for a reader:**
  - Is there published evidence of a generalist
    editing model, or a specialist try-off model,
    preserving printed text and logos on garments?
  - What fidelity bar would you set for a catalog
    whose promise is "this picture is your garment"?
- **History:**
  - 2026-10-25 — Split out of PC-36 on the founder's
    instruction: experiment separately; add it as a
    feature only once there is a good answer. Context
    the same day: the virtual try-off research (note
    research_notes/closet-virtual-tryoff.md) found the
    specialist models license-blocked and unhosted;
    the founder adopted extraction as canonical with a
    generated view allowed only behind gates; Qwen
    Image Edit arrived via a friend of the founder's
    and was checked the same day (addendum in the
    same note).
  - 2026-10-26 — Host decided (founder): Replicate,
    for this experiment and PC-36's SAM 3 alike — one
    API, and the same Replicate token PC-34's
    extraction already waits on. Checked live: Qwen
    Image Edit runs on Replicate as community builds
    (~$0.029 per run at full settings; ~$0.003–0.007
    in small, fast configurations). The exact build
    and version get pinned in the license pin above
    before the run. Cost note: at experiment scale
    every candidate host costs pennies in total; the
    deciding factors were one vendor and one token.
  - 2026-10-27 — This experiment is Experiment 3 in
    the image pipeline experiments plan
    (docs/proposals/IMAGE-PIPELINE-EXPERIMENTS.md),
    which also records the founder's hypothesis about
    Google's mechanism (standardized shapes with the
    cloth's real details laid over them) as the
    fallback mechanism to scope if the editing-model
    route fails the fidelity bar.
