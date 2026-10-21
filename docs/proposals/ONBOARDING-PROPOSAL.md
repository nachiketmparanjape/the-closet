# Onboarding — the catalogue problem — Proposal

_Founder 2026-10-20: "How to get people to onboard is a really
important question — absolutely the biggest hurdle for our
concept. After someone's wardrobe is already in there, that's
when this app is extremely useful and seamless. Getting people
to onboard is one of the biggest problems we have to solve in
the long run." This proposal frames the problem and the attack
lines. It is exploration, not a build plan: each line becomes
its own sized cut at a planning walk._

## The problem, stated precisely

The product's cost is front-loaded and its value is back-loaded:

- **Cost:** photographing and cataloguing a wardrobe — tens of
  items, one by one, before the app can do anything.
- **Value:** outfit picks, packing plans, shop checks — all of
  which only get good once a real wardrobe exists.

So the metric that matters is **time-to-first-value**: the
elapsed effort from signup to the first outfit pick the user
thinks is genuinely good. Every design choice below either cuts
the cost per item, cuts the number of items value requires, or
sells the value before the cost is fully paid. Funnel to watch:
signup → first item → threshold items → first pick → second-day
return. The leak will be somewhere in the middle; measure before
optimizing blindly.

## Attack line 1 — cut the cost of cataloguing

- **Closet-dump flow.** Batch capture already exists in pieces
  (bulk upload, AI describe, up to 4 photos per item). The cut:
  a dedicated first-run mode — shoot everything in a pile of
  photos, AI describes all of it, and the user's only job is a
  fast confirm/fix queue. Reviewing is minutes; typing is the
  friction, so typing goes away.
- **Capture in moments that already exist.** Packing for a trip
  (the user is handling every item anyway — trips are the
  natural forcing function this app already owns), laundry day,
  seasonal rotation. Onboarding copy and trip flows can point at
  these moments instead of asking for a dedicated catalogue
  session nobody schedules.
- **Worn-today capture.** Photograph what you're wearing; the
  outfit-parse flow already splits a worn outfit into items.
  One photo a day builds a real wardrobe in roughly two weeks
  with zero dedicated effort — and every capture is
  simultaneously a wear log, which is the loop the product has
  always wanted to close (recommend → wear → rate → learn).
- **Already-extracted imports** (founder addendum, 2026-10-21).
  He reports Google Photos (Android) auto-collects his clothes
  from photos of him wearing them. If users can export those,
  "bring your wardrobe from Google Photos" is the cheapest
  catalogue bootstrap that exists — the photos arrive pre-found,
  possibly pre-extracted. Unverified: what the feature is and
  what export looks like is research question (2) of PC-34;
  if it pans out, this becomes the first-run's front door.
  **Founder-verified 2026-10-21:** export works — the
  collection's images save to the camera roll and upload into
  Closet cleanly, arriving as clean cutouts. PC-35 files the
  beginner guide that teaches this path (plus photograph and
  bulk) from the empty states.

## Attack line 2 — cut the threshold for value

- **Greatest hits first.** Don't ask for the wardrobe; ask for
  ~10 favorites — the pieces actually worn. The stylist works
  with a partial catalogue and says so honestly ("with more of
  your wardrobe I can do more"). First pick at 10 items, not 60.
  (Exact number is an open question — validate against stylist
  quality, not vibes.)
- **Feel the magic before paying the cost.** A clearly-labeled
  demo wardrobe the new user can ask for picks, packing and shop
  checks against — then "make it yours" swaps in their pieces
  progressively. The concept sells itself in 60 seconds instead
  of being explained. Risk: a demo that feels fake poisons the
  well; it must be obviously a demo and obviously good.

## Attack line 3 — let the catalogue grow itself

- **Chat-driven additions.** The stylist already notices
  mentioned-but-missing items; with pins/threads in place it can
  offer a one-tap add ("you mentioned a denim jacket — add it?")
  in the moment, capped so it never becomes nagging. PC-33's
  steering pattern (propose, confirm, once per conversation) is
  the template.
- **Gap-driven prompts.** When a pick fails for a missing
  category ("I'd have built this around a white sneaker — own
  one?"), that's the highest-signal add prompt that exists: the
  user just felt the absence.

## Relationships

- **Redesign proposal:** the first-run experience is a screen of
  the redesign and gets the design system from day one; there is
  no separate tutorial chrome. This **subsumes UX-12** (the
  parked first-run tutorial question): its revisit trigger was
  "the polish settles" — the redesign is that event. Disposition
  of UX-12 (close into this) happens at the planning walk.
- **PC-33 (trip steering):** same propose-and-confirm pattern,
  and trips are attack line 1's best capture moment — packing
  a suitcase is cataloguing with a deadline and a reason.
- **Sprint 4 loop (wear → rate → reflect):** worn-today capture
  is the first onboarding mechanic that feeds the loop from
  day one instead of asking for a separate logging habit later.

## Risks / honest notes

- **AI describe quality is the trust gate.** A confirm queue
  full of wrong guesses teaches the user the app is sloppy
  before it ever gets to be smart. The confirm step isn't a
  courtesy; it's the product's first impression of competence.
- **Prompts are a budget.** Chat adds + gap prompts + steering
  cards can stack into an app that feels needy. One proposal
  per conversation, shared across all of them, or don't ship
  line 3.
- **Demo wardrobe is a real product surface** (content, upkeep)
  if built — size it honestly at planning, or cut it and let
  greatest-hits carry line 2 alone.

## Open questions (for the planning walk)

1. Greatest-hits threshold: 10 vs 15 items — decide from a
   stylist-quality test on small catalogues, run as research
   before the cut is sized.
2. Demo wardrobe: build, or skip? (Recommendation: build the
   cheapest honest version — one curated closet, read-only
   picks — and measure whether it converts to first-item adds.)
3. Does worn-today become an explicit daily ritual the app
   asks for (with the reset system's nudge machinery as the
   pattern), or a passive option inside the composer?
4. Which single attack line leads? (Recommendation: line 1's
   closet-dump confirm queue — it cuts the cost for *every*
   future user, including the ones greatest-hits framing
   doesn't reach.)
