# Proposal — Today: a stylist-first home

v0.2, 2026-10-21. v0.1 sketched the inversion; the founder
steered it the same day: build it as a **parallel experience he
can test on his phone**, with two design questions to answer —
(Q1) the new-user experience, where upload CTAs matter, and
(Q2) discoverability of everything else. His one concern —
chat isn't fully fleshed out, so the first run may feel buggy —
is answered structurally below (§2). This version folds in
three critique rounds (§6) with their fixes. **Status: design
complete, awaiting founder validation. Nothing builds before
that.**

## 1. The inversion (unchanged from v0.1)

Today the app opens on the **catalogue** — the filing cabinet —
and the stylist, the product's actual promise, is a button in
the bar. **Invert it:** the app opens on **Today** — a serif
greeting, the day's weather chip, and **today's outfit
proposal already waiting** (pieces composed as an outfit card,
the stylist's one-line why, *Wear this · Another · Ask the
stylist*), followed by the day's thread: yesterday's outfit to
rate, a trip countdown when one is near, the catalogue one tap
away, unchanged. Why it's the lever: time-to-first-value
becomes the first second of every open; the wear→rate loop
(wear events still 0) gets a front door at the moment of
getting dressed; and "feeling" — the founder's own redesign
criterion — is the difference between storage you maintain and
a stylist you open.

## 2. The parallel experience (founder's mechanism)

- **Account toggle, default off:** "Preview the new Today
  home" in the account overlay. Off = the current app, byte
  for byte. On = cold-open lands on Today. Stored per device
  for the test phase (his phone is the test device); a public
  rollout would move it server-side — out of scope here.
- **Real machinery, no mock:** Today runs the actual proposal
  path (the composer/`askStylist` machinery from Sprint 14).
  The preview-fidelity rule applies to ourselves: a fake Today
  would test nothing.
- **Chat is an escape hatch, never load-bearing** (his
  concern, answered): *Wear this* and *Another* work entirely
  without chat — they call the proposal machinery directly.
  *Ask the stylist* opens the existing chat as-is, bugs and
  all, clearly a door out rather than the room itself. If
  chat's roughness sinks the test, it sinks only that door.
- **Failure degrades honestly:** if the proposal call errors,
  Today renders the greeting, a one-line "couldn't compose
  today's pick" with a retry, and the day's thread — never an
  error wall as a home screen.

## 3. Q1 — the new user: graded empty states

Today's content scales with the wardrobe, in three grades:

- **Zero pieces — Today is an onboarding surface.** One
  dominant upload CTA ("Photograph your first pieces"), and
  beneath it a **clearly labeled sample proposal** ("Sample —
  what your mornings could look like," rendered from demo
  pieces, never mixed with real data) so the value is visible
  before any cost is paid. The PC-34 already-extracted import
  ("bring your wardrobe from Google Photos") becomes this
  grade's accelerator CTA when that research lands.
- **Below threshold — the CTA stays, honestly.** The proposal
  slot shows progress instead of a fake pick: "4 pieces in —
  add a few more and I can dress you" (threshold = enough to
  compose a complete outfit; the exact count is a full-design
  detail, ~greatest-hits territory from UX-14). Upload stays
  one tap from the proposal slot itself, not buried in the
  Wardrobe tab.
- **At/above threshold — normal Today.** Upload recedes to the
  Wardrobe header, where it already lives.

Rule across grades: never fake a proposal from too little, and
never let an empty wardrobe make the home feel broken — an
honest invitation beats a hollow screen.

## 4. Q2 — discoverability: nothing moves, everything gets a door

- **The tab bar stays exactly as-is** — same four tabs plus
  the Stylist pill, always visible. Zero relearning; the
  features he named (Outfits, Trips, Shop list, Wardrobe) sit
  in the same labeled places as today.
- **Returning home:** with the toggle on, the topline gains a
  tappable serif **"Closet"** wordmark at the left (the native
  logo-goes-home pattern) — Today is reachable from any view
  without touching the tab bar's layout. (Critique round 3
  rejected the six-tab alternative: it breaks the
  unchanged-bar guarantee for zero gain.)
- **The day's thread is a set of doors, not a feed.** Each
  card deep-links in context: yesterday's outfit → Outfits
  (rate it there or inline), trip countdown → that trip,
  a saved shop check → Shop list, "pieces you haven't worn"
  → Wardrobe filtered. Rule: **every area with content gets
  at least one contextual doorway on Today.**
- **The floor:** when the thread is thin (new users, quiet
  days), an **Explore row** appears — four labeled tiles, one
  per area with a one-line descriptor ("Outfits — looks you've
  saved and worn"). Day one can never strand a user on a
  pretty dead end.
- **Feature parity** (critique round 1's checklist): Add a
  piece → Wardrobe header + Today's upload CTAs; Bulk add →
  Wardrobe header; Shop check → Wardrobe header + Shop list
  doorway; Pick an outfit → Today's proposal *is* that action,
  with Ask the stylist beside it. Nothing reachable today
  becomes unreachable.

## 5. The day's mechanics

- **One proposal a day, cached.** Generated on the day's
  first open, held for the day; *Another* walks the alternates
  the same machinery already returns. This bounds AI cost to
  ~one call per user per day and keeps cold-open honest:
  **Today renders instantly** (greeting, thread, cached state)
  and the proposal streams into its slot with a "composing"
  skeleton — the home never blocks on the model.
- **Wear this closes the loop:** saves the outfit and logs
  the wear through the existing outfit machinery; tomorrow's
  Today carries it as the rate card. Another first-class
  action, not a side effect.
- The proposal is weather- and pin-aware through the same
  context the stylist already uses — no second brain.

## 6. Critique rounds (run 2026-10-21, fixes folded above)

**Round 1 — feasibility & machinery.** Cold-open AI latency
would make the home feel broken → instant render + streamed
proposal slot + daily caching (§5). Feature-parity audit
caught Bulk add / Shop check orphaning → parity rule (§4).
Wear-this reusing the outfit save path, not a parallel one.

**Round 2 — the empty states (Q1 stress test).** A fake or
hollow Today for new users would read as a bug, not an
invitation → graded states, honest progress, labeled sample
(§3). Also: the sample proposal must be visually
distinguishable as a sample — label in the card, not a
footnote.

**Round 3 — discoverability & IA (Q2 stress test).** The
six-tab bar rejected (breaks the unchanged-bar guarantee);
the wordmark home affordance adopted instead (§4). Thread
cards must deep-link *in context* (the trip card opens that
trip, not the Trips list) or the doors teach nothing. Explore
row exists precisely for the days the thread can't.

## 7. What validates next

Founder verdict on this design → build the toggle-gated Today
as a Sprint 18 candidate card (DESIGN-HOME-1), sized at build
time, tested on his phone across real mornings. Exit criteria
for the experiment: his call after living with it — keep
(default-on candidate), iterate, or kill — with the toggle
making all three cheap.
