# Closet — shipped log

What went live. Momentum you can see.

## Sprint 19 (2026-10-24 → )

- **UX-15: Sheets & popups feel native** — built 2026-10-24.
  One sheet system for all 17 overlays: JS manages state only
  (.is-open / .is-closing + an overlay stack), CSS owns the
  motion — backdrop fades, centered dialogs rise-and-settle,
  bottom sheets travel full height, the stylist docks up on
  phone / slides from the right on desktop; exit animations
  (nothing vanishes instantly); Esc closes the topmost sheet;
  swipe-down from a sheet's head dismisses bottom sheets
  (drag follows the finger, flick/90px threshold, snap-back
  otherwise); no focus theft on open; reduced-motion is a
  120ms crossfade. DESIGN.md §5 updated to describe the
  system as built. Backdrop-tap parity had shipped in the
  2026-10-23 fix buffer. Verification: suite 257/257, live
  browser smoke (guest) — capture modal + stylist chat open
  and close cleanly via backdrop, Esc, and close controls,
  no scroll-lock after close. Motion *feel* itself awaits
  founder phone validation (the card's acceptance gate).

- **PC-31: Trips Phase 3 — trip-tagged shop items + unified
  trip view** — built 2026-10-24. A saved shop check gains a
  Trip field in its detail view (tag/untag, saves on change);
  checks saved from inside a trip conversation are tagged at
  birth; Shop list cards name their trip; the trip page gains
  a "Shopping for this trip" section (tagged checks with fit
  score + status, tap through to the full check) rendered
  alongside packing and outfits — the unified view. The
  generic Shop list is unchanged. Verification: suite
  257/257, live markers confirmed; the tagged round-trip
  itself needs the founder's account data (his test trip +
  saved checks), so founder phone validation is the gate.

- **NAMING-1: Short-name standard at the data level** —
  built 2026-10-24. One rule everywhere (shared
  `functions/shortname.js` + a client mirror): a shortName
  is a noun phrase of at most 5 words — no commas, clauses,
  articles, or "with/featuring" tails. describeItem now
  mints `shortName` (model-proposed, server-capped, derived
  from the name when missing); shopCheck enforces the cap
  on its item name; every creation path stores it (single
  upload, bulk, shop→wardrobe, and outfit saves — stylist
  look names, composer, photo-parse); name edits recompute
  it. Cards and detail headers read shortName first; full
  prose stays in detail bodies. One-time backfill applied
  to the founder's library: 72 docs (69 items, 3 outfits,
  1 shop check), verified 0 remaining. Suite 259/259
  (new parse cases), both callables redeployed, client
  live. Founder phone spot-check is the final gate.

- **PC-35: Beginner guide — ways to add clothes** — built
  2026-10-24. A "Ways to add your clothes" dialog with the
  three paths (one piece at a time · a whole pile at once ·
  from Google Photos, stated honestly as save-then-add),
  each with its action onto the single capture door.
  Reachable in one tap from the Today zero card, the
  wardrobe empty state, and the capture screen itself.
  Verified end-to-end in a live guest session: guide opens
  from both entry points, all three paths render, and a
  path action closes the guide into the capture screen.

## Sprint 18 (2026-10-21 → )

