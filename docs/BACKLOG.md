# Closet — backlog

> **Purpose:** TRACK — the open work: what is planned, what is parked, and what is done but still listed here.
> **Earns its place if:** a planning walk can take the slate from this file alone, and a closed card leaves it.
> **Owner:** Bramble. **Status:** living.
> **Last verified:** 2026-11-06, against the November Doc Review (Decision 6).

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

### BUG-1: Diagnose the upload bounce (S — diagnosis only) — KILLED 2026-10-24
2 of 8 uploads bounced to the home screen on 2026-10-05; cause unknown.
Parked 2026-10-11 at the founder's call — it hasn't recurred. KILLED at
the Sprint 20 planning walk (founder-approved disposition): three weeks
of heavy uploading since, zero recurrence. If it ever recurs it re-files
as a new card with real data.

## Sprint 3 (2026-10-29 → 2026-11-11) — APPROVED 2026-10-14

Theme: the v1 core loop, complete. Full cards in `sprints/sprint-03/PLAN.md`.

## Ideas (untriaged)

- **Stylist as an agent (founder vision 2026-10-18):** chat as a first-class
  interface to the whole app — some users live in the UI, others do
  everything through the stylist (like Muse). Reads first (wardrobe
  search, wear history), then writes (log wear, save/rate, edit items);
  tool calls execute client-side against Firestore rules. Sequencing:
  reads before writes; revisit when the stylist lane is solid. See
  `docs/VISION.md` ("Long-term: the stylist as an agent").
  **Graduated 2026-11-21:** the trigger fired — the founder hit the
  wall live in his own thread (asked the stylist to add an item and
  log a wear; it could only talk). First writes are PC-66 (add
  items) and PC-68 (log worn), Sprint 31 (shipped 2026-11-21).
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

### Personalization: exploration vs. exploitation (open modeling question)
- **Problem:** the vibe profile only learns from what the user wears —
  untried vibes score ~0, so the stylist never suggests them, so they're
  never tried. A self-reinforcing loop (selection bias).
- **Shape (open):** occasional exploratory suggestions, counterfactual
  logging, or an explicit "surprise me" handle. Deliberately un-designed
  for v1 — parked until the profile has real data.
- **Spec:** `docs/PERSONALIZATION.md` ("Open: exploration vs. exploitation").

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
- **Slice shipped:** UX-14a (demo wardrobe + greatest-hits-first)
  built + deployed in Sprint 32 (2026-11-23); founder phone
  verification pending. Design note:
  `docs/sprints/sprint-32/UX-14A-DESIGN.md`.

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
- **Status:** Built and deployed; the access token is
  in and verified. One founder step remains before the
  first live run: add a payment method to the Replicate
  account (the account refuses every run until then —
  see History, 2026-10-27). Then the founder's phone
  check is the ship gate.
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
  1. The founder adds a payment method to the Replicate
     account (Replicate → Settings → Billing). Until
     then the account refuses every prediction create,
     however the calls are spaced.
  2. Bramble re-runs the pipe tests (SAM 3 and Qwen
     through the spike harness) to confirm creates go
     through.
  3. The founder checks extraction on his phone: add
     one new item with a photo; the clean cutout, right
     way up, is the pass. That check is the ship gate.
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
  - 2026-10-27 — Correction to the entry above: the
    token's value is not a Replicate API token. The
    spike harness's first live calls were refused by
    Replicate (401), and its safe shape diagnostics
    (length and prefix only — the value is never read)
    show what is stored is 238 characters and does not
    start with r8_; a Replicate token is about 40
    characters and starts with r8_. Everything else in
    the chain is ready (function deployed, harness
    live, gate working). Remaining step, the founder's:
    add a new secret version whose value is the token
    from replicate.com/account/api-tokens, then
    Bramble re-checks the shape and re-runs the tests.
  - 2026-10-27 — The founder added secret version 2
    (and disabled version 1). The shape check passes:
    40 characters, starts with r8_, no whitespace —
    the token is a real Replicate token, and the spike
    harness's calls are now accepted as authenticated.
    The pipe tests then caught two mechanics defects,
    both fixed the same evening in the harness and in
    this card's production seam (functions/birefnet.js),
    tests green throughout: (1) community models cannot
    be created through the /models/{owner}/{name}
    endpoint (it returns 404) — creation must name a
    version hash, so the code resolves the model's
    latest version first; this would have broken
    extraction itself on its first live call. (2)
    Accounts with no payment method are throttled on
    prediction creates (429, "burst of 1"); the code
    now waits out the window and retries. Even with
    the retries, every create across two minutes of
    spaced attempts was refused — in practice the
    account creates nothing until a payment method is
    added. That is the one remaining founder step
    (see "What remains"). Until then, extraction
    attempts fail loudly and safely: the original
    photo stays on display.
  - 2026-10-27 — The founder added the payment method.
    The throttle lifted at once; the refusal changed
    to 402 "insufficient credit": Replicate runs on
    prepaid credit, so a payment method alone is not
    enough — credit must also be purchased on the
    same billing page. That purchase is now the one
    remaining founder step; the pipe tests re-run the
    moment it lands (Replicate advises waiting a few
    minutes after purchase before retrying).
  - 2026-10-27 — Credit added; the pipe is proven
    end to end through the spike harness (BiRefNet on
    the Jujutsu Kaisen photo: pixel-exact cutout in
    3 seconds). Extraction itself still awaits the
    founder's first phone adds. Also this evening:
    the founder adopted the review-gate pattern as
    PC-58 — this card's renders gain a review state
    when that card is built (later, if it makes
    sense; see PC-58).

