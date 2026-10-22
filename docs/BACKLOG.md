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
- **Status:** Not started. The `tripId` field already exists on
  shopChecks (Sprint 15); tagging UI + unified trip view remain.

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
- **Status:** Not started. Builds on OBS-1 (Sprint 15 fix buffer).
  Sprint candidate — pull at a planning walk.

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
- **Status:** Not started. Filed 2026-10-21. Natural pull:
  with or right after DESIGN-CHAT-1 — the chat sheet is
  the worst offender.

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
  the original on any failure.

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
- **Status:** Not started. Filed 2026-10-21 from the founder's
  screenshots; sprint candidate — pairs with UX-14 (attack
  line 1) and PC-34.
