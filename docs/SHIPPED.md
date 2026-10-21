# Closet — shipped log

What went live. Momentum you can see.

## Sprint 18 (2026-10-21 → )

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