### PC-36: Photo of a person → individual articles + the outfit
- **Status:** BUILT (Sprint 25) — the multi-garment flow is in the code
  (Gemini lists garments → SAM cutout per garment → draft review →
  `finishOutfitParse` saves the outfit). Design validated by the founder
  2026-10-28. Founder phone validation pending — no validation record
  in SHIPPED.md or the sprint folder. The prototype precondition is met:
  PC-34's renders are live (69 normalized renders) and SAM
  3 is proven on the founder's photos.
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
  - 2026-10-27 — First live SAM 3 attempts (spike
    harness, founder's photos). The community build
    yodagg/sam3-image-seg takes its prompt in a field
    named `prompt` (its own error named it, after a
    first attempt sat in "starting" for ~25 minutes
    and then failed validation). With the right field
    it booted — and crashed inside the build on a
    channel mismatch (tensor of 4 channels against 3),
    on a wardrobe product photo. A retry on a clean
    3-channel JPEG (IMG_6949, prompt "sweatshirt") is
    running. If the build fails the same way on a
    clean input, the Replicate community builds are a
    dead end for SAM 3 and hosting goes to the
    graduation options early: our own pinned
    deployment of the official weights, or fal. The
    second community build (visionaix/sam3-1) exposes
    no version to create against through the API.
  - 2026-10-27 — SAM 3 WORKED. The retry on the clean
    JPEG resolved after a long boot (~20 minutes;
    the run itself took 10 seconds, ~$0.002): prompt
    "sweatshirt" on the fitting-room photo returned
    one mask, score 0.67, and the polygon (6,500+
    points) hugs the quarter-zip exactly — collar,
    both sleeves, hem — excluding phone, hand, watch
    and trousers. First hard evidence for Experiment
    2's core question: SAM 3 finds a worn garment.
    Output shape: boxes, polygon coordinates, scores,
    RLE mask strings, and a visualization image —
    polygons are enough to cut with. Five more runs
    fired the same night (trousers on the same photo;
    jacket + trousers on the layered outdoor photo;
    jacket + t-shirt on the noisy store photo). The
    community build's problem is boot latency and
    flakiness, not quality — the case for the
    pre-approved host switch (fal, or our own pinned
    deployment) is reliability. Founder's pipeline
    shape (2026-10-27): a Gemini call lists the
    garments first; SAM runs once per garment type.
    His guiding hypothesis: SAM 3 serves both use
    cases — this parsing and PC-34's single-garment
    cutting — one service instead of three.
  - 2026-10-27 — Batch evidence complete (overlays in
    the spikes folder, visually verified): trousers
    on IMG_6949 (0.96, waistband-to-ankles exact);
    jacket (0.70) + trousers (0.93) on the layered
    Fuji photo — the jacket mask respects the fleece
    collar, excludes the beanie in hand and the top
    beneath, and stops at its hem where the trousers
    begin; the noisy store photo — his black jacket
    and mint tee are both masked tightly (the tee's
    visible strip inside the open jacket included).
    Experiment 2's mask question is answered: SAM 3
    finds worn garments, layered and occluded
    included. NEW PIPELINE FACT: a concept call
    returns EVERY instance (14 "jacket" detections in
    the store photo — racks, mannequin, other
    shoppers). The pipeline needs an instance-
    selection step: two levers, both cheap — the
    Gemini first pass supplies color-attributed
    prompts ("black zip jacket", not "jacket"), and
    a center/size preference picks the main subject's
    instance. OPERATIONS LESSON (paid for once):
    Replicate prunes a finished prediction's output
    quickly — batch 2's masks were lost by polling
    ~90 minutes late; production must persist outputs
    the moment a job completes. (Batch 3 re-ran with
    harvest-at-completion; all JSON saved under
    spikes/sam-results/.)
  - 2026-10-27 — DECIDED (founder, late): SAM 3 is
    the parsing foundation. His reasoning: it is
    good enough on this evidence, and it identifies
    multiple garments from one photo especially when
    told what to detect (the Gemini-first,
    per-garment-prompt shape). The template-method
    arm of the close-out is CLOSED without a
    prototype — SAM answered both use cases (this
    parsing and PC-34's cutting), so the head-to-head
    is moot. One sub-decision remains for build time:
    SAM hosting (community build vs our own pinned
    deployment vs fal).

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
- **Audit results (2026-11-23, Sprint 32):** every row verified.
  No fixes filed. Carrying: Today Ask → `todayPick`; trip chat
  → `tripContext`; @-references → `references`; gallery "Build
  a look" and item-page Style button → `references`
  (`articleIds`); shop detail Ask and follow-up "Open in
  stylist chat" → `shopItem`; follow-up sheet Ask (direct
  call) → `shopItem` + `tripContext`; demo chat → `items` +
  `demoWardrobe`; "Not for me" → `rejectedOutfits`. Carrying
  as message text: composer "Dress me" (occasion), Today
  auto-compose (rejection reason), PC-66 add-flow follow-up
  (new piece names). Intentionally context-free: Wardrobe
  chat, chatFab, Stylist tab (generic room, no subject);
  "Surprise me" (the request is the message). No outfit-card
  Ask affordance exists. The Today header chip is navigation
  to Today, not a chat door. One asymmetry, not a gap:
  gallery "Build a look" starts a fresh thread (askDoor);
  the item-page Style button resumes the current thread.
  Guard: `tests/ux16-handoff.test.js` pins every row.
- **Lane:** Stylist. **Effort:** S.
- **Status:** Filed 2026-11-21. In Sprint 32 — AUDITED
  2026-11-23 (built + deployed; awaiting founder phone
  verification). All rows verified. No fixes needed.
- **Status:** Filed 2026-10-24. Competes at the next
  planning walk; the Today instance is already fixed.

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
- **Status:** Parked — SHELVED by founder decision
  2026-11-23. Essembl shipped "See it on you" (v1.0.3,
  Nov 19) and the founder's call was still no: it is a
  complicated feature, the app is reasonably feature-rich,
  and the focus now is polishing the existing experience —
  ease of use and feature discoverability. The old trigger
  (PC-34 live + PC-36 verdict) is superseded. Revisit when
  the polish/discoverability phase has shipped and the
  founder re-opens new-feature work, or if on-model preview
  becomes table stakes in the competitor set.
- **Watch note (2026-10-25, SAM research —
  `research_notes/closet-sam3-sam3d.md`):** SAM 3D
  (single photo → a 3D mesh of an object or a body) is
  the named tool if this spike ever needs a real 3D
  view of a piece. It does not dress a body — try-on
  imagery is a generative technology, not this — and its
  garment quality is unevaluated. Revisit trigger: this
  spike's design work actually calls for a rotatable 3D
  view.

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

### PC-63: Raw [iNN] handles never render in chat prose (S)

- **Origin:** Founder thread review, 2026-11-21 — his own
  screenshots show "[i42]" / "[i32]" (internal prompt handles)
  sitting in the stylist's reply text in the main chat. The
  PC-41 follow-up sheet strips them (renderReplyText); the
  main chat renderer does not.
- **Fix:** strip handles in main-chat reply rendering, the
  same treatment the follow-up sheet already gets. This is
  the floor; PC-64 is the ceiling (handles become chips).
- **Acceptance:** no stylist reply in any thread renders a
  raw [iNN] token; regression test covers a reply containing
  handles mid-sentence and at line ends.
- **Lane:** Stylist. **Effort:** S.
- **Status:** Filed 2026-11-21. In Sprint 31 — SHIPPED 2026-11-21 (built + deployed; awaiting founder phone verification).

### PC-64: Tappable item chips for item mentions in stylist prose (M)

- **Origin:** Founder thread review, 2026-11-21 — the
  follow-on to PC-63. The stylist names pieces in prose;
  those names should be objects, not text.
- **Scope:** when a reply mentions a wardrobe item via its
  handle, render a chip (thumbnail + short name) inline;
  tapping it opens the item page. The client sent the item
  list the handles index into — verify that ordering
  contract first; any handle that cannot be mapped with
  certainty falls back to plain text (never a wrong chip).
- **Acceptance:** in the general thread, a reply mentioning
  two pieces renders two chips; each opens the correct
  item; an unmappable handle renders as clean text.
- **Lane:** Stylist. **Effort:** M. Depends on PC-63.
- **Status:** Filed 2026-11-21. Sprint 31 alternate. In Sprint 32 —
  SHIPPED 2026-11-23 (built + deployed; awaiting founder phone
  verification). The ordering contract was verified first (handles
  index the `items` array the client sent); the reply carries its
  wardrobe snapshot (`wardrobeIds`) so chips map with certainty.

### PC-65: Same outfit, same card — dedupe, stable name, stable confidence (M)

- **Origin:** Founder thread review, 2026-11-21 — one
  thread returned the identical 3-item outfit three times
  as SLATE & STONE (8/10), OFF-DUTY CLASSIC (9/10) and
  CLASSIC COOL (8/10). Re-skinning reads as bluffing.
- **Scope:** an outfit's identity is its item set. When a
  proposed set matches a card already in the thread, the
  stylist must not mint a new name/score — it acknowledges
  ("same core outfit") and offers a variation axis instead
  (swap a piece, add a layer, change the shoes). Confidence
  for an item set is computed once and reused verbatim.
  Server prompt + reply contract; client dedupe as the
  backstop (identical set renders as the existing card).
- **Acceptance:** scripted thread — ask for an outfit,
  then ask again in different words; the second reply does
  not present the identical set as a new named card, and
  any repeated set carries its original confidence.
- **Lane:** Stylist. **Effort:** M.
- **Status:** Filed 2026-11-21. In Sprint 31 — SHIPPED 2026-11-21 (built + deployed; awaiting founder phone verification).

### PC-66: Add items from chat — the stylist gets hands (L)

- **Origin:** Founder thread review, 2026-11-21. He asked
  twice — "add it to the wardrobe and then create outfit
  with that" — about a photo already in the thread, and got
  two refusals. Graduates the untriaged "Stylist as an
  agent" vision (2026-10-18: reads first, then writes) —
  this is its first write. Pattern precedent: trip packing
  (model proposes, client disposes).
- **Scope:** when the user asks to add something and a
  photo is in play (attached via PC-38, sent in the thread,
  or newly captured), run the existing outfit-parse
  pipeline and present an "Add these pieces" confirm card:
  each parsed piece with its photo and name, and any piece
  that matches a logged item flagged "looks like your X —
  same piece?" (exclude it with one tap). Confirm creates
  the items through the normal finish-parse path; nothing
  is added without the tap. The stylist then continues in
  the same turn — styling with the new piece, which is
  what the user actually asked for. A blocked intent never
  returns a bare refusal again: it returns this card, or a
  button that opens the capture flow.
- **Acceptance:** from a chat photo of an unlogged outfit,
  the founder adds the pieces and receives an outfit using
  one of them, without leaving the thread; declining the
  card adds nothing; a parse failure surfaces as one human
  sentence with a retry.
- **Lane:** Stylist + Catalogue. **Effort:** L.
- **Status:** Filed 2026-11-21. In Sprint 31 — SHIPPED 2026-11-21 (built + deployed; awaiting founder phone verification) —
  the sprint's flagship.

### PC-67: The stylist verifies logged/unlogged claims against match results (S)

- **Origin:** Founder thread review, 2026-11-21 — he wrote
  "both are not logged yet I think" and the stylist simply
  assumed, then silently substituted lookalikes and called
  it "recreating that exact vibe."
- **Scope:** when a photo reference rides a chat message,
  run garment matching and pass the verdicts into the
  stylist's context: matched pieces are named as logged;
  unmatched as not found; ambiguous matches are ASKED
  about (one-line confirm in the reply or the PC-66 card),
  never silently substituted. Prompt/context change; no
  new pipeline.
- **Acceptance:** thread test — send a photo of a logged
  item; the stylist identifies it as the logged piece
  instead of proposing a substitute. Send a genuinely new
  piece; it says so plainly and offers PC-66's add card.
- **Lane:** Stylist. **Effort:** S. Pairs with PC-66.
- **Status:** Filed 2026-11-21. In Sprint 31 — SHIPPED 2026-11-21 (built + deployed; awaiting founder phone verification).

### PC-68: Log-as-worn from chat (M)

- **Origin:** Founder thread review, 2026-11-21 — "Ended
  up wearing this" was reported in chat and captured
  nowhere. Second write of the agent vision (after PC-66).
- **Scope:** an action card — "Log as worn today" — when
  the user reports wearing something, and a "Wore it"
  affordance on outfit cards and on Today's pick inside
  chat. One tap writes the wear record (outfit if the
  card is saved, else the item set) through the existing
  wear-history store. Feeds the data #139 (Today repeats
  worn outfits) needs to behave.
- **Acceptance:** one tap from chat creates a wear record
  visible in the outfit's wear history; logging twice for
  the same day is a no-op with a quiet note, not a dupe.
- **Lane:** Stylist + Outfits. **Effort:** M.
- **Status:** Filed 2026-11-21. In Sprint 31 — SHIPPED 2026-11-21 (built + deployed; awaiting founder phone verification).

### PC-69: Outfit card actions — tap a piece, swap a piece, refine in one tap (M)

- **Origin:** Founder thread review, 2026-11-21 — cards
  are dead ends: tiles don't tap, refining means typing a
  whole new message.
- **Scope:** tapping an item tile on a chat outfit card
  opens that item's page. Under each card, quick chips:
  one "Swap" chip per piece (Swap the jeans →) and two
  refinement chips (Warmer, More formal). A chip sends a
  structured follow-up carrying the card's outfit as
  context, so the reply is a revision of THIS outfit, not
  a fresh invention (and PC-65 keeps its identity rules).
- **Acceptance:** from a card, the founder swaps one piece
  and gets a revised card in one tap + one reply; tapping
  a tile opens the correct item.
- **Lane:** Stylist. **Effort:** M.
- **Status:** Filed 2026-11-21. Sprint 31 alternate. In Sprint 32 —
  SHIPPED 2026-11-23 (built + deployed; awaiting founder phone
  verification). Tile taps open the item page everywhere; Swap /
  Warmer / More formal chips are chat-only and force the card's
  outfit as the iteration base; no server change needed.

### PC-70: Outfit card hygiene — saved state, collapsed history, even tiles (S)

