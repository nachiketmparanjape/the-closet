# Blaze decision packet — Closet (closet-404e9)

Prepared 2026-10-11 (Sun evening) for the one founder decision gating
Sprint 2's PC-6/PC-7. Researched against Firebase / Google Cloud docs
the same evening; sources at the bottom.

## The decision, in one line

Enable Blaze on `closet-404e9`, then immediately set a **$5/month spend
cap on Cloud Run functions** — so the card-on-file Firebase requires is
fenced, not open-ended. Total founder time: ~5 minutes, desk or couch.

## Why the exposure is smaller than it sounds

- Cloud Functions (what PC-6 deploys) carries a monthly no-cost tier:
  first 2M invocations, 400k GB-sec, 200k CPU-sec, 5 GB egress free.
  Closet's expected load is a handful of uploads a week — orders of
  magnitude inside that tier. The ~$0.0001/item figure in the sprint
  plan is the vision-model call, not Functions.
- Spend cap budgets **do** cover Cloud Run functions
  (`cloudfunctions.googleapis.com`): alerts fire at 50/80/100%, and at
  100% of the cap, new function usage is automatically paused for the
  rest of the month. The cap can be lifted manually, and resets on the
  1st. The Gemini API is also spend-cap eligible if PC-6 ends up
  calling it.
- What a spend cap does **not** cover: Firestore / Storage / Hosting
  paid tiers. At single-user catalogue scale those stay inside the
  no-cost quotas carried over from Spark; an alerts-only project budget
  (step 3, optional) gives visibility there.
- Reversible: unlinking the Cloud Billing account downgrades the
  project back to Spark. Data and storage stay intact; deployed
  functions stop working, which is the only real cost of saying no
  later.

## Steps (founder, in order)

1. Firebase console → project `closet-404e9` → **Usage and billing** →
   upgrade to **Blaze** → link (or create) a Cloud Billing account and
   add the card.
2. Google Cloud console → **Budgets & alerts** → **Create budget** →
   choose **Spend cap enforcement** → scope: single project
   `closet-404e9`, single service **Cloud Run functions** → amount
   **$5 / month** → finish. (Alerts at 50/80/100% are automatic.)
3. Optional, same screen: a second, alerts-only budget for the whole
   project at $10/month, for Firestore/Storage/Hosting visibility.

## Timing options

- **Monday Oct 12**, in a gap (Titan call ends 11:30 AM; prep nudge is
  7:14 PM) — then PC-6 can be built the moment Sprint 2 opens Thu
  Oct 15, during recovery week, with no waiting on a founder action.
- **Post-op, from the couch** — the sprint plan already sizes this as a
  couch task and every cut rolls guilt-free; BUG-1 + the shuffle are
  unblocked either way, so nothing stalls if Blaze waits.

## Sources (checked 2026-10-11)

- Firebase FAQ — spend caps for Cloud Functions, no-cost quotas carry
  over from Spark, unlinking billing downgrades to Spark, Functions
  no-cost tier (2M invocations etc.):
  https://firebase.google.com/support/faq
- Google Cloud Billing — how spend cap budgets work (50/80/100%
  alerts, automatic pause at 100%, manual lift, monthly reset,
  eligible services incl. Cloud Run functions and Gemini API):
  https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- Firebase — avoid surprise bills (budget setup path via Usage and
  billing → Details & settings):
  https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