- **DESIGN-HOME-1 — Today, the stylist-first home (experimental).**
  Toggle-gated from the account overlay ("Preview the new Today
  home," default off; the regular home is untouched while off).
  When on: cold-open lands on Today — serif greeting + weather
  chip, today's outfit proposal from the real composer machinery
  (one generation a day, cached; *Wear this* saves + logs the
  wear, *Another* cycles alternates, *Ask the stylist* is the
  only chat touch), then the day's thread (rate-yesterday card,
  trip countdown, shop-list door, unworn pieces) with an Explore
  floor. Graded empty states for new users (dominant upload CTA
  + a labeled sample at zero pieces; honest progress below the
  compose threshold). A "Closet" wordmark in the topline is the
  home affordance; the tab bar is unchanged. Design:
  `docs/proposals/TODAY-HOME-PROPOSAL.md` v0.2, DESIGN.md §4.10.
  Founder phone validation is the verdict that counts.
  Fix buffer 4 (his first real use): the wordmark failed as the
  way back, so Today now leads the stylist sheet — the ✦ Stylist
  pill is the persistent door home (his steer). Pick notes are
  cleaned of raw markdown and cut at sentence boundaries (his
  screenshot showed formatting junk mid-chop).
  Fix buffer 5 (manual testing): Today state moved server-side
  (settings/app toggle + today_picks/{day}) — one Today across
  devices, first device composes, others adopt; worn derives
  from live wear_events (his phantom-worn bug); trips became a
  full page instead of a stacked overlay; the stylist docks
  (bottom sheet on phone, right panel on desktop); motion
  basics landed per DESIGN.md §5 (view transitions, overlay
  entrances, press states, reduced-motion honored). Firestore
  rules gained the two new owner-only collections (deployed).
  Fix buffer 6 (founder screenshot review): the trip Save outfit
  error was root-caused — trip suggestions carry no confidence
  value and saveChatOutfit wrote it as undefined, which
  Firestore rejects outright (chat saves always had one, so
  only trips broke); the write now nulls it, and save failures
  report into the client-error pipeline. Trip page
  modernization: option label + reasoning moved inside the
  outfit card, the card-in-card photo tray removed, card action
  full-width, captions tokenized + 2-line clamped; quiet text
  back button, emoji removed from meta/weather/actions, weather
  as a chip, pack list as one grouped card with dividers.
  Also same day: Google sign-in's chained popup (blocked by
  browsers) replaced with a redirect fallback that completes
  on return, migration offer included.
  Correction (founder regression report, same day): the
  redirect return raced the anonymous-first sign-in — the
  listener fired with no user and signed him back out to
  guest before the redirect result landed, so Google login
  appeared twice and never stuck. The anonymous fallback now
  waits for the redirect to settle, and the known-account
  path no longer redirects at all: the account sheet explains
  and his next tap runs the sign-in popup with fresh user
  activation (continueToExistingAccount). Redirect remains
  only for the strict popup-blocked case.
  Pack check-off (founder-approved add-on): tap a pack row to
  check it off — state on the trip doc (packing.packedIds),
  progress bar + "N of M packed", optimistic with revert on
  failure; a re-plan resets the checks with the plan.
  Graduation (founder, same day): Today is the default home —
  no stored choice means the app opens on Today; an explicit
  off is honored on every device, and the Account toggle is
  now an opt-out labeled "Today home." DESIGN.md §4.10
  records the promotion.
  Trip chat wardrobe scope (founder ask, same day): the chat
  could only discuss the current packing plan — the plumbing
  always allowed the whole wardrobe (handle mapping + client
  validation run against all items) but the prompt never said
  so. Trip mode now lists the unpacked pieces as "REST OF THE
  WARDROBE" beside the plan and explicitly allows adding any
  piece by name; chat edits preserve check-offs for pieces
  that stay in the plan. (Hosting CI broke that afternoon —
  Google-side IAM 403 — so these shipped via the manual REST
  deploy recorded in AGENTS.md.)
- **Fix buffers (founder testing, 2026-10-21).** Buffer 1:
  Stylist became a filled accent pill + the bar gained its
  shadow (text-only read as hidden); the identity preview was
  rebuilt faithful (real view structure, sample content) with
  light/dark × identity toggles after the founder caught the
  first version being an impression, not a preview. Buffer 2
  (from prod screenshots): hero CTAs unified (one primary,
  three identical secondaries, no lone emoji, no mid-label
  wraps); the global hint color returned to muted — accent-dark
  had leaked onto informational text everywhere (D7); interior
  titles dropped to the Title token (27px); outfit tiles got a
  collage stage + 2-line names + "Stylist pick" in words; shop
  cards clamp their description-title to 2 lines and verdict to
  3 in ink; the desktop tab cluster caps at 780px centered; HTML
  now serves no-cache so founder testing always sees the latest
  build. PC-34 (garment extraction research) filed the same day.
  Buffer 3 (phone screenshots, dark mode): the hero now collapses
  on non-wardrobe views so content starts at the top; a
  specificity slip that kept outfit names on one truncated line
  was fixed (the clamp now wins); Stylist gained sparkle — a ✦
  glyph, an accent gradient, and a soft glow — per the founder's
  "more sparkly" note.