- **Origin:** Founder thread review, 2026-11-21 — three
  unsaved cards stack three giant Save buttons down the
  thread (one bleeding in from the previous screen), and
  item tiles render at ragged heights (jeans as a sliver
  beside the wide sweater).
- **Scope:** (a) Save persists its state — a saved card's
  button reads "Saved" and disables, surviving reload;
  (b) only the newest card renders expanded — older cards
  collapse to a compact strip (name + thumbnails + expand
  tap); (c) card item tiles use one uniform aspect via
  the display-photo resolver (PC-59's category scaling
  applies to trips, not chat cards — close that gap).
- **Acceptance:** a thread with 3+ cards shows one
  expanded card and compact strips for the rest; a saved
  card still shows Saved after reload; no tile renders
  narrower than the uniform aspect.
- **Lane:** Stylist. **Effort:** S.
- **Status:** Filed 2026-11-21. In Sprint 31 — SHIPPED 2026-11-21 (built + deployed; awaiting founder phone verification).

### PC-71: "Not for me" — a feedback signal on outfit cards (M)

- **Origin:** Founder thread review, 2026-11-21 — he
  rejected the premise three times and wore something
  else; the app learned nothing. There is no negative
  signal anywhere on a card.
- **Scope:** a quiet "Not for me" action on outfit cards
  opening reason chips (Too plain / Wrong vibe / Not that
  piece / Wrong for the weather). The signal stores on the
  message and rides future stylist context the way the
  vibe profile does — stated once, applied quietly, never
  lectured about.
- **Acceptance:** feedback persists on the thread; a test
  shows the signal present in the next request's context;
  the founder can also undo it from the same spot.
- **Lane:** Stylist. **Effort:** M.
- **Status:** Filed 2026-11-21. Sprint 31 alternate. In Sprint 32 —
  SHIPPED 2026-11-23 (built + deployed; awaiting founder phone
  verification). The signal stores on the message and rides future
  stylist context. The model never mentions it.

### PC-72: Chat polish bundle — context bar, reply variety, duplicate sends (S)

- **Origin:** Founder thread review, 2026-11-21 — three
  small thread defects in one bundle:
  (a) the context bar truncates the preference tail
  mid-word ("I like ti…") while transient weather takes
  the prime space — truncate at a word boundary and keep
  the full text one tap away in the context sheet;
  (b) stylist prose is long and repeats stock phrases
  ("effortless, cool-toned") near-verbatim across a
  thread — prompt guidance: when a card carries the
  answer, prose stays short and varies its wording;
  (c) the same user message can land twice in a thread
  (his "add it" message appears twice) — an identical
  message re-sent within a short window is caught and
  confirmed, not double-sent.
- **Acceptance:** one check per sub-item: bar never cuts
  mid-word; a 3-reply scripted thread shows no repeated
  stock phrase; a double-send produces one message.
- **Lane:** Stylist. **Effort:** S (bundle of three).
- **Status:** Filed 2026-11-21. Sprint 31 alternate. In Sprint 32 —
  SHIPPED 2026-11-23 (built + deployed; awaiting founder phone
  verification). Bar trims at a word boundary. Prose stays short
  and fresh. Identical re-sends within 10 seconds block once.
  Regressions caught by QA Round 1 (2026-11-23): (a) the bar still
  cut words mid-screen, (b) "incredibly" recurred in every reply.
  Both fixed in Sprint 33 (commit 333f71a) — see
  `docs/sprints/sprint-33/SPRINT.md`; awaiting QA retest.

### PC-73: Outfit object + save-from-chat + history list (L)

- **Origin:** Outfit-as-first-class-object epic, sliced at the Sprint 32
  planning walk (2026-11-23).
- **Problem:** recommendations are bare text — nothing persists as an
  outfit, so there is no history, no worn tracking, no object to
  favorite or search.
- **In scope:** the Outfit object `{ items, source, occasion, weather,
  createdAt }` (DATA_MODEL.md join key already decided); save a stylist
  pick from chat; a history list of saved outfits.
- **Out of scope:** worn flags/ratings (PC-74), manual builder (PC-75),
  favorites/search/worn-calendar (PC-76).
- **Done looks like:** a pick saved from chat appears as an Outfit in
  the history list with its items, occasion, and weather.
- **Lane:** Stylist + Outfits. **Effort:** L.
- **Status:** Filed 2026-11-23. Parked — new-feature work waits for the
  post-polish phase.

### PC-74: Worn flags + two-sided ratings on outfits (M)

- **Origin:** Same epic slice as PC-73.
- **Problem:** the app never learns whether a pick was worn or liked;
  the prediction-vs-outcome delta (the compounding asset for taste)
  does not exist.
- **In scope:** user flags worn / not worn on a saved outfit; user
  rates 0–10 + a descriptive opinion; the app gives its own quality
  score/suggestion on the same outfit; confidence at recommendation
  time ("8/10 because…") vs reflection after the fact.
- **Done looks like:** a worn outfit carries the user's rating +
  opinion and the app's reflection; the delta is stored as a labeled
  example.
- **Effort:** M.
- **Status:** Filed 2026-11-23. Parked — post-polish phase.

### PC-75: Manual outfit builder (M)

- **Origin:** Same epic slice as PC-73.
- **Problem:** the user cannot combine items into an outfit by hand —
  only the stylist can create outfits.
- **In scope:** user picks items into an Outfit by hand, same object,
  source=manual.
- **Done looks like:** a hand-built outfit saves and appears in history
  alongside stylist picks.
- **Effort:** M.
- **Status:** Filed 2026-11-23. Parked — post-polish phase.

### PC-76: Outfit favorites, search, worn-calendar (M)

- **Origin:** Same epic slice as PC-73.
- **Problem:** once outfits exist, there is no way back to them — no
  favorites, no search, no worn-on-which-day view.
- **In scope:** favorite an outfit; search history; a worn-on-which-day
  calendar/view.
- **Depends on:** PC-73 (the object), PC-74 (worn flags).
- **Effort:** M.
- **Status:** Filed 2026-11-23. Parked — post-polish phase.

### PC-77: First-paint layout shift — hero CTAs + Today flash (S)

- **Origin:** UI-unslop round-2 findings, 2026-11-08.
- **Problem:** hero CTAs render side-by-side then reflow to stacked;
  the app briefly flashes the catalog hero before Today renders.
- **Done looks like:** first paint matches the settled layout; no hero
  flash on load.
- **Effort:** S.
- **Status:** Filed 2026-11-23.

### PC-78: Empty-state card's blank sage-green panel (S)

- **Origin:** Round-2 findings, 2026-11-08.
- **Problem:** the empty-state card's left panel is a large blank
  sage-green block with no illustration — reads like a missing image.
- **Done looks like:** the panel carries an illustration, or the layout
  no longer reads as a missing image.
- **Effort:** S.
- **Status:** Filed 2026-11-23.

### PC-79: Modal title style split (S)

- **Origin:** Round-2 findings, 2026-11-08.
- **Problem:** big serif titles in modals vs small-caps sans titles in
  bottom sheets — pick one.
- **Done looks like:** one title style across modals and bottom sheets.
- **Effort:** S.
- **Status:** Filed 2026-11-23.

### PC-80: Sample pick card — murky photo, ragged labels (S)

- **Origin:** Round-2 findings, 2026-11-08.
- **Problem:** the sample pick card's jeans photo is murky in dark mode
  and blends into the card; photo labels wrap raggedly to two lines.
- **Done looks like:** the photo reads in dark mode; labels sit on one
  line.
- **Effort:** S.
- **Status:** Filed 2026-11-23.

### PC-81: "Start fresh" and "Set location" icons sit high (S)

- **Origin:** Round-2 findings, 2026-11-08.
- **Problem:** the ↻ and pin icons sit a touch high (G1 .ic-sm vertical
  alignment).
- **Done looks like:** both icons align with their text.
- **Effort:** S.
- **Status:** Filed 2026-11-23.

### PC-82: Delete does nothing for wardrobe pieces and wear entries (M)

- **Origin:** Weekly QA round, 2026-11-23, scope Sprint 32 cards.
- **Problem:** Delete is a silent no-op for wardrobe pieces and wear
  entries. Four clicks on the QA test piece and three on a wear entry,
  with reloads in between, produced no confirmation, no error, and no
  toast. The piece stays in the wardrobe (71 pieces, still searchable).
  The wear entry "Worn 1×, Nov 23" stays. A user cannot remove a
  wrongly captured piece or undo a mis-logged wear.
- **In scope:** Delete removes the piece and the wear entry; the UI
  confirms the removal; the removal survives a reload.
- **Out of scope:** delete feedback for trips and shop checks (parked
  QA finding P2-9 — same area, separate item).
- **Done looks like:** deleting a piece removes it from the wardrobe
  and search; deleting a wear entry removes the "Worn 1×" line; both
  show feedback.
- **Effort:** M.
- **Status:** In Sprint 33 — SHIPPED 2026-11-23; VERIFIED by QA Round 2 (2026-11-23).

### PC-83: Stylist refuses to judge an attached shop item (M)

- **Origin:** Weekly QA round, 2026-11-23, scope Sprint 32 cards
  (UX-16 step 3).
- **Problem:** "Ask the stylist about this" on a shop check attaches
  the item ("Attached: Navy crew-neck t-shirt — ask away."), but the
  stylist refuses: "I work strictly with the wardrobe you already own;
  a Shop check is the right tool for making buying decisions." The
  handoff attaches the item and then deflects. The check verdict was
  4/10. Tested via "Keep chatting"; the Start-fresh path was not tried.
- **In scope:** the stylist judges the attached shop item (fit with
  the wardrobe, verdict, buy/pass) when the handoff attaches it; or
  the "Ask the stylist about this" button does not appear when the
  stylist cannot judge.
- **Done looks like:** tapping "Ask the stylist about this" on a shop
  check gets a judgment of that item, not a deflection.
