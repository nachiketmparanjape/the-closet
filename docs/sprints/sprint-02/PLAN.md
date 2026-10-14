# Sprint 2 — Closet

**Dates:** 2026-10-11 → 2026-10-28 (pulled in from Oct 15 — Sprint 1
closed early, everything was approved, and the founder asked why wait.
The long window is deliberate slack around surgery + recovery.)
**Status:** Approved by founder 2026-10-11. Blaze approved by founder
2026-10-11 — PC-6/PC-7 unblocked. BUG-1 parked at the founder's call (see
card).
**Theme:** Give the catalogue a brain — one AI description per piece, so the
future stylist chat has something real to reason over. Plus close out
Sprint 1's one open bug.

**Capacity note:** the sprint opens two days after the founder's knee
surgery (Oct 13). Async as always; every cut is sized for guilt-free
rollover. The only founder asks are the Blaze decision (5 min, from the
couch) and phone testing whenever he's up to it.

## Cuts

### PC-6: Backend proxy for AI calls (M)
- **Problem:** The AI description needs an API key, and a key can't live in
  a public web app. No backend exists yet.
- **In scope:** Blaze on `closet-404e9` (approved by founder 2026-10-11;
  card on file per founder — step 0 at build time is verifying the plan is
  actually active, since a function deploy is what proves it). One callable
  Cloud Function, `describeItem`: takes the cover photo, calls the vision
  model server-side, returns a description + structured fields. API key
  stored as a function secret — never in the repo, never in the client.
- **Out of scope:** the upload-flow changes that call it (PC-7); the chat
  stylist; any other endpoints.
- **Done looks like:** function deployed; a test call with a sample photo
  returns a sane description + fields; no key anywhere in the client bundle
  or git history.
- **Note:** CI deploys Hosting only — functions deploy manually after
  review, the same deliberate pattern as the Firestore rules.
- **Status 2026-10-14:** ✅ DONE and verified end-to-end. `describeItem`
  is deployed and ACTIVE. **Blaze confirmed on** (the deploy itself proves
  it: Cloud Build ran). Verified: (1) live Vertex AI call with a real
  photo through the exact production prompt → perfect structured result
  ("Navy and white striped crew-neck tee", Tops, navy/white, striped,
  regular, cotton knit, casual, light; 2,515 tokens ≈ fractions of a
  cent); (2) auth gate — unauthenticated calls get a clean callable
  `UNAUTHENTICATED` error; (3) authenticated end-to-end invocation →
  HTTP 200 in 4.15s server-side (Cloud Run logs). Response parsing handles
  garbage output with safe defaults. CI hosting deploys stayed green
  throughout. Deploy notes for the record: this VM's egress mangles the
  Firebase CLI's empty-body POSTs (HTTP 411), so the deploy went via
  direct REST calls (same operations the CLI performs) after the
  founder's console visit enabled the first APIs; one-time project setup
  included App Engine app creation (us-central), the compute SA's
  Vertex AI User grant, and the public run.invoker binding. Founder-eyes
  test = PC-7's upload flow.

### PC-7: AI description + name suggestion at upload (M) — depends on PC-6
- **Problem:** Tags can't capture pattern, fit, or formality — and the
  founder wants a real name suggestion ("what kind of t-shirt is this"),
  not just a category.
- **In scope:** At upload, once the cover photo is chosen, one call to
  `describeItem` → suggested name + one-line description +
  {pattern, fit, fabric_guess, formality, warmth}, shown in the confirm
  step next to the existing category/color suggestions. Founder edits or
  accepts before saving; results cached on the Firestore item. The
  on-device suggestions stay as the fallback — if the call fails, upload
  proceeds exactly as today. Upload never blocks on AI.
- **Out of scope:** analyzing non-cover photos; backfilling existing items
  (separate cut if wanted); editing the description after save; the chat
  stylist.
- **Done looks like:** founder uploads a striped tee → sees a name like
  "striped crew-neck tee," a one-line description, and pattern/fit/
  formality pre-filled; corrects one field; saves; reload shows it all
  persisted.
- **Decision record:** research decided 2026-10-06 — see `PRODUCT.md`
  ("Article understanding for outfit recommendations"). Re-verify provider
  pricing at build time; only Google's was confirmed from an official
  pricing page.