- **DESIGN-SYSTEM-1 — `docs/DESIGN.md` v1.** The living design
  spec: principles, tokens (color roles, type scale, 4pt spacing,
  radius scale), the component kit, motion rules, accessibility
  floors, and twelve numbered decisions with why + alternatives.
  Drafted from a full inventory, then three recorded critique
  rounds (log in the sprint folder) — the rounds caught a live
  contrast bug in a token pair, a floating-button/tab-bar
  collision, and a serif size floor. Founder approved the
  direction 2026-10-21; identity recorded as tokenized and
  explicitly changeable (D1 note).
- **DESIGN-GRID-1 — shell + grid on the system.** Bottom tab bar
  (Wardrobe / Outfits / Shop list / Trips + Stylist as the accent
  action tab opening chat); both floating buttons retired —
  feedback now lives in the account overlay. Token pass: radius
  scale applied (cards 14, sheets 20, buttons 8), filter chips
  per the one-chip spec, outfit/trip cards flat on `--paper`,
  item photos rounded, detail photo shows the full garment
  (contain on paper-soft), the stray hardcoded `#e58db1` fossil
  removed. Native-feel basics: web manifest + generated icons,
  per-scheme theme-color, iOS standalone metas, tap-highlight off,
  overscroll contained, 16px form text (no iOS auto-zoom).
  Alternate-identity experiment at `/preview.html`: the grid
  under "Gallery" tokens (cool neutral, ink-blue, all-grotesque)
  vs the current "Lookbook", one toggle, same components.
  Verification: 217/217 tests, inline script syntax-checked,
  live client probed after deploy. **Identity verdict
  (founder, 2026-10-21): Gallery wins on look, Lookbook's serif
  wins on type — adopted identity is the merge** (Gallery
  palette + serif moments; D1 rewritten with the story, §2.1
  retokenized, app + manifest + icons swapped the same day —
  one token swap, as the D1 changeability note predicted).
  Founder also recorded the standing goal behind the native
  feel work: this system is the future native app's blueprint
  (DESIGN.md, Native feel). Still awaiting phone validation
  (tab bar feel, standalone launch, new palette in situ).

## Sprint 13 (2026-10-18 → )
- **AUTH-1: Privacy-friendlier sign-in** — shipped 2026-10-18, in founder
  phone validation. Anonymous-first auth (app always has a user), upgrade
  via Google or email link with one-account-per-email linking, persistent
  guest banner, account sheet (connected accounts, Your vibe, privacy
  note), upgrade nudge after first item.
- **Style-tag personalization** — shipped 2026-10-18, in founder phone
  validation. Vibe as a chat handle ("dress me streetwear tonight") with
  a curated synonym map + miss log; learned `vibeProfile`
  (wears/ratings/saves → tag-level EMA with decay, confidence-gated at
  0.3) as a soft prior in the stylist. Living spec: `docs/PERSONALIZATION.md`.
- **PC-13 (photo half): photo → outfit matching ("Match a photo")** —
  shipped earlier; became functional 2026-10-17 with the storageBucket
  fix. AI identifies articles in an outfit photo, user confirms each from
  a shortlist, saves the outfit (source: "photo"). **Wear-logging half
  NOT shipped** — re-filed as its own cut (Sprint 14).

## Sprint 17 (2026-10-19 → )