- **Effort:** M.
- **Status:** In Sprint 33 — SHIPPED 2026-11-23; VERIFIED by QA Round 2 (2026-11-23).

### PC-84: "More formal" returns a fresh outfit, not a revision (M)

- **Origin:** Weekly QA round, 2026-11-23, scope Sprint 32 cards
  (PC-69 step 3).
- **Problem:** "More formal" on HIGHLAND ESTATE returned MONOCHROME
  LEISURE — a fresh outfit sharing zero pieces with the outfit being
  revised (and a repeat of a Sunday outfit). The reply misdescribes
  the outfit being revised as having "rugged flannel", which Highland
  Estate did not contain. "Warmer" passed (kept sweater and pants,
  added the jacket).
- **In scope:** "More formal" revises the same outfit in a more
  formal direction (most pieces kept); the reply describes the outfit
  it actually revised.
- **Done looks like:** "More formal" keeps the outfit's core pieces
  and shifts formality; the reply names the pieces it changed.
- **Effort:** M.
- **Status:** In Sprint 34 — SHIPPED 2026-11-23, VERIFIED by QA Round 3 (2026-11-25): "More formal" kept 2 of 4 pieces (exactly half). Issue #150 closed. P2 note (parked): the reply misattributes the swap.

### PC-85: Reloads briefly show wrong empty states (M)

- **Origin:** Weekly QA round, 2026-11-23, scope Sprint 32 cards.
- **Problem:** after every reload the app briefly shows "0 pieces"
  with "Loading wardrobe", an empty stylist ("Tell me the occasion…",
  "Try the demo wardrobe") and "0 outfits" before the real data
  arrives. It reads as data loss. It is also the only way the demo
  entry was reachable on this account.
- **In scope:** loading states that say loading (skeleton or spinner),
  never "0 pieces" or an empty stylist, until the data arrives.
- **Done looks like:** a reload shows a loading state, not empty
  states; the wardrobe count never reads 0 while data loads.
- **Effort:** M.
- **Status:** In Sprint 33 — SHIPPED 2026-11-23; VERIFIED by QA Round 2 (2026-11-23).

### PC-86: Context bar still truncates mid-word (S)

- **Origin:** Weekly QA round, 2026-11-23 Round 2 (Sprint 33 retest),
  scope PC-72 regressions. Round 1 parked this as P2-5; the regression
  fix did not land, and Round 2 ranks it P1.
- **Problem:** the context bar visibly ends mid-word: "Today's pick ·
  Estate Minimalist · Mountain Vie…" ("View" cut to "Vie"). The full
  string exists in the DOM; the rendering clips it.
- **In scope:** the bar ends on a whole word, never mid-word, at every
  width the app runs at.
- **Done looks like:** the context bar shows whole words only; no
  clipped word at the end.
- **Effort:** S.
- **Status:** In Sprint 34 — SHIPPED 2026-11-23 and VERIFIED LIVE the same evening (signed-in browser, saved "Evening at The Battery" conversation): the bar reads "Today's pick · Estate Minimalist … · +2 more" — word boundary, no mid-word cut. Root cause: `truncateAtWord` no-op on the trailing "…" of the "I like timeless …" pin label. Issue #153 closed.

### PC-87: Outfit Delete arms but never deletes (M)

- **Origin:** Weekly QA round, 2026-11-23 Round 2 (Sprint 33 retest),
  scope smoke pass. New finding — piece delete works (PC-82), outfit
  delete does not.
- **Problem:** on the Heritage Crisp outfit, the Delete button armed
  (turned red) but never deleted, across 7 taps in 4 attempts
  (including two rapid taps and after removing the wear entry). No
  error was shown. A user cannot remove a saved outfit.
- **In scope:** Delete on an outfit removes the outfit and confirms
  it; the removal survives a reload.
- **Done looks like:** deleting an outfit removes it from Outfits and
  shows feedback.
- **Effort:** M.
- **Status:** In Sprint 34 — SHIPPED 2026-11-23, VERIFIED by QA Round 3 (2026-11-25): "Heritage Crisp" deleted, outfits 11 → 10, still gone after reload. Issue #154 closed.

### PC-88: Three-outfit stylist request errors out every time (M)

- **Origin:** Weekly QA round, 2026-11-23 Round 2 (Sprint 33 retest),
  scope PC-72 regressions. New finding, ranked P0.
- **Problem:** asking for three outfits in one thread failed three
  times with "Something went wrong on our end. Try again." (refs
  req_6f7c, req_72b4, req_4f06), in two different phrasings, while
  single-outfit requests worked in the same session. A core journey
  (several options at once) is broken.
- **In scope:** a three-outfit ask returns three outfits or a plain
  explanation of why it cannot; the failure refs are logged.
- **Done looks like:** asking for three outfits in one thread returns
  three outfits.
- **Effort:** M.
- **Status:** In Sprint 34 — SHIPPED 2026-11-23, card 1 (P0), VERIFIED by QA Round 3 (2026-11-25): three outfits in one thread, no error. Issue #152 closed.

### PC-89: Blocked intents return action cards, never bare refusals (M)

- **Origin:** Founder's own chat-thread review, 2026-11-21 (P1
  cluster, "give the stylist hands"). PC-83 fixed one instance
  (attached shop item judged instead of deflected); the general
  rule was never filed.
