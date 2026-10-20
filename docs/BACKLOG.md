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
- **Design:** `docs/proposals/THREADS-PROPOSAL.md`. Interim
  threads-lite shipped 2026-10-19 (session-scoped per-context
  message lists, anchor-once, trip-mode pin scoping server +
  chip). The full cut persists threads
  (`users/{uid}/chat_threads/{threadId}`), resumes them across
  reloads, and cleans up on trip delete.
- **Status:** Not started (proposal stage). Sprint candidate.