- **CONTEXT-1: Context pins** — shipped 2026-10-19 (commit 53170f9),
  in founder phone validation. Persistent-but-adaptable current facts
  the stylist remembers across chats: location, weather, key
  preferences (runs cold, formality bias, color loves/avoids, packing
  style, "never suggest", activity kit). Propose-never-append: the
  model surfaces at most one `pinProposal` per turn (JSON contract in
  normal chat, `pinContext` tool in trip chat); the client always
  confirms via an inline Save/Dismiss card before anything is written.
  One active pin per kind (new global pin replaces same-kind globals);
  expiry dates ignored by the server past `validUntil`. Priority:
  conversation-stated weather > pin > measured WX-1 weather. UI:
  📍 chip in the chat header for the active location pin, "Current
  context" list with Remove in the account overlay, quiet listener
  keeps both fresh. Server-side pin read is best-effort (logged to
  OBS-1 on failure). Tests: `tests/context-pins.test.js` (9) +
  `tests/context-pins-client.test.js` (5).
  Fix buffer 2026-10-19 (commit 3cdfbe6): pins can be *retracted*.
  Proposals carry action save|remove; the prompt teaches the model to
  propose "remove" with the pin's kind+label when the user says a
  fact no longer holds (cancelled plans, back early). Client shows a
  "Forget 'X'?" confirm naming the actual stored target; trip-scoped
  pins are never touched by chat proposals.
  Fix buffer 2026-10-19 (commit 0fa93ba): trip-mode tool handling.
  `extractToolCalls` returns ALL calls (a pinContext call could steal
  the turn from updateTripPacking, degrading to an empty "Hmm" reply).
  Both tools are now processed per turn; a rejected packing call is
  logged (trip_tool_args_rejected) and re-asked once with a handle
  hint; trip mode never returns an empty reply. Client warms the ID
  token before askStylist calls against an intermittent NOT_SIGNED_IN.
  Fix buffer 2 2026-10-19 (commit b0945e5): model date grounding. The
  saved NYC pin carried validUntil "2024-06-21" — the model resolved
  "next week" with no knowledge of today and hallucinated the year;
  born-expired pins vanish from CURRENT CONTEXT, so removal could
  never be proposed. Client now sends its local date; the prompt
  states TODAY explicitly; expiry filters by the client date; a past
  validUntil is dropped at sanitize; expired pins are marked in the
  account list. The stored pin was repaired to 2026-10-26.
  Fix buffer 3 2026-10-19 (commit df0ccdb): context scoping +
  threads-lite + auth self-heal. Global location/weather pins no
  longer enter trip conversations (server injects preference +
  trip-scoped pins only; the pin chip hides in trip mode). Chat
  keeps one message list per context (general / per-trip) and
  resumes them — the trip anchor posts only on a brand-new thread.
  Trip-mode output cap raised to 4000 (truncated packing rewrites).
  friendlyError now strips the functions/ prefix (NOT_SIGNED_IN had
  surfaced as a generic error); askStylist retries once after a
  forced token refresh on unauthenticated. Full persisted threads
  are scoped as PC-32 (proposal in docs/proposals/).

## Sprint 15 (2026-10-19 → )
- **PC-29 Phase 1: Trips — trip objects + packing list** — Trips tab;
  trip CRUD (name, destination with geocoding, dates, notes); new
  `planPacking` callable (one AI call: ranked articles with reasons +
  2–3 outfits from packed articles, vibe profile as bias); per-leg
  Open-Meteo forecast with honest beyond-window banner; packing saved as
  a snapshot on the trip doc; outfits saveable via the chat's card
  component. `tripId` field added to shopChecks rules (Phase 3 UI).
  Needs founder phone test.

## Sprint 14 (2026-10-18)
- **Outfit composer ("Dress me today")** — hero button; occasion chips;
  one-tap `askStylist` orchestration with WX-1 weather; main pick + up to
  2 alternates; same saveable card as chat. Needs founder phone test.
- **PC-13 remainder: photo-parse wear logging** — "Save + log worn
  today" in the photo-parse confirmation; same wear_event shape as the
  outfit view + vibe signal. Needs founder phone test.
- **"What should I wear?" cluster** — Outfits tab: Dress me today
  (composer), Rewear something (weighted-random, recency decay),
  Surprise me (chat, exploration-leaning prompt, auto-sent). Icon-only
  dice retired per founder design call — intent labeled before the tap.
  Needs founder phone test.