- **Problem:** when the stylist cannot do what was asked, it
  answers with a bare refusal and the thread dead-ends. The
  founder hit this twice in one thread ("add it to the wardrobe
  and create outfit with that" → two refusals).
- **In scope:** enumerate the blocked intents (no photo attached,
  no matching piece, out-of-scope ask, …) and give each an
  action card or deep link (attach a photo, open the capture
  flow, open the relevant surface) instead of a refusal.
- **Done looks like:** a blocked ask returns a card the user can
  act on; no bare "I can't do that" ends a thread.
- **Effort:** M.
- **Status:** Filed 2026-11-25 (Sprint 35 walk, alternate #1).

### PC-90: The nine remaining native confirm() gates (M)

- **Origin:** PC-87 finding, recorded 2026-11-23: 9 more native
  `confirm()` gates remain in the client after PC-82/PC-87 fixed
  three (piece delete, wear-entry delete, outfit delete).
- **Problem:** the same failure class as PC-82/PC-87 — a browser
  that auto-dismisses native dialogs makes each of these actions
  silently never run, with no error and no feedback. The nine:
  guest wardrobe move, sign-out, clear taste, photo delete,
  two dupe warnings, AI version generate, packing replace,
  trip delete, draft discard.
- **In scope:** every one converted to the in-app two-tap
  confirm idiom (PC-82), armed state reset on open.
- **Done looks like:** each of the nine actions confirms in-app
  and runs on the second tap; no `window.confirm(` call
  remains in the client.
- **Effort:** M.
- **Status:** Filed 2026-11-25 (Sprint 35 walk). In Sprint 35 —
  SHIPPED 2026-11-25, Round 3 (2026-11-25) PASS overall: five
  confirm flows exercised, every one armed in-app as a two-tap;
  zero native browser confirms. P2 note (parked): the wear-entry
  delete arms with no visible label change.
  Build note: a grep found **13** gates, not 9 — the three
  shop-check gates (delete saved check, clear all questions,
  dupSlot "Save anyway?") were missed in the PC-87 note. All 13
  converted; zero `window.confirm(` remains in the client.
  Commit `6de5be2`.

### PC-91: Today does not surface a wear logged today (S/M) — issue #156

- **Origin:** Weekly QA Round 1, 2026-11-23, parked as P2-7.
  Round 3 (Fri Nov 27) probes the Today area in depth.
- **Problem:** after logging Estate Minimalist as worn, Today
  still showed "Saturday you wore: Matinee Utility" — the daily
  screen does not reflect today's wear.
- **In scope:** Today reads today's wear events and surfaces
  the piece/outfit worn today.
- **Done looks like:** logging a wear today updates Today's
  "you wore" line the same day.
- **Effort:** S/M.
- **Status:** Filed 2026-11-25 (Sprint 35 walk, alternate). In
  Sprint 36 — SHIPPED 2026-11-25, VERIFIED by QA Round 4
  (2026-11-25): "Today you wore: Estate Minimalist"
  immediately and after reload. Issue #156 closed. Cause was
  the rate card's `ds < todayStr` filter, which excluded
  today's wear; fixed with `pickWearCard` + `wearCardWhenLabel`
  (commit `af0648c`). The older-wear date label ("Saturday,
  Nov 14") is covered only by unit tests — the card never fell
  back to it live, because the founder's own Nov 25 wear sits
  in front.
  Retest 2026-11-25 (Round 4): PASSES — logged Estate
  Minimalist as worn today; Today's card read "Today you wore:
  Estate Minimalist" immediately and after reload. Issue #156
  closed with verification.

### PC-92: Today keeps orphan cards for deleted items (S/M) — issue #157

- **Origin:** Weekly QA Round 1, 2026-11-23, parked as P2-8.
  Round 3 (Fri Nov 27) probes the Today area in depth.
- **Problem:** a deleted QA trip and a deleted QA shop check
  still showed on Today after deletion and reload — orphan
  cards for things that no longer exist.
- **In scope:** Today drops cards whose trip / shop check /
  item no longer exists (or hides them until the source
  returns).
- **Done looks like:** deleting a trip or shop check removes
  its Today card on the next render; no orphan cards.
- **Effort:** S/M.
- **Status:** Filed 2026-11-25 (Sprint 35 walk, alternate).
  Tested 2026-11-25 (Round 3): PASSES — deleted the QA Test — Tahoe
  trip; Today dropped its trip card immediately, still gone after
  reload. No orphan cards. Close at the next planning walk unless
  kept as regression cover.

### PC-93: A cutout made from a photo never shows on the saved item (S/M) — issue #158

- **Origin:** Founder report 2026-11-26 (Thanksgiving Day): mirror
  outfit photo uploaded; new sweatshirt's cutout "is not generated".
  Investigation the same day proved the cutout exists and passed.
- **Problem:** the outfit-parse flow cuts each garment with SAM-3 and
  stores the render (`renders/<hash>.png`, `renderStatus: "passed"`).
  The parse review sheet shows the cutout (it mints the download URL
  in memory). But `outfitParsePhotoEntry` copies only
  `renderStoragePath` + `renderStatus` onto the new item's photo
  entry — it never mints `renderUrl`. `photoDisplayUrl` returns
  `renderUrl || url`, so every display surface falls back to the
  original mirror photo. `requestPhotoRender` (the BiRefNet path,
  which does mint `renderUrl` on a gate pass) is never called on the
  parse-confirm path — its call sites are only the single-item add
  flows. Net: the cutout is generated, passed, stored — and invisible.
  The founder saw it in review, then it vanished on the saved item.
- **In scope:** mint the render download URL when a parse garment is
  confirmed into an item (same pattern the review sheet already
  uses), so the saved photo entry carries `renderUrl` and the
  resolver shows the cutout. Backfill existing items whose photo
  entry has `renderStatus: "passed"` but no `renderUrl` (the
  sweatshirt `FHMXDcg4NNpkdj8HsFMY` first).
- **Done looks like:** confirming a parsed garment shows the cutout
  on the item page, wardrobe grid, and outfit cards — not the
  original mirror photo. The sweatshirt shows its cutout without
  the founder re-doing anything.
- **Effort:** S/M.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26 (built + deployed; cutout now shows via minted renderUrl; backfill fixed 3 items incl. the sweatshirt). Awaiting QA retest.
  proposed (direct founder order 2026-11-26).

### PC-94: Diffusion standardizes the mirror photo, not the garment (M) — issue #159

- **Origin:** Founder report 2026-11-26: two manual Generate
  attempts on the burgundy/yellow sweatshirt both failed.
  `error_events` show `quality_gates_failed: color(ΔE=24.3),
  geometry` (Nov 25) and `color(ΔE=28.0), geometry` (Nov 26).
- **Problem:** `runStandardizationPipeline` feeds FLUX
  `photos[0].url` — the original mirror photo (person + room +
  pants). The color gate compares the median color of that whole
  scene against the garment-only render. Reproduced with the real
  photo: even a perfect solid-burgundy render scores ΔE=49.9
  against the worn-photo input (bar is 15). The gate measures the
  scene, not the garment, so it can never pass for a worn photo —
  no matter how good FLUX is. The cutout render (garment-only,
  already stored, already passed) is the input FLUX and the gate
  should see.
- **In scope:** when the item's first photo carries a passed cutout
  render, the pipeline uses the render (signed URL) as the FLUX
  input and as the color gate's input. No cutout → current behavior
  (original), recorded as a known-weak case.
- **Done looks like:** the sweatshirt's standardization passes the
  color gate (or fails on a real FLUX color miss, with the rejected
  render saved as evidence — PC-97). A worn-photo item no longer
  fails the color gate by construction.
- **Effort:** M.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26 (built + deployed; pipeline standardizes from the cutout render, original as fallback). Proven live on the sweatshirt (input was the cutout). Retest 2026-11-26 (Round 5) + Bramble investigation the same day: the cutout-input path WAS exercised — the navy tee's input dominant was navy rgb(27,33,53) (its cutout, created 01:26:54 UTC) and attempt 3 passed the gates and produced a correct navy render (orphaned standardized-pending.png, viewed). The visible failure was the 60s deployed timeout killing the HTTP response (PC-104) plus the final transaction failing because QA deleted the test item mid-run. The trigger never firing is PC-101, not this card. Round 6 (2026-11-26): the gates were right on all three draws (saved outputs analyzed — the geometry rejection was a full-bleed FLUX draw, 0% border-white; the color rejection was a proper bordered render; the pass was a post-SAM cutout). The cutout-input path works when the cutout exists at pipeline start; the single-item race where it does not is PC-109.
  proposed (direct founder order 2026-11-26).

### PC-95: The geometry gate fails every FLUX output (S/M) — issue #160

- **Origin:** Founder report 2026-11-26 (same two failures as
  PC-94: both list `geometry` alongside the color failure).
- **Problem:** `gateGeometry` counts alpha ≥ 128 as opaque and
  fails when coverage exceeds 95% ("no-background-detected").
  But the pipeline runs the gates on the raw FLUX output, before
  the SAM cutout — and a FLUX render has no alpha channel, so
  `ensureAlpha()` makes every pixel opaque: coverage is 100%,
  always. Reproduced with the real photo: the geometry gate fails
  an opaque image by construction. No item has passed the real
  gates since they went live (Sprint 27, ~Nov 4): all 11 "ready"
  items completed Nov 1, before the gates. The gate measures a
  property (transparency) that only exists after the step it
  precedes. No test in `standardize.test.js` covers the geometry
  gate at all — the gap that let this ship.
- **In scope:** the pre-SAM geometry check measures background
  whiteness instead of alpha (border pixels >90% near-white, like
  `isAlreadyClean`; garment = non-white pixels; same 10–95%
  coverage and 0.15–6 aspect bounds). Unit tests: opaque FLUX-like
  output passes; empty/white image fails; sliver fails; a true
  transparent cutout still passes.
- **Done looks like:** a clean FLUX render on white passes the
  geometry gate; the sweatshirt's standardization is no longer
  blocked by `geometry`.
- **Effort:** S/M.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26 (built + deployed; gate measures whiteness, works on opaque renders and cutouts). Proven live: geometry passes on the sweatshirt. Retest 2026-11-26 (Round 5) + Bramble investigation: the navy run failed geometry on attempt 1, then passed it on attempts 2–3 (the gate-fail signatures differed, so no systematic stop — correct behavior). Attempt 3's render is a correct navy tee. The visible failure was the 60s deployed timeout (PC-104), not the gate. Round 6 (2026-11-26): geometry behaved correctly on all three draws — it rejected a full-bleed FLUX output (0% border-white, 100% opaque) and passed a proper bordered render that then failed color.
  proposed (direct founder order 2026-11-26).

### PC-96: The auto-standardize trigger has no API key, so it silently skips every item (S) — issue #161

- **Origin:** Founder report 2026-11-26. The sweatshirt
  (`FHMXDcg4NNpkdj8HsFMY`, created Nov 25 13:03 PST) has
  `standardization.attempts: 2` — exactly the two manual taps,
  zero automatic attempts.
- **Problem:** `autoStandardizeItem` is ACTIVE but the Cloud
  Functions API shows `secrets: []`. `deploy-create.js`
  binds `FAL_API_KEY` only to `standardizeItem` — the trigger was
  created without it. With no key the trigger logs "not
  configured, skipping" and returns, so every new item that is
  not already-clean never gets an automatic attempt. The clean
  check runs before the key check, which is why 55 items still
  read `already_clean` — the skip is invisible for the rest.
  This is the documented failure class in `~/AGENTS.md` ("New
  Cloud Functions need secrets bound at create"); the trigger
  is a second instance of it.
- **In scope:** bind `FAL_API_KEY` to the deployed trigger (live
  patch via the Functions API, verified by read-back) AND add
  `autoStandardizeItem: ["FAL_API_KEY"]` to
  `SECRETS_BY_FUNCTION` in `deploy-create.js` so a future
  recreate keeps it. Add a secrets audit script that lists
  deployed functions and compares against `SECRETS_BY_FUNCTION`,
  run it now, and record it as a step in the deploy checklist.
- **Done looks like:** a new non-clean item gets
  `standardization.status: "processing"` from the trigger within
  a minute of creation, without any manual tap; the audit script
  reports zero missing bindings.
- **Effort:** S.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26 (live patch verified; trigger ACTIVE with FAL_API_KEY; audit script added). Retest 2026-11-26 (Round 5) + Bramble investigation: the secret IS bound (verified by read-back) — this card's fix holds. The trigger never fires for a different reason: the deployed function has NO eventTrigger at all (PC-101 — the Nov 5 REST create never wired one). The upload-error theory is disproven (req_9758 was the sweatshirt's own failure, PC-102).
  proposed (direct founder order 2026-11-26).

### PC-97: Identical retries burn runs on a failure that cannot pass (M) — issue #162

- **Origin:** Founder report 2026-11-26. Two manual attempts =
  six FLUX runs (3 gate retries each), all failed identically.
  Cost $0.18, zero chance of passing.
- **Problem:** the pipeline retries FLUX up to 3× on any gate
  failure with the same input and the same prompt — "fresh input,
  rebuilt prompt" rebuilds an identical prompt. For a systematic
  failure (color drift on a two-tone garment, or a gate that
  mis-measures by construction) the retries are deterministic:
  same failure, 3× the cost. Two more holes in the same loop:
  (a) a failed FLUX output is thrown away — no rejected render
  is saved, so there is nothing to inspect and no way to tell a
  FLUX miss from a gate miss (extract.js saves the render either
  way as tuning evidence; this pipeline does not); (b) the FLUX
  poll allows 200s per attempt, so 3 attempts can run 600s
  against the 300s function/client timeout — a slow FLUX day
  strands the item in "processing" until the 30-minute sweeper.
- **In scope:** stop retrying when two consecutive attempts fail
  with the same gate signature (same failing gate, ΔE in the same
  band) — record `systematic_gate_failure` and stop. Save the
  last FLUX output as a rejected render
  (`standardized-rejected-<attempt>.png`, path recorded on the
  item) before throwing. Budget the loop against the 300s
  timeout: no new FLUX attempt starts unless ~90s remain for
  SAM + upload.
- **Done looks like:** a systematic gate failure costs one FLUX
  run, not three; the rejected render is viewable on the item;
  a slow-FLUX run ends `failed` with a clear reason inside the
  timeout instead of stranding in `processing`.
- **Effort:** M.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26 (built + deployed; systematic stop + rejected render saved + 240s budget). Proven live: 2 runs in 42s. Retest 2026-11-26 (Round 5) + Bramble investigation: the systematic stop correctly did NOT fire on the navy item — the two gate-fail signatures differed (color+geometry, then color), and attempt 3 passed. The visible failure was the 60s deployed timeout (PC-104): the HTTP response died at 59.99s while the pipeline kept running in the background. The 240s pipeline budget is dead code under a 60s function timeout (see PC-104/PC-105). No attempt count is surfaced in the UI (parked P2); the blank-photo claim is PC-103. Round 6 (2026-11-26): the systematic stop was not exercised — the three draws failed on different signatures (geometry, color, pass), so no same-signature stop was due; the gates were right in each case.
  proposed (direct founder order 2026-11-26).

### PC-98: A failed standardization tells the founder nothing useful (S) — issue #163

- **Origin:** Founder report 2026-11-26: "diffusion 2 attempts
  did not work". The item page said only "The AI version didn't
  come out right. You can try again." — no reason, no sense that
  retrying the same way fails the same way.
- **Problem:** `lastError` carries the real reason
  (`quality_gates_failed: color(ΔE=28.0), geometry`) but the UI
  never translates it. The founder burned a second attempt on a
  failure that could not pass, because nothing told him the
  colors were the problem. The error doctrine (one human
  sentence, full detail to the ledger) is met on the ledger side
  and empty on the human side.
- **In scope:** the item page translates the last failure into
  one plain sentence — color ("the AI render's colors came out
  too far from the original"), geometry ("the AI render came out
  incomplete"), FLUX/provider error ("the image service failed"),
  timeout ("it took too long") — plus what helps (try again with
  feedback, or keep the original). The Try again button stays
  available; the message never promises a retry will work.
- **Done looks like:** after a failed attempt the founder reads
  why it failed and what to do, in one sentence, without opening
  any log.
- **Effort:** S.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26 (built + deployed; item page names the reason in one plain sentence). Awaiting QA retest.
  proposed (direct founder order 2026-11-26).

### PC-99: Most Cloud Functions still run retired nodejs20 and cannot be updated (S/M) — issue #164

- **Origin:** PC-96 audit (`scripts/verify-function-secrets.js`),
  2026-11-26. Google retired nodejs20: any update to a nodejs20
  function fails with INVALID_ARGUMENT, including a secret bind.
- **Problem:** 19 of 21 deployed functions still run nodejs20
  (parseOutfitPhoto, shopCheck, standardizeItem, reflectOutfit,
  advanceParsesHttp, approveStandardization, listOutfitParses,
  discardOutfitParse, spikeRun, fetchLinkItem, extractGarment,
  startOutfitParse, finishOutfitParse, retryOutfitGarment,
  critiqueOutfit, describeItem, planPacking, pollOutfitParse,
  rejectStandardization). The Nov 21 migration set nodejs22 in
  `deploy-update.js`, but only functions redeployed since then
  moved. The next fix to any of the 19 will fail at deploy time
  until its runtime is bumped — the PC-96 trigger patch hit
  exactly this wall and had to ride the bump in the same call.
- **In scope:** redeploy each remaining function via
  `deploy-update.js` (no code change; the script already PATCHes
  `runtime: "nodejs22"`), verifying each lands ACTIVE on
  nodejs22; re-run the audit to zero mismatches. The in-flow
  functions (extractGarment, standardizeItem, parse functions)
  bump inside Sprint 37's own deploys and do not wait for this
  card. (Update 2026-11-26: standardizeItem bumped in Sprint 37;
  18 of 21 remain on nodejs20.)
- **Done looks like:** the audit reports zero retired runtimes
  across the fleet.
- **Effort:** S/M.
- **Status:** Filed 2026-11-26 (PC-96 audit). Next planning walk.

### PC-100: FLUX renders dusty burgundy too red — the color gate fails a real shift (M)

- **Origin:** Sprint 37 live retest 2026-11-26 (scripts/
  retest-sweatshirt.js) on the founder's sweatshirt
  `FHMXDcg4NNpkdj8HsFMY`, after the PC-94 cutout input and PC-95
  geometry fixes landed. Geometry now passes; the color gate
  fails twice at ΔE=20.0 / 20.4 and the systematic stop fires
  correctly.
- **Problem:** the shift is real, not a metric artifact. Color
  analysis of the cutout vs the saved rejected render
  (`standardized-rejected.png`): cutout median rgb(111,61,67),
  FLUX median rgb(107,21,33); dominant-vs-dominant ΔE=20.2, and
  every cutout color cluster's nearest FLUX cluster is still
  ΔE≈18–20 away. FLUX drops the green channel (~61 → ~21) and
  renders a cleaner, redder burgundy than the dusty burgundy in
  the input. The prompt already says "EXACT colors" — it is not
  enough for this shade.
- **In scope:** pass the input's dominant color into the FLUX
  prompt as an explicit anchor — the gate's own median RGB,
  computed from the cutout in the pipeline, in emphatic
  CRITICAL/MUST wording (the pattern that works on this model
  for sleeves). Re-measure ΔE on the sweatshirt with the anchor.
  If the anchor does not bring ΔE under 15, the gate is right
  and the card closes with that verdict: FLUX cannot reproduce
  this color, the item keeps its original, and the failure
  message says so instead of inviting the same retry.
- **Done looks like:** the sweatshirt standardizes to
  pending_review with ΔE under 15, or the anchor is proven not
  to work and the verdict is recorded.
- **Effort:** M.
- **Status:** In Sprint 37 — SHIPPED 2026-11-26, VERDICT RECORDED: the RGB anchor does not work (live retest ΔE=22.5/23.5, worse than 20.0/20.4 without it). FLUX cannot reproduce this dusty burgundy; the gate is right and the item keeps its original.

### PC-101: The auto-standardize trigger never fires — it was never wired (M)

- **Origin:** QA round, 2026-11-26 (Round 5), scope Sprint 37 retest. Root cause proven by Bramble the same day.
- **Problem:** the automatic standardization trigger never fires on a new item (created 5:26 PM, re-checked 5:31 and 5:33 PM — no "Standardizing…" state, no render, no already-clean mark). The deployed `autoStandardizeItem` function has **no `eventTrigger` at all** (verified by reading the deployed function resource: `eventTrigger: undefined`, state ACTIVE, updateTime 2026-11-27T01:22:35Z) and zero executions in 24h of Cloud Run logs — only deployment rollouts. Cause: `deploy-create.js` creates functions via the raw REST API and its create body contains NO `eventTrigger` — the in-code `onDocumentCreated({...})` definition is only metadata for the Firebase CLI, which the REST create ignores. The Nov 5 recreate via that script silently unwired a trigger that had worked before (55 items carry `already_clean` marks from the earlier wiring). The missing FAL_API_KEY (PC-96) was a second, independent defect — now fixed, but irrelevant while the handler can never run. `autoStandardizeItem` is the only event-triggered function in the fleet (everything else is onCall/onRequest), so the wiring gap hits exactly one function.
- **In scope:** re-wire the trigger on the deployed function (PATCH with the Firestore document-created eventTrigger, or delete + recreate via a fixed deploy-create.js) and verify live with a fresh item (it standardizes or marks already-clean within minutes). Fix `deploy-create.js` so future event-triggered functions get their trigger in the create body. Extend `scripts/verify-function-secrets.js` (or the fleet audit) to check eventTrigger wiring, so a triggerless function is caught at deploy time, not by QA.
- **Done looks like:** a new item standardizes automatically within minutes of creation, or is marked already-clean; the deployed function resource shows its eventTrigger; the audit passes.
- **Effort:** M.
- **Status:** Filed 2026-11-26 (Round 5). Issue #166. Investigation complete the same day — cause proven, fix scoped. In Sprint 38 — approved 2026-11-26, building. **Wiring rebuilt twice 2026-11-26** (function deleted + recreated with its eventTrigger, nam5; second recreate 04:06Z via `deploy-create.js`, new topic `eventarc-nam5-autostandardizeitem-348874-892`); topic publisher granted to all four plausible publishers (Eventarc, Firestore, GCF admin robot, compute SA). **Live tests #1–#6 all did NOT fire. Decisive correction: the trigger NEVER fired, not once — Cloud Run logs Oct 28–Nov 27 show ZERO invocations, including the CLI era. The "Nov 5 recreate unwired it" theory is wrong; the 55 already_clean marks came from manual callable runs.** A trigger with a cloudFunction destination cannot be created through the Eventarc API directly (proven by its own error). Every checkable resource is correct; the break is in the Firestore→Eventarc source link, unobservable from this VM. **Live proof still owed — the card is not SHIPPED. Next: Firebase Console inspection, or replace the trigger with a direct call (founder decision).** **SUPERSEDED 2026-11-26 by PC-106 (#171): founder decision after the scaling discussion — replace the trigger with a direct call + sweeper. The trigger is deleted, not fixed.**

### PC-102: A background failure's error toast looks like the upload failed (S/M)

- **Origin:** QA round, 2026-11-26 (Round 5), scope Sprint 37 retest. Root cause proven by Bramble the same day.
- **Problem:** on "Upload piece" the app showed "Something went wrong on our end. Try again. (Ref: req_9758)" and the Upload button was disabled — yet the piece was created and the cutout appeared. **req_9758 was not the upload's error at all:** it is the sweatshirt's `standardizeItem` failure (systematic color ΔE=20.6, 2026-11-27T01:26:39Z) — the only error_events doc in the round window with that ref. The upload itself succeeded: describeItem failures are swallowed by design (`.catch → null`), the doc was created, `requestPhotoRender` ran and the cutout appeared ~2 min later. The toast belonged to the sweatshirt's generation (tapped a minute earlier) and surfaced over the upload screen because error toasts are global and unscoped; the disabled button was normal in-flight state. The upload did NOT break the trigger chain — the trigger was never wired (PC-101).
- **In scope:** a failure toast names the piece and action it belongs to ("The burgundy sweatshirt's AI version didn't come out right"), so it can never read as the foreground action failing; or the standardize failure is not toasted globally at all when the item page already carries the reason (PC-98 note). The upload flow itself needs no change — it already succeeds.
- **Done looks like:** a background standardization failure never appears as an upload error; the upload screen shows only upload outcomes.
- **Effort:** S/M.
- **Status:** Filed 2026-11-26 (Round 5). Issue #167. Investigation complete the same day — cause proven, fix scoped. In Sprint 38 — **SHIPPED 2026-11-26** (new `standardizeFailureToast(name, err)`; both standardize catch sites toast the named failure; 7 tests; hosting release `1795749366797000`, live markers verified). Retest 2026-11-26 (Round 6): FAILS — two background standardization failures occurred (single-add "wrong shape", parse 2 "wrong color") and no toast naming the piece was observed in either window; the only toast was the duplicate-detection toast.

### PC-103: After a failed standardization the item page's main photo goes blank (S/M)

- **Origin:** QA round, 2026-11-26 (Round 5), scope Sprint 37 retest. Investigated by Bramble the same day.
- **Problem:** after a failed standardization, the item dialog's photo area becomes an empty cream box while the wardrobe tile still shows the cutout. The round's attribution — "the rejected render is the displayed image" — is **disproven**: no client code reads `standardization.lastRejectedStoragePath` / `lastRejectedReason` (grep over `public/index.html`), and the dialog photo resolves through the same `photoDisplayUrl` (renderUrl || url) as the tile. The exact blanking mechanism could not be reproduced after the fact (the test item was deleted during the round's cleanup). Three real defects ARE proven and explain the class: (1) the open dialog holds a stale `activeItem` — set once in `openItem`, never refreshed from the live snapshot — while the tile re-renders from the listener; (2) `itemPhoto` has no `onerror` recovery, so one failed image load stays blank forever; (3) the generate flow's local `.catch` writes `activeItem.standardization = {status: "failed"}` WITHOUT `lastError`, so the dialog shows the default note even when the server knows the reason — and the server's own value after a killed run, `processing_interrupted`, matches no branch in `standardizationFailureNote` (the timeout branch only matches `standardization_timeout`).
- **In scope:** refresh the open item dialog from the snapshot listener (at least photos + standardization); add an `onerror` fallback on the item photo (retry once, then fall back to `photos[0].url`); carry `lastError` into the local failed state; map `processing_interrupted` (and any timeout-shaped error) to the timeout sentence in `standardizationFailureNote`.
- **Done looks like:** a failed item's page shows a real photo (cutout or original) even when the dialog was opened before the cutout landed or a load failed once; the failure sentence names the timeout when the run was killed.
- **Effort:** S/M.
- **Status:** Filed 2026-11-26 (Round 5). Issue #168. Investigation complete the same day — attribution corrected, fix scoped. In Sprint 38 — **SHIPPED 2026-11-26** (dialog refresh from snapshot + photo retry/fallback + lastError carry + `processing_interrupted` → timeout sentence; 5 tests; hosting release `1795749366797000`, live markers verified). Retest 2026-11-26 (Round 6): FAIL on the photo half — the sweatshirt's item page still shows a blank cream box (photo never loads, confirmed after full reload; other items load fine); the Outfits-tab tile is also a broken-image thumbnail. The sentence passes verbatim. The stored photo appears broken/missing (see PC-107).


### PC-104: Deployed functions run at 60s timeouts the source never declared (M)

- **Origin:** Bramble investigation, 2026-11-26 (Round 5 follow-up). Root cause proven from the deployed function resources + Cloud Run logs.
- **Problem:** `deploy-create.js` hardcodes `serviceConfig: {timeoutSeconds: 60, availableMemory: "512Mi"}` in its REST create body, and `deploy-update.js` only ever PATCHes `buildConfig` — so a function's declared timeout/memory in the source is silently ignored forever. Fleet audit (2026-11-26, 21 functions): `standardizeItem` deployed 60s/512Mi vs declared 300s/1GiB; `planPacking` 60s vs 300s; `parseOutfitPhoto` 60s vs 120s; `shopCheck` 60s vs 120s. Proven live: the navy tee's manual generation died with Cloud Run 504 "maximum request timeout" at exactly 59.99s latency — the pipeline needs ~2.5 min for a 3-attempt run + SAM, so no multi-attempt standardization can ever complete under 60s. The PC-97 240s pipeline deadline is dead code under a 60s cap. (Round 4's "packing-plan generation took ~75+ seconds" is the same class on `planPacking`.)
- **In scope:** set the deployed timeouts/memories to the declared values (field-scoped PATCHes: `updateMask=serviceConfig.timeoutSeconds,serviceConfig.availableMemory` — never a full serviceConfig replace, which would strip secrets); fix `deploy-create.js` to take timeout/memory from the source (or a per-function map) instead of hardcoding 60s/512Mi; fix `deploy-update.js` to preserve/apply serviceConfig on update; extend the fleet audit to fail on timeout/memory drift.
- **Done looks like:** every deployed function runs at its declared timeout/memory; a 3-attempt standardization completes inside the 300s budget; the audit passes.
- **Effort:** M.
- **Status:** Filed 2026-11-26 (Round 5 follow-up). Issue #169. In Sprint 38 — **SHIPPED 2026-11-26** (live PATCHes: standardizeItem 300s/1Gi, planPacking 300s, parseOutfitPhoto 120s, shopCheck 120s — all ACTIVE, three bumped to nodejs22; `function-config.json` is the config source of truth; `deploy-create.js` reads it at create, `deploy-update.js` applies serviceConfig after every PATCH, the audit checks config drift; audit after the PATCHes: secrets + config clean, only the 15 retired nodejs20 runtimes remain — PC-99). Retest 2026-11-26 (Round 6): **VERIFIED** — manual generation on the White crew-neck t-shirt completed inside budget (started ~21:50–51, pending_review visible at 21:52, ~1.5–2 min, never stranded in "processing").

### PC-105: The FLUX poll ignores the pipeline deadline — a slow fal day eats the whole timeout (S/M)

- **Origin:** Bramble investigation, 2026-11-26 (Round 5 follow-up).
- **Problem:** `runFluxStandardization` polls fal 40 times × 5s with no deadline parameter and no per-fetch timeout (a bare `fetch` has no timeout in Node). The pipeline's PC-97 deadline is checked only *between* attempts and inside the SAM poll — never inside the FLUX poll. So one slow FLUX attempt can consume the entire function budget by itself: under the correct 300s timeout, attempt 1's poll can run ~200s+, attempt 2 starts (elapsed < 240s) and its poll runs past the cap, and the function is killed mid-poll with the item left to the `processing_interrupted` fallback. The 60s cap (PC-104) hid this — every slow run died at 60s before the poll's own shape mattered — but fixing PC-104 without this card just moves the failure to 300s.
- **In scope:** pass `deadlineMs` into `runFluxStandardization` and stop polling past the budget (throw `standardization_timeout`); add an AbortSignal timeout to each status fetch (e.g. 30s) so a hung fetch cannot stall the loop; unit-test the poll against a fake clock/slow fetch.
- **Done looks like:** a stalled FLUX poll ends with a timeout error inside the budget, never a function-level kill; the item shows the timeout sentence.
- **Effort:** S/M.
- **Status:** Filed 2026-11-26 (Round 5 follow-up). Issue #170. In Sprint 38 — **SHIPPED 2026-11-26** (`fetchWithTimeout` + poll deadline opts in `runFluxStandardization`, pipeline passes `deadlineAt`; 5 new poll tests + 1 pipeline wiring test; deployed to `standardizeItem` and `autoStandardizeItem` 2026-11-27T03:15Z — the trigger survived the update, verified by GET). Retest 2026-11-26 (Round 6): **VERIFIED** — same run as PC-104 (manual generation completed inside budget, no poll overrun, no stranded "processing").

### PC-106: Replace the auto-standardize trigger with a direct call + sweeper (M)

- **Origin:** Founder decision 2026-11-26, after the PC-101 investigation proved the Firestore trigger never fired once (zero Cloud Run invocations Oct 28–Nov 27, including the CLI era; six live tests failed across two fully rebuilt wirings; the break is in the Firestore→Eventarc source link, unobservable from this VM). The founder asked for the better long-term solution, was given the explanation (direct call + sweeper; scaling discussed to 100k users), and approved the replacement.
- **Problem:** automatic standardization has no working delivery mechanism. The trigger is dead; manual Generate is the only path that runs the pipeline. Every new item sits unstandardized unless the founder taps Generate. The trigger's failure mode is silent — nothing errors, nothing alerts.
- **In scope:** (1) a client helper `requestStandardization(itemId)` that fire-and-forget calls the `standardizeItem` callable (no force) after every item creation — parse confirm (`applyParseGarmentDecisionsInner`), both single-item add flows, and the shop-check one-tap add; (2) hoist the already-clean check into `runStandardizationPipeline` (it lived only in the trigger — without it the direct call would burn FLUX runs on studio shots; force bypasses it; the callable returns the skipped result); (3) a new `scripts/standardize-sweeper.js` (VM script, REST adapters shared in `scripts/rest-adapters.js`) run every 30 min by cron: items with NO standardization field older than 10 min, max 5 per user per run, pipeline run in-process with the callable's bookkeeping; (4) delete the deployed `autoStandardizeItem` function (which deletes its trigger/topic/subscription) and remove its code export, its `function-config.json` entry, and its `SECRETS_BY_FUNCTION` entry; the fleet audit then has no event-triggered function to check.
- **Done looks like:** a new item standardizes (or marks already-clean) within minutes of creation with no tap; an item whose direct call never sent is healed by the sweeper within ~30 min; the deployed `autoStandardizeItem` function is gone (GET 404); the audit passes with no eventTrigger entries; a fresh item created in the app standardizes end to end (QA Round 6).
- **Effort:** M.
- **Status:** Filed 2026-11-26. Issue #171. In Sprint 38 — replaces PC-101 by founder decision the same day. **SHIPPED 2026-11-26** (direct call at all 4 creation paths + clean-check hoist + sweeper script and 30-min cron + trigger function deleted, GET 404; live sweeper run healed 8, including the founder's Olive fleece joggers → pending_review; 16 new tests; suite 786; `standardizeItem` redeployed, hosting release `1795758107348000`). Retest 2026-11-26 (Round 6): PARTIAL FAIL — the automatic call works (movement with no tap on all three new items), but the already-clean check fails on a studio shot: the single-item add ran FLUX and failed "wrong shape" instead of landing already_clean. The same photo produced three outcomes across three items (wrong shape / pending_review / wrong color) — generation is nondeterministic. Bulk add: "Add 2 pieces" stayed disabled ~2 min after Done (see PC-108). **Correction to the P0 as filed (2026-11-26, Bramble investigation): the already-clean check did not misfire on a white-background shot.** The navy photo is grey-background (Round 5's description), and the check's rule needs >90% near-white border or >5% transparency — a grey background correctly returns not-clean. The photo was deleted with the test items, so the check cannot be re-run on it. The proven failure is FLUX nondeterminism (one photo, three draws: full-bleed geometry reject / wrong-color reject / correct render — the saved outputs prove the gates were right in all three cases) plus the single-item cutout race (PC-109): the pipeline snapshots its input once at start, before the ~2 min cutout exists, and standardizes the original.

### PC-107: The sweatshirt's stored photo is broken or missing — it loads nowhere (S/M)

- **Origin:** QA round, 2026-11-26 (Round 6), scope Sprint 38
  retest.
- **Problem:** the Burgundy yellow sweatshirt's photo never loads
  anywhere: the item page shows a blank cream box (confirmed
  after a full reload, while other items' photos load fine);
  its tile in the Outfits tab ("Burgundy yellow + Brown
  corduroy") shows a broken-image thumbnail; the trip packing
  row and outfit tile for the same piece are blank/broken too.
  The PC-103 fallback (one cache-busted retry, then
  `photos[0].url`) cannot recover it, which points at the
  stored photo asset itself, not the dialog.
- **Verified 2026-11-26 (Bramble, same night): both stored files are GONE from Storage.** The item's photo entry points at `outfit-photos/1795634499576-outfit-crop.jpg` (original) and `renders/cec2a33a585ef583e2b97cbe8c072e76.png` (cutout). Both URLs return 403, and the Storage metadata GET for both paths returns 404 "No such object" — confirmed also by a full bucket listing (the render is absent from all 155 renders; the crop is absent from `outfit-photos/`). The render was verified HTTP 200 (786,179 bytes, valid PNG) at ~17:00 the same day, so both files were deleted between ~17:00 and ~21:50. **Deletion cause unknown:** the Cloud Audit Log query for `storage.objects.delete` in that window returned no entries (data-access logs appear off). Scope is narrow, not a mass loss: spot-checks the same night show the Olive fleece joggers, Teal Nike Tech Fleece joggers and Black tee all return 200 for photo + render URLs. Two older stale render pointers were already known from the PC-93 backfill (Grey cat graphic crew-neck tee, Brown corduroy pants 2nd entry).
- **Repair:** no other copy of the photo exists (the parse doc is gone; `outfit-photos/` holds only three October files). The founder re-adds the photo from his phone (Add photos on the item), which regenerates the cutout via `extractGarment`.
- **In scope:** verify the sweatshirt's stored photo URLs
  (renderUrl and `photos[0].url`) resolve; restore or re-mint
  the photo if the asset is gone; make a genuinely missing
  photo show a named placeholder rather than a blank box.
- **Done looks like:** the sweatshirt's item page, tiles, and
  packing rows all show a real photo; a missing photo shows a
  placeholder, never a blank box.
- **Effort:** S/M.
- **Status:** Filed 2026-11-26 (Round 6). Issue #172. Files confirmed deleted the same night (see above); repair is the founder re-adding the photo from his phone.

### PC-108: Bulk add "Add N pieces" stays disabled after the files show Done (S)

- **Origin:** QA round, 2026-11-26 (Round 6), scope Sprint 38
  retest.
- **Problem:** after uploading two files through Bulk add, both
  showed "Done", but the "Add 2 pieces" button stayed disabled
  for ~2 minutes. The items were created in the background
  anyway (wardrobe 73 → 75) — the button never enabling is a
  stuck state even though creation worked.
- **Cause proven 2026-11-26 (Bramble, code): `bulkFinish()` never touches `bulkStartBtn`.** `startBulkRun()` sets `bulkStartBtn.disabled = true` for the run; when the workers drain, `bulkFinish()` toasts and re-enables the file input — but it never resets the button's label or disabled state. The label ("Add 2 pieces") and enabled state are only set in `setBulkJobs()` (file selection) and the duplicate-bar path. So after a finished run the button still reads "Add 2 pieces" and stays disabled, and the only finish signal is the toast — if the user misses it, the sheet reads as stuck. Fix: in `bulkFinish()`, reset the button — label back to "Add pieces", `disabled` recomputed from the queued count.
- **In scope:** the bulk-add confirm button enables when all
  files are Done; if creation happens in the background, the
  dialog says so and closes cleanly.
- **Done looks like:** after all files show Done, the Add button
  enables immediately; closing the dialog never orphans a
  stuck state.
- **Effort:** S.
- **Status:** Filed 2026-11-26 (Round 6). Issue #173. Cause proven the same night (see above).

### PC-109: The single-item direct call races the cutout — the pipeline standardizes the original photo (M)

- **Origin:** Round 6 investigation, 2026-11-26 (sprint-triggered retest, Sprint 38). Root cause proven from the code + the saved Round 6 outputs.
- **Problem:** on single-item adds, the direct call fires at creation — in the same `.then` as `requestPhotoRender` — but the cutout (`extractGarment` via BiRefNet) takes ~2 min. The pipeline fetches its input buffer once, before the retry loop (PC-100), and records `standardization.inputKind`. With no cutout yet, `inputKind` is "original" and the pipeline standardizes the whole scene — the PC-94 defect, back through timing. Parse uploads do not have this problem: their cutout is made before the item is saved, so it is ready when the run starts.
- **Evidence:** Round 6's single-item add of the navy tee failed geometry on a full-bleed FLUX draw — the saved rejected render measures 0% border-white, 100% opaque (FLUX drew a full scene, consistent with standardizing a grey-background original) — while the two parse items (cutout ready at creation) produced a correct render (pending_review) and a color miss. The three draws also prove the gates were right in every case: the parse-2 rejection measures 100% border-white (a proper render, wrong color); the pending render is a post-SAM cutout (33% opaque). The already-clean check is NOT the failure here (see the PC-106 correction): the navy photo is grey-background, and the check correctly returns not-clean for it.
- **Diagnostic gap:** the sweeper's bookkeeping does not persist `inputKind` (the Black tee's standardization doc has no `inputKind` field), so a raced run leaves no trace of which input it used. The fix should persist it.
- **In scope:** the pipeline waits briefly for the render, or re-checks for the cutout on each retry attempt, or the client fires the direct call only after the cutout lands — whichever makes single-item adds standardize from the cutout. The sweeper persists `inputKind` on the runs it does.
- **Done looks like:** a single-item add of a studio shot standardizes from the cutout (`standardization.inputKind === "cutout"` on the item); a run that started before the cutout existed picks it up on a later attempt instead of standardizing the original.
- **Effort:** M.
- **Status:** Filed 2026-11-26 (Round 6 investigation). Issue #174.

### PC-110: extractGarment overruns its timeout and orphans the render link — the cutout is made but never shows (M)

- **Origin:** Founder live report, 2026-11-26 ("Why does cropped version did not get created for this one", Black tee with red back graphic). Root cause proven the same night from live data.
- **Problem:** the founder added the Black tee at 18:56 PST via single-item add (iPhone photo IMG_0419.jpeg, 4.27 MB). `requestPhotoRender` fired `extractGarment`; the server made the cutout and saved it — but the server took over two minutes, past its 120s deployed timeout, so the phone got `functions/internal` back instead of the result (client error logged 02:58:21Z, 123s after creation). The doc patch (`patchPhotos` in `requestPhotoRender`) runs CLIENT-side, only after the callable returns successfully — so it never ran, and the photo entry kept no `renderStoragePath` / `renderUrl` / `renderStatus`. The app kept showing the full photo. Doubly unreachable: the server never sets a `firebaseStorageDownloadTokens` metadata token on the render — the token comes from the client's `getDownloadURL()`, which runs after a good return and never ran here.
- **Evidence:** render saved 02:56:40Z at `renders/7ef7906fa462ee9a76694611246971b1.png` (19,555,165 bytes, 4284x5712, 37.5% opaque — verified a real cutout by direct inspection). Deployed `extractGarment` timeout is 120s (nodejs20, 1Gi). The server does the save (extract.js step 4) and only then runs the embedding + mask heuristics + Gemini vision check before returning — the post-save work is what overruns.
- **Repair done 2026-11-26 (same night):** token minted on the render object, cutout verified visually + by alpha stats, photo entry patched with renderUrl + renderStoragePath + renderStatus "passed" (verified by read-back). The embedding and photoQuality from the lost return were not recovered — the entry works without them (no duplicate proposal for this item).
- **In scope:** the server writes the render fields to the item doc itself (like the pipeline does), so a client timeout cannot orphan a render; and/or raise the 120s timeout; and/or the client retries the link step (re-fetch, or derive the deterministic render path and mint it as the PC-93 backfill does). The render should also be smaller/faster — the 19.5 MB full-resolution PNG is most of the cost.
- **Done looks like:** a cutout that the server saved always shows on the item, even when the phone's call to the server times out; no item sits with a render file in Storage and no link in its photo entry.
- **Effort:** M.
- **Status:** Filed 2026-11-26. Issue #175. The Black tee's cutout was linked by hand the same night.
