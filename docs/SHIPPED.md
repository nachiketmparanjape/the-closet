# Closet — shipped log

What went live. Momentum you can see.

## Sprint 19 (2026-10-24 → )

- **Return divider, de-duplicated + refresh in place** —
  founder phone test 2026-10-25: "Continuing from
  Saturday" printed twice (every return after a gap
  re-measured from the same last message and stacked
  another divider). applyReturnDivider now refuses when
  a divider already trails the last real message, and
  thread loads collapse saved divider runs to their last
  row. The trailing divider also carries its own
  Start fresh action now (two-tap confirm, the sheet's
  pattern) — refresh context right there, no trip to
  the context sheet. Founder phone validation pending.
- **Ask doors start fresh** — founder decision 2026-10-24
  (phone-test buffer, refining UX-18 decision 6):
  contextual "Ask the stylist" entries (Today's Ask, a
  shop check's Ask, Build a look, Surprise me) bring a new
  subject, so they start a fresh general conversation;
  with history present, one warning sheet offers Start
  fresh / Keep chatting first. The Stylist tab remains
  the resume door, unchanged. Start fresh also clears
  any @ draft now. Founder phone validation pending.
- **PC-45: Explain-the-no → a proposed style rule** —
  shipped 2026-10-24 (Sprint 24): rejecting Today's pick
  via "Another" asks why first (chips, the pick's own
  pieces, or the user's words); the reason steers the
  regeneration for one turn, and durable-taste reasons
  earn a proposed style rule in the same sheet — saved
  as a preference fact only on the user's tap, through
  the one fact write path; dismissing leaves no trace.
  Situational reasons steer but never propose. Founder
  phone validation pending.
- **PC-38: Reference photos in stylist chat** — shipped
  2026-10-24 (Sprint 24): attach up to 4 inspiration
  photos to a message in the general chat (📷 door →
  upload/camera chooser, composer thumbnails, removable
  before send; photo-only messages send). They ride to
  the model as vision context on that turn under a brief
  section that names them inspiration, never inventory.
  Nothing is created from them; the image data is never
  saved (the thread keeps the count). Trip chats excluded
  on both sides of the wire. Founder phone validation
  pending. (Living-doc note for the PR #80 merge pass:
  the assembler has gained three inputs since the doc's
  snapshot — attachCtx (PC-52), steerCtx (PC-33),
  refImages (PC-38) — fold them in with the Context
  Standard.)
- **PC-54: Paste intake on phones** — shipped 2026-10-24
  (Sprint 24): a Paste a photo button on the capture
  screen and in the shop sheet; the tap tries the async
  clipboard read (Android Chrome, behind its permission
  prompt) and routes through PC-51's one routing; every
  failure speaks one honest line (iOS: save the photo
  and upload it). The Web Share Target split out as
  PC-55 — the app has no service worker, and that
  infrastructure deserves its own design pass. Founder
  phone validation pending (iPhone: the fallback tap;
  the Android read path needs an Android device).
- **PC-33: Trip steering in general chat** — shipped
  2026-10-24 (Sprint 24): the pin tense rule (location/
  weather proposals are present-tense only) plus the
  steering card — a future trip in general chat earns a
  Create-this-trip card; advice is never gated; a
  same-reply pin proposal for the trip's fact is
  suppressed server-side. Founder phone validation
  pending (incl. the card's education line).
- **PC-52: The stylist may propose an attachment** —
  shipped 2026-10-24 (Sprint 24): when a general
  conversation turns on the unattached pick, the model
  may propose attaching it (a card, a tap — decision 1
  intact); Dismiss silences proposals for the
  conversation, Start fresh re-arms. Founder phone
  validation pending.
- **PC-53: New-user empty states on every tab** — shipped
  2026-10-24 (Sprint 24): tier-0 intro cards on Outfits,
  Shop and Trips; a slim gap-naming banner (one shared
  gapCopyFor) on Wardrobe and Outfits below the pick
  threshold; Today's progress card speaks the same
  sentence; the stylist's empty chat gains its zero-
  pieces line; graduation is count-derived, nothing
  stored. Founder phone validation pending.

- **OBS-2: Error logging & handling overhaul** — shipped
  2026-10-24 (Sprint 20).
- **PC-39: Trip weather re-check** — shipped 2026-10-24
  (Sprint 20).
- **PC-40: Contextual shop checks** — shipped 2026-10-24
  (Sprint 20).
- **PC-43: Unnamed items heal themselves** — shipped
  2026-10-24 (Sprint 20).
- **UX-18: Stylist audit — one experience + architecture
  pass** — shipped 2026-10-24 (Sprint 23): one server
  assembler + manifest, attach-as-act, the context bar
  and sheet, saved threads, the 50-message window, the
  who-wins precedence block; followed the same day by the
  Context Standard (one shelf, three durations, one
  display, layered remove).
- **PC-37: Trip chat is a full stylist room** — shipped
  2026-10-21 (trip rooms; entry restored at the Sprint
  24 walk — the card had only a "built" note in the
  backlog and no line here).
- **UX-13: Visual redesign + design system** — shipped
  2026-10-23 (Sprint 18, the Warm Editorial waves).
- **OBS-3: AI consumption analytics** — shipped
  2026-10-23 (the ai_usage ledger and cost report;
  founder-validated the same day).
- **PC-32: Chat threads** — shipped 2026-10-24, absorbed
  into UX-18 wave 4 (one saved thread per context).

- **PC-51 — Paste a photo from the clipboard** (2026-10-24):
  a document-level paste handler snapshots image files off
  the clipboard and routes by what owns the screen — shop
  sheet open → the check via the cropper; Add pieces open
  → the ordinary capture ingest; nothing open → a small
  chooser (Add to wardrobe / Check against wardrobe). Text
  pastes are never hijacked (clipboard text + a text field
  = the field keeps it), and a paste never stacks over an
  unrelated open flow. Copy on both surfaces + the guide
  now advise screenshot / copy-and-paste for online finds.
- **Link intake REMOVED + PARKED** (2026-10-24, founder
  call): PC-44's Add-pieces link route and PC-50's
  shop-check link route are out of the product. Plain
  fetching only works for Open-Graph-friendly stores —
  Uniqlo yes; Amazon (script shell, no photo tags),
  Patagonia (bot page), REI (503) no — and a door that
  fails most of the time is worse than none. The
  `fetchLinkItem` function stays deployed but
  unreferenced; retail-label rendering stays for pieces
  saved during its life. Revisit only with a fetch
  approach measured 90%+ across a representative store
  panel. Both cards carry the full note.
- **PC-50 — Link intake for shop check** (2026-10-24,
  founder pull minutes after filing): the shop-check sheet
  gains the same paste-a-link route as Add pieces —
  `fetchLinkItem` pulls the retail photo to Storage and the
  check runs on it directly (no upload, no crop; a clean
  product shot needs neither). The trip/question snapshot
  was refactored into one helper both entries share, so a
  link check carries PC-40 context identically; retry
  re-runs the analysis on the stored photo without
  re-snapshotting. Photo/screenshot remains the fallback
  route, untouched. Sheet ordering matches Add pieces —
  photos first, link last under its "…or" label (founder
  catch, same day). Same-day fix in `fetchLinkItem`: the
  abort timer now covers the body read, not just the
  headers — some retail CDNs tarpit datacenter IPs by
  trickling the body, which had left a founder test
  spinning ~1 min; worst case is now the 12s page + 15s
  photo budget, hard-capped by the function's 60s.
  Founder's retry still froze — the ledger told the real
  story: the server answered LINK_NO_IMAGE in ~3s every
  time, but both link handlers opened their catch with a
  call to a nonexistent `logError()` (the helper is
  `reportError(where, err)`); the throw ate the toast and
  the button reset. Fixed (toast first, log second),
  guarded by test, scar recorded in OPERATIONS.md rule 8.
- **PC-44 — Non-photo catalogue intake** (Sprint 22,
  2026-10-24): paste a product link on the Add pieces screen
  → new callable `fetchLinkItem` fetches the page server-
  side, extracts the retail photo + title (Open Graph /
  JSON-LD), stores the photo, and hands it to the ordinary
  add flow as a file (describe + form unchanged). The saved
  cover carries `source: "retail"` on the photo entry —
  grid shows "· Retail photo", the piece page explains it
  and how to replace it; swapping in your own photo at save
  time means no label (binding is by file identity). Live
  smoke on the probe account: Uniqlo full success;
  Patagonia serves bots a routing page (LINK_NO_IMAGE) and
  REI 503s (LINK_UNREACHABLE) — both fail with the catalog's
  friendly copy, per the card's no-scraping-past-blocks
  scope. Guide updated to four ways in.
- **PC-47 — Forgotten-pieces utilization view** (Sprint 22,
  2026-10-24): the wardrobe gains a Sort control — Browse
  (the category wall, untouched) / Most worn / Least worn /
  Never worn, from one aggregate wear_events query (cached
  60s). Cards in wear modes carry a wear badge ("Worn 12× ·
  last Oct 3" / "Never worn"), and never-worn pieces get
  "Build a look around this" — opens the stylist with the
  piece attached as a structured reference and the request
  seeded in the composer.
- **PC-46 — Candidate-piece outfit previews** (Sprint 22,
  2026-10-24): honest scope note — the check already
  generated outfit suggestions (owned pieces only) and
  rendered them as anonymous thumbnails under "It would
  work with". The actual gap was the candidate's absence.
  The section is now "See it in an outfit": the candidate's
  own photo leads each preview (brass ring, captioned with
  its name), owned pieces follow as captioned figures with
  their real names. Applies retroactively to saved checks
  (one shared renderer). Deviation from the card's letter:
  previews reuse the check's outfit cards, not Today's
  composer card — the acceptance's substance (concrete
  previews, candidate visible, real pieces named) is met
  without rebuilding the composer for a second surface.
- **PC-42 — Crop the shop-check photo** (Sprint 21, 2026-10-24):
  picking a check photo now pauses at a crop step (fixed square
  frame, drag to pan, zoom slider + wheel, canvas render capped
  at 1600px JPEG); the cropped photo is what uploads, gets
  judged, and is saved as the subject of record. "Use full
  photo" reproduces the old flow exactly; cancelling abandons
  the check (and disarms the trip tag, like the sheet's Cancel).
- **OBS-4 — Data-model drift spot-check** (Sprint 21,
  2026-10-24): scripts/quality-report.js gains a DATA DRIFT
  census — every live item/trip/check vs DATA_MODEL v2 +
  NAMING-1, drift counted by kind with example ids, read-only.
  First run told the truth in both directions: it caught a bug
  in the report itself (the --uid flag fell back to "--days",
  so per-user sections had been reading an empty account and
  printing false all-cleans — fixed), and two real findings:
  8 v1-remnant items with no colors array (legal under the
  lazy-migration design; normalization offered as a follow-up)
  and one old dismissed check with no item name (benign; the
  list falls back to its note). Acceptance verified against a
  deliberately corrupted throwaway doc (flagged on 6 kinds,
  then deleted).
  Follow-up (founder-approved, same day): the 8 v1-remnant
  items were normalized — `scripts/normalize-v1-colors.js`
  built their `colors` arrays with the app's own
  buildColorsFromAI + palette module; the census now reports
  only the one benign historical check.
- **UX-17 — Manual theme choice** (Sprint 21, 2026-10-24):
  Account → Appearance: System / Light / Dark, stored per
  device. A head resolver stamps data-theme before first paint
  and the dark tokens now key off it (so manual Light beats a
  dark phone and vice versa); System still follows the phone
  live. Side fix: pc8-helpers' script extraction now takes the
  last inline script (the head resolver made it a second one).
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
| 2026-10-24 | Fix buffer (card 5, founder bug report) | Trip-tag bug: picking a photo source closed the check sheet through closeShopCheckSheet, which cleared the armed trip context before the check even ran — trip-started checks saved untagged. Photo-source closes now dismiss the sheet directly; handleShopCheckFile snapshots pendingShopTripId into the check state (single source of truth) and disarms; all three save paths read the state. Data repair: the founder's graphic-tee check (hE7hraSjW8oZDKOtaL1Z) PATCHed with tripId of his Hong Kong trip. |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Compact top, modeled on popular-app chrome (Instagram/Spotify/Google one-row mastheads; Nike's chrome-gets-out-of-the-way): on phones the topline is ONE row again (it had become a stacked column) — wordmark left, account right; the "Signed in as…" line is gone from the chrome (it lives in the Account sheet); the Account button becomes a circular initial avatar when signed in (identity IS the button; guests keep the Connect account pill). Hero: headline drops from ~64px display to a 27–34px one-liner, the onboarding paragraph is hidden on phones, padding and the CTA grid tighten. Net: roughly 250px of top real estate returned to content on a phone. Desktop keeps the editorial hero. |
| 2026-10-24 | Fix buffer (card 5, founder bug report) | Today→stylist context loss: the Today pick was rendered at the top of the stylist chat but never included in the askStylist payload, so questions about it were answered generically. Fix: the client sends `todayPick` (itemIds + look name + reasoning, same source the strip renders) and seeds previousPick from it; the server sanitizes it (`sanitizeTodayPick`), adds a TODAY'S PICK prompt block (deictic references resolve to it), and uses it as the iteration base when the chat has no pick of its own. askStylist redeployed; suite 265/265 (+6). The class is audited under UX-16. |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Outfit names: the NAMING-1 fallback named outfits after their first piece. New rule (`outfitComboName`): a named look keeps its name; otherwise the outfit is named by its anchor pair ("Grey sweater + Cream corduroy", two words per piece). All three save paths (stylist look, builder, photo) use it; outfitDisplayName no longer appends "+ N more". The 3 existing outfits were re-named by a one-off repair (dry-run shown, then applied). Hero: the missing space in "Your wardrobe, laid out." restored (the hidden <br> had eaten it), and the three CTAs become ONE row on phones (Add keeps the ivory primary fill, + glyph removed in the row) — the founder's question, shipped as the recommendation; one media-query flip reverts it. |
| 2026-10-24 | Fix buffer (card 5, founder idea) | The one-person pitch for feedback: the Account overlay's bare "Send feedback" button becomes a headed Feedback section with the pitch ("One person builds Closet. Feedback is how it learns — if something could be better, say it here. Every note gets read; plenty get built."), and the feedback form's intro carries the same invitation. The entry already lived in Account (Sprint 18) — what was missing was the reason to use it. |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Redundancy sweep: every window now dismisses ONE way — the ×, the backdrop, swipe, Esc. Removed 11 duplicate dismiss-only buttons: capture Cancel, bulk "Close" (it and the × both called minimizeBulk — identical), feedback Cancel, and the Cancel buttons in the piece form, item edit, trip form, outfit builder and photo-parse form, plus the JS-built "Done" buttons in the shop check result, its error state, and the saved-check view. Kept where NOT redundant: bottom-sheet Cancel rows (no × exists there), bulk's Stop (an operation control), the duplicate-photo decision bar. Capture window: on phones it is now full-screen (edge to edge, 100dvh) instead of a floating card with margins and a stray scrollbar; the modal family's max-height switched 100vh → 100dvh so no window is taller than the visible screen on iOS. |
| 2026-10-24 | Fix buffer (card 5, founder idea) | Feedback pill revived (FB-1 returns): a small "✎ Feedback" pill floats bottom-left above the tab dock, on every screen and over other windows too — it yields only to the stylist chat (it would sit on the typing box) and to the feedback form itself. It absorbs context automatically: the note is stamped with the surface in front of the user (a named map: "a shop check", "the Add pieces screen"…), the trip in play, and today's look name; the form shows a "This note will mention you were on…" line so the capture is visible, not sneaky. Visibility follows the overlay stack via openOverlay/closeOverlay + setStatus. |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Top-stack spacing rhythm: the bands each carried a different era's padding, and the compact (signed-in) hero's rules outranked the mobile ones, so the gaps around the headline, CTAs, search and chips were all different numbers. One rhythm now on phones in both hero states: hero 18px top / 12px internal / 16px bottom, utility band 16px, search-to-chips 14px; the CTA row's columns are minmax(0,1fr) so content can never stretch one pill wider than the others. |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Today-context pin in the stylist chat: the pick has ridden into the conversation since the context fix earlier tonight, but invisibly. It now gets the same pin the trip context gets — "◈ Today's pick · <look name>" in the chat title bar, beside the weather/trip/pin chips. One source of truth: the pin, the in-thread strip and the payload all read the same object (todayChipCtx), so what shows is exactly what is sent. Removing the pin (×) removes the context from the next message too, not just the display; it re-attaches when the chat is reopened. Rule recorded (founder): whatever is in the context should show up. |
| 2026-10-24 | Fix buffer (card 5, founder question) | Universal overlay rule + layout invariant checks (founder: "why do pages keep getting not well formatted? set universal rules and checks"). On phones every overlay panel is now a bottom sheet (full width, bottom-anchored, top corners rounded, max 92dvh) — the capture window (full-screen) is the only exception; the centered floating card is abolished on mobile, which was the recurring unformatted look. Backdrop deepened .58 → .66. New tests/layout-invariants.test.js guards the classes of bug: no 100vh in windows (dvh only; shell min-height excepted), the universal rule's presence, the removed duplicate-dismiss ids stay removed, 16px typed inputs/textareas (iOS zoom), every overlay panelled as modal-or-sheet. The tests immediately caught two real leftovers (refined: shell vh is deliberate; the font guard lives in a different rule than assumed — both now encoded precisely). Feedback copy de-AI'd per founder's dictation: "This experience is built and maintained by a single person…" in both the Account pitch and the form intro. |
| 2026-10-24 | Data repair (founder question) | The "Untitled item" mystery: 8 wardrobe items were literally named that — bulk-add saves whose describe step failed outright (no ai block, category Other, only a measured dominant color). Nothing ever retried them, so the placeholder became permanent and surfaced in pickers, picks and lists. Repaired by re-running the app's own describe prompt on each stored photo (Vertex, same model) and writing the full v2 field set: Off-white slim-fit chinos, Black canvas low-top sneakers, Tan striped crew-neck tee, Dark wash indigo slim jeans, Brown corduroy slim-fit pants, Beige drawstring pullover hoodie, The North Face black backpack, Black long-sleeve polo sweatshirt. Prevention filed as PC-43 (self-healing retries for unnamed items). |
| 2026-10-24 | Fix buffer (card 5, founder feedback) | Feedback pill shrunk + taught manners: on phones it is now a 40px icon-only circle (✎, word kept on desktop where modals leave it room) and it steps aside entirely while any window is open — on a phone every window is a bottom sheet owning the lower screen, and the pill was photographed sitting on top of a sheet option (Surprise me), blocking it. It reappears the moment the window closes, so the report path is: close, tap, and the note still carries the underlying screen's context. |
| 2026-10-24 | Sprint 20 card 1: OBS-2 | Error logging & handling overhaul. (a) Taxonomy: fail() now stamps its catalog key onto the thrown HttpsError and logError resolves keys via keyOf() (explicit key → catalog-message reverse lookup → code), killing the "(uncoded)" class — a failure's name can no longer be lost between the throw and the log. (b) Nothing silent: a durable error_events ledger (server-only collection, rules added) now records every callable success/failure from the one boundary, plus the non-failure events that used to vanish — trip packing rejections, plan-not-applied, slot-repair attempts/failures, outfit discards, and the four log-and-continue degradations in askStylist/planPacking (all wired through one emitEvent funnel + hooks.onEvent). (c) Quality report: scripts/quality-report.js — per-function success rates, top error keys, latency percentiles, non-failure event counts, AI outcomes, client errors, and 24h spike flags (notify-only; a scheduled digest stays a named follow-up). (d) Client correlation: client_errors now carry a per-load session id plus a 12-step action trail (view opens + window opens) so "it broke at 9:28" matches its moment. Acceptance smoke run live: an anonymous empty-wardrobe call returned the EMPTY_WARDROBE catalog message and the ledger recorded the failure WITH its key; the report reads the live data back correctly. 276/276 tests (+6). All 7 callables redeployed; rules + hosting deployed. |
| 2026-10-24 | Sprint 20 card 2: PC-43 | Unnamed items heal themselves — the prevention half of the Untitled-item incident. Both save paths now flag failure instead of forgetting it: bulk adds set needsAi when describe returns nothing; single adds set it when there was no AI suggestion and the user typed no name of their own (a user-curated save is never overridden). On every items load, a capped (3/session), sequential healer re-runs describeItem on flagged pieces' stored photos and writes the full v2 field set + the ai block, clearing the flag; legacy zombies (the literal placeholder name with no ai block) count as flagged, so any straggler from before the fix heals too. Healing failures report through OBS-1/OBS-2's pipeline rather than vanishing. Grid cards for flagged pieces show an italic "Naming…" state instead of the placeholder. Wiring guarded by 4 new tests (280/280). Live (hosting release 1792859946511000). Real-world proof pending the next natural describe failure — the code path is the same describeItem the repair used on all 8 items. |
| 2026-10-24 | Sprint 20 card 3: PC-39 | Trip weather re-check (founder's Option 1). The trip page's weather line is now a tappable pill: it shows the live forecast with a ↻ when one is held, "Typical weather · tap to check forecast" when only the climate fallback is held, and "Check forecast" when nothing is known; tapping re-fetches and updates both the trip-level weather fields and (when a plan exists) the plan's snapshot, with an honest "forecast isn't out yet" toast when the dates are beyond Open-Meteo's 16-day window. A silent re-check runs once per trip per session when the snapshot is missing, older than 24h, or the first leg day has arrived and the snapshot is still the fallback. Planning now also stamps the trip-level weather fields so the pill never needs a second fetch after a plan. Weather truth resolves trip-level first, plan snapshot for older trips. 284/284 tests (+4 wiring guards). Live (hosting release 1792860053751000). Note: Hong Kong (Nov 23) is outside the forecast window until ~Nov 7 — the pill will start returning real forecasts then. |
| 2026-10-24 | Sprint 20 card 4: PC-40 | Contextual shop checks. (a) Trip-aware: when a check starts from a trip (or is tagged to one), the client now sends the tripId and the SERVER reads the trip doc itself — name, leg, dates, the PC-39 weather, notes, and the names of what's already packed — and the model judges the item FOR that trip (weather fit, packing gap vs duplicating a packed piece, combining with packed pieces) alongside the general wardrobe fit, naming the trip in the verdict when it drives the call. A bad trip reference degrades to a plain check, never an error. (b) The wearer's own question: an optional "Anything specific?" field on the check sheet is snapshotted into the check (and cleared, same disarm discipline as the trip tag), sent with the call, and the prompt instructs the model to answer it directly. The server echoes the context it actually used; the result window shows "Judged for: <trip> · You asked: …", and both fields are saved on the check doc and shown on its detail view. 290/290 tests (+6). shopCheck redeployed; hosting live (release 1792860233310000). Founder phone test is the real-world gate: a check from the Hong Kong trip page should now reason about the trip. |
| 2026-10-24 | Founder phone validation + nit fix | Sprint 20 phone round: PC-40 validated by the founder ("the added context in the shop list seems to work properly" — judged-for line + question present on the saved check and its detail view); PC-39's pill tap returned the expected "forecast isn't out yet" toast (Hong Kong is beyond the 16-day window until ~Nov 7). Nit: the feedback bubble's pencil sat off-center — the button's content was a raw text node ("✎ " plus the word span), so the phone circle centered the text run, not the glyph; the pencil is now its own element and flex centers the glyph itself. Hosting live with the fix. |