## Sprint 12 (2026-10-17 → )
- **PC-28: Saved shop checks ("Shop list")** — shipped 2026-10-17/18.
  Save button in the shop-check result; Shop list tab with score badges
  and status chips; detail view with note/link/SKU + considering/bought/
  dismissed + delete; one-tap "Add it to your wardrobe" (no empty form, no
  second AI run) from both the result and saved checks. Founder-tested.
- **PC-19: Perceptual-hash photo dedup** — shipped 2026-10-18. 63-bit
  pHash computed at photo selection, stored on photo entries, Hamming
  distance ≤ 5 warns ("this looks like one already on 'X' — upload
  anyway?") on single + bulk upload; all 14 existing photos backfilled.

## Sprint 1 (2026-09-30 → 2026-10-14)

- **PC-1: Delete a wardrobe piece** — shipped 2026-09-30 (PR #1).
  Founder-tested on phone 2026-10-06. Done.
- **PC-2: Edit a piece's tags/category** — shipped 2026-09-30 (PR #1).
  Founder-tested on phone 2026-10-06. Done.
- **PC-3: Auto-suggest tags at upload** — shipped 2026-09-30 (PR #1).
  Founder-tested on phone 2026-10-06. Done. (Category accuracy mediocre —
  known on-device limit; real fix is the API caption, needs Blaze call.)
- **PC-4: Multiple photos per item (up to 4)** — shipped 2026-10-05 (direct
  to main). Founder-tested on phone 2026-10-06. Done.
- **PC-5: Add/delete individual photos + choose cover** — shipped 2026-10-05
  (direct to main). Founder-tested on phone 2026-10-06. Done.
- **Color suggest: most-frequent color** — shipped 2026-10-05 (direct to
  main). Founder-tested on phone 2026-10-06. Done.

## Sprint 2 (2026-10-11 → 2026-10-28)

- **PC-6: Backend proxy (`describeItem`)** — deployed 2026-10-14 (direct
  Cloud Functions API; CLI transport broken in this VM). Verified
  end-to-end: auth gate, live Vertex AI call, HTTP 200 in ~4s. Blaze
  confirmed on.
- **PC-7: AI description + name suggestion at upload** — shipped
  2026-10-14 via CI (`a8998ad`). Founder phone-tested same day: AI worked,
  two UI bugs found (dark-mode invisible text, stale on-device hint) —
  both fixed and redeployed (`a37d410`, `7603467`).

## Sprint 3 (2026-10-29 → 2026-11-11) — started early 2026-10-14

- **PC-9: Bulk upload** — shipped 2026-10-14 via CI (`bb4a8ca`).
  Awaiting founder phone test.
- **PC-10: Chat stylist** — shipped 2026-10-14: new `askStylist` callable
  (us-central1, manual REST deploy) + chat UI via CI (`4c3b446`).
  Awaiting founder phone test.

## Sprint 4 (2026-11-12 → 2026-11-25) — approved and started early 2026-10-15

- **PC-8: Editable item data model v2** — shipped 2026-10-15 via CI.
  `colors[]` palette (name/hex/source/primary, max 3), top-level editable
  description/pattern/fit/fabric/formality/warmth/brand, AI brand
  inference, palette editor in upload + detail views, lazy migration.
  `describeItem` redeployed with the brand prompt.
- **PC-11: Standardized error handling** — shipped 2026-10-15.
  `functions/errors.js` catalog (11 keys, 4 categories), correlation IDs
  on all server logs, `friendlyError(err)` client choke point (13 call
  sites), window-level error handlers with client error IDs,
  `reportError()` as the Sentry hook (Sentry itself explicitly deferred —
  needs an account/DSN). 25 committed tests. Both functions redeployed.
- **PC-12: Outfit object + end-to-end loop** — shipped 2026-10-15.
  `askStylist` returns structured outfits (server-side name→ID
  validation); new `reflectOutfit` callable (idempotent); style-profile
  grounding in recommendations; Outfits tab + history; chat outfit card
  with Save; one-tap wear logging; 0–10 ratings + app reflection with
  user-confirmed style preferences; manual outfit builder; per-article
  wear stats. Firestore rules for the four new collections deployed.
  Awaiting founder phone test of the full loop.
- **Sprint 15 fix buffer + OBS-1** — shipped 2026-10-19 (commit 20b2294).
  **Root cause of the "Something went wrong" packing failure:** the model
  name `gemini-3.8-flash` does not resolve in Vertex AI us-central1
  (404 "Publisher model not found" on every call) — ALL AI functions
  were down, not just planPacking. Verified by direct probes:
  `gemini-2.5-flash` / `gemini-2.5-flash-lite` / `gemini-2.5-pro` return
  200; every 3.x name tried returns 404. `MODEL_VERSION` reverted to
  `gemini-2.5-flash`; all 7 functions redeployed. The earlier
  cold-start theory was wrong — the 300s timeout + one client retry
  stay as harmless hardening. **OBS-1 metrics:** every callable now
  emits a structured success log (`<fn> succeeded` + durationMs) to
  pair with the existing failure logs; `reportError()` persists client
  errors to `users/{uid}/client_errors` (owner-create-only rules) so
  failures are detectable without a user report; local
  `metrics.js` (gitignored) reports per-function success rates,
  recent server failures (key + correlationId), and client errors.
  **UX:** creating a trip now opens its detail (Plan packing as the
  next step, ✕ to dismiss); trips render as full-width cards
  (.trip-card) instead of bare tiles.
- **Sprint 16 TRIPCHAT-1: trip chat mode (PC-29 Phase 2)** — shipped
  2026-10-19 (commit bef4965). Packing iteration is conversational:
  the trip detail CTA "💬 Talk to me for changes" opens the chat
  scoped to the trip; the model receives the trip + current packing as
  handles and may call the `updateTripPacking` tool to rewrite the
  plan — the client validates every id against the wardrobe (drops
  unknowns/dupes, filters <2-piece outfits) and writes
  `trips/{tripId}.packing`, confirming with the model's whatChanged
  line. First-gen `Plan packing` stays a button; the blind Re-plan
  button is gone. First instance of the stylist-as-agent pattern
  (model proposes, client disposes). 12 new tests; full suite green.
  `askStylist` redeployed. Design: docs/sprints/sprint-16/.
  Awaiting founder phone validation (open trip chat → ask for a change
  → packing updates).
- **AI model migration: gemini-2.5-flash → gemini-3.5-flash** —
  shipped 2026-10-20 (commit 950e6ed). Google retired the whole 2.5
  family on Vertex AI on 2026-10-20, leaving no fallback in the old
  config. All seven AI functions (describeItem, askStylist,
  reflectOutfit, critiqueOutfit, parseOutfitPhoto, shopCheck,
  planPacking) re-pointed in code (`MODEL_VERSION`) and in deployed
  env (`GEMINI_MODEL=gemini-3.5-flash`, `VERTEX_LOCATION=global`);
  deploy-create.js / deploy-askstylist.js env defaults fixed to
  match so future functions don't regress. Root cause of the
  Oct 19 3.x outage pinned down: those scripts had pinned
  `VERTEX_LOCATION=us-central1` on every function, and 3.x models
  only serve from the global endpoint. Model chosen by live probe
  with the app's exact request shapes (thinkingBudget 512/1024,
  vision + JSON mode), never the lifecycle page alone: 3.5-flash
  passed everything in ~3s; 3.8-flash was flaky on these shapes
  (timeouts on the 512-budget text and vision+JSON calls, a 429 on
  recheck); both lite models passed every shape (and faster) but
  are a capability tier down — reasoning quality wins at this
  app's ~$0–1/month burn. (Correction, same night: an early
  partial probe capture misstated the lite models as rejecting
  these requests; the full matrix plus a confirmation recheck
  show they pass. The choice is unchanged; the reasons are as
  written here.)
  Verification: 217/217 tests, stylist benchmark 6/6 scenarios
  clean (results: tests/benchmark/results/gemini-3.5-flash-migration.json),
  all seven functions ACTIVE with the new env, callable boundary
  checks return the proper sign-in error. Awaiting founder phone
  validation (describe a photo / ask the stylist).

- **Bulk dupe UX rework (founder report, 2026-10-21):** the PC-19 duplicate warning was a binary native confirm — add the dupe too, or cancel and reselect everything. Now an in-sheet decision bar names the match(es) with three paths: "Skip it & add the rest" (flagged jobs become Skipped — "Already in your wardrobe as X", the rest start immediately), "Add it anyway", "Cancel" (selection untouched). Handles multiple dupes at once; if every photo is a dupe, skipping explains there is nothing left to add.

- **Trip chat "came back empty" — root cause + fix (founder report, 2026-10-21):** the model answered with an updateTripPacking call and no prose; the server-side handle translator (handleIndex) accepted ONLY the exact bare "[iN]" form, so when the model attached names/prose (as the prompt itself models), every article failed mapping → plan = zero pieces → retry failed identically → the fallback claimed the reply was "empty" (it was not; logs: trip_tool_args_rejected ×7 since Oct 19, near-deterministic once the wardrobe hit 69 pieces). Fixes in functions/stylist.js: handleIndex is tolerant (bracketed handle anywhere, bare iN fallback), article entries may be bare strings / handle|id|item keys / exact names; rejection logs now include a raw-args sample and retry rejections are logged too; the fallback copy distinguishes "plan could not be applied" from a genuinely empty reply; trip maxOutputTokens 4000→7000 (thinking draws from the same pool); REST OF THE WARDROBE cap 40→200 so the whole wardrobe is genuinely in scope; the trip prompt now shows one canonical article example. The strictness test in tripchat.test.js was updated to the new contract with the reason recorded.

- **Trip chat room discipline + reply hygiene (founder experimenting session, 2026-10-21):** (1) Today's Pick strip no longer renders inside a trip conversation — trip chat is a dedicated room; the strip returns when trip mode exits. (2) Trip-mode replies are unwrapped server-side when the model answers in the non-trip JSON envelope ({"reply": ..., "outfit": null}) — the raw JSON no longer reaches the chat bubble (unwrapJsonReply, unit-tested). The capability gap from the same session — outfit suggestions in trip chat that can be added to the trip + Outfits with a trip tag — is filed as a new backlog card (PC-37).

- **Trip chat outfit suggestions (founder pull, 2026-10-21):** trip mode gains a suggestTripOutfits tool — asking for outfit ideas returns up to 4 saveable outfit cards built only from the packed pieces, without touching the plan. Per-thread suggestion memory rides in the trip payload so repeat asks produce new combinations. Saving a card writes the outfit with source "trip" + the trip tag (cross-source dedup links a general-stylist twin and tags it instead of duplicating); the trip page gains a "Saved for this trip" section and the Outfits list shows the trip name. Plan-page outfit cards now also save trip-tagged. 223 tests green; founder validation pending.
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Primary-CTAs-everywhere: Today gains a permanent two-button row (＋ Add pieces / Shop check) under the date in every state; Shop list header gains a gold ＋ Shop check button (the view had no way to start a check); trips — "Shopping for this trip" now renders on every trip page (empty state included) with a ＋ Shop check for this trip button that pre-tags the saved check (pendingShopTripId → writeShopCheckDoc). Pick-an-outfit deliberately NOT added to Today (the pick card IS that action, with refinement options) — founder delegated the call. |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Shop checks AUTO-SAVE: a finished check writes itself to the shop list (status Considering, trip tag honored); Done just closes; the result shows "Saved to your shop list ✓ — delete it there anytime."; the manual Save button survives ONLY as the fallback when the auto-save write fails. "Nothing was saved" copy removed from the fresh-check flow. Trip page: "Shopping for this trip" moved up — it now renders before Outfits/Saved-for-this-trip (inserts before those headings), wrapped in .trip-shop with tightened spacing (heading margin-top 0, hint line-height 1.5, consistent 12px rhythm). |