- **Status 2026-10-14:** shipped via CI (`a8998ad`), live on the site —
  awaiting founder phone test. Implementation notes: cover photo is
  downscaled to ≤1024px client-side before the call (speed + cost); the
  suggested name only fills an empty name field (never clobbers typed
  text); out-of-order responses are discarded via request id; any AI
  failure hides the AI box and the upload proceeds exactly as before
  (on-device suggestions intact). The cached `ai` object is also shown
  read-only in the detail view so persistence is verifiable on-device.
  Pricing re-verified: live test used 2,515 tokens ≈ fractions of a cent.
- **Phone test 2026-10-14 (founder):** AI worked (white anime-tee described
  correctly), but two UI bugs: (1) AI box text invisible in dark mode
  (white-on-white — chip set a light bg without a text color); (2) the old
  on-device hint lingered after the AI suggestion rendered. Fixed same day
  (`a37d410`): explicit dark text on the chip; the AI render now hides the
  on-device hint and suppresses its narration (values still applied
  silently; hint remains the fallback while AI loads or on failure).

### BUG-1: Diagnose the upload bounce (S — diagnosis only) — PARKED 2026-10-11
- **Status:** Parked at the founder's call: it hasn't recurred since
  2026-10-05. If it recurs, the founder will report the details below and
  diagnosis resumes then. The card stays here so nothing is lost.
- **Problem:** 2 of 8 uploads on 2026-10-05 bounced "back to the home
  screen" mid-upload. Never diagnosed; we don't fix blind.
- **Founder input needed (part of the card):** were the 2 pieces saved or
  lost? Did the app close to the iPhone home screen, or just return to the
  Closet gallery?
- **In scope:** reproduce with large photos while the on-device model is
  loaded (prime suspect: iOS memory pressure); determine whether the item
  saves before the bounce; land on a cause, or a named suspect with
  evidence.
- **Out of scope:** the fix itself — it becomes its own cut once the cause
  is known.
- **Done looks like:** a written diagnosis (here or in `friction.md`) with
  cause + proposed fix card, or a "cannot reproduce, here's the evidence"
  close-out.

## Learning track (restored)

This project was always two-in-one: ship Closet *and* learn system design
(the goal's name says both). The old weekly sessions carried the learning;
when they retired, the learning fell off the radar — restored here, inside
the sprint loop instead of a separate cadence:

- **One concept per cut**, taught when the cut needs it, tracked in the
  founder's system-design learning log (met → used → owned).
- **PC-6's concept:** *client vs server — why secrets live server-side*
  (first met 2026-09-26, ADR-004). Building the proxy is the founder
  *using* it: the decision becomes the lesson.
- **PC-7's concept:** *sync vs async + caching* — why the description is
  computed once at upload and cached as text, not recomputed per chat.
- Format stays light: a 5-minute plain-English note per cut in chat,
  logged in LEARNING.md. Homework/quiz only when the founder asks —
  recovery weeks get reading, not assignments.

## Pull in if time
- **"Surprise me" shuffle (S):** one-tap random outfit suggestion per
  category. No backend needed — it survives even if the Blaze decision
  slips.

## Inbox triage (planning, 2026-10-11)
PM's top 3, per the planning ritual — founder yes/no at approval:
1. **Full auto-fill from photo (epic)** → PC-7 is its next slice and is
   already in this plan. No separate action.
2. **Outfit-intelligence ideas** (composer, vibe picks, anchor-piece,
   outfit ratings) → all of them reason through the stylist chat, which
   doesn't exist yet; the chat will reuse PC-6's proxy. Recommendation:
   hold for Sprint 3 planning, once pieces carry descriptions worth
   reasoning over.
3. **Visual workflow map (studio system)** → the studio is product zero and
   gets no sprints. Stays parked until it earns a build.

## Sprint 3 seeds (from 2026-10-14 design session)
- **PC-8: color palette + item data model v2** — design done
  (`DATA_MODEL.md`), backlog candidate. The data-model cut to take first:
  everything later (garment model, stylist chat) builds on it.
- **Garment-model revisit trigger** — in inbox; revisit once the
  conversational recommendation loop exists and can measure whether a
  richer multi-photo model produces better outfits.

## Founder decisions
1. **Approve this plan** — done 2026-10-11.
2. **Blaze:** enable billing on `closet-404e9` so PC-6/PC-7 can run? —
   **Approved 2026-10-11.** Founder confirms the card is on file. (For the
   record: at ~$0.0001 per item analysis, expected usage sits inside the
   free tier — the card is Firebase's requirement, not an expected charge.)
