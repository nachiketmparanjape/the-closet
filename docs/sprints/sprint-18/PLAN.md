# Sprint 18 — Design Foundation

_Founder pulled 2026-10-20 ("start the next sprint and include
UX-13 in it"). Design: `docs/proposals/REDESIGN-PROPOSAL.md`.
Batch, not timebox._

## Goal

Give the app a real design system before any more surface is
built on vibes: a living `docs/DESIGN.md` (tokens, components,
motion, states — each major choice with its *why* and the
alternatives considered), critiqued hard before the founder has
to judge it, then proven on one real screen.

**Founder's process ask (2026-10-20):** he doesn't come from
design and doesn't want his inexperience to be the weak link.
So Bramble plays critic as well as designer — multiple critique
rounds against the draft, fixes folded in, critique log kept in
this folder — and the finished doc explains every major choice
as *why this, what else existed, why not that*. His validation
then happens on an explained design, not on raw taste.

## Planning walk (2026-10-20, full inventory per the hard rule)

- **Backlog:** every card reviewed. Parked triggers checked —
  BUG-1 has not recurred (stays parked); PC-23's trigger ("deleted
  something I wanted back") has not fired (stays parked);
  PC-24/25/26 stay parked. Untriaged ideas are historical and
  largely absorbed (bulk upload, chat stylist — both long live);
  "view-aware descriptions" stays deferred per its own note.
- **UX-12 disposition:** its revisit trigger was "the polish
  settles" — the redesign is that event, and UX-14 already
  records that it subsumes the tutorial question. Recommend
  closing UX-12 into UX-14 at this walk (founder veto applies).
- **Inbox:** all entries triaged; two finds feed this sprint —
  the 2026-10-17 UI/UX audit research, and the 2026-10-14
  "TypeScript + native mobile optionality" long-term note, which
  is exactly UX-13's framework decision point.
- **Open GitHub issues (17):** #61 ("What should I wear?" cluster)
  is a design decision — it gets designed *inside* the design
  system during this batch rather than as another one-off.
  #63 (Sprint 15 fix buffer) stays open, untouched by this slate.
  Walk finding for a future walk: PC-19 (duplicate detection)
  looks partially landed via the PC-28 pHash dedup — needs the
  shipped-verification check before it's proposed again.
- **Slate logic:** the founder named UX-13; the batch stays
  focused on the design foundation. OBS-2 / PC-32 / PC-33 are
  deliberately *not* stuffed in — they pull next, against a
  design system that now exists.

## Cards

### 1. DESIGN-SYSTEM-1: `docs/DESIGN.md` v1 (M)

The living design spec: principles, tokens (type, color,
spacing, radius, elevation), the component kit, motion rules,
state patterns (loading / empty / error), accessibility floors,
and a Decisions section (choice → why → alternatives → why not).
Drafted from a real inventory of the current app, then put
through recorded critique rounds (see `DESIGN-CRITIQUES.md` in
this folder) with fixes folded into the doc before the founder
reads it. **This card is design only — no app code changes.**

### 2. DESIGN-GRID-1: Wardrobe grid as reference implementation (M)

Apply DESIGN.md to the wardrobe grid — the screen users live
in — as the system's proof. Behavior-preserving: same data, same
actions, new tokens/components/motion. Founder phone-verifies
per the standing gate; his read of the grid is the real
validation of the doc.
**Scope notes (founder, 2026-10-21):** the app shell comes with
this card — the grid lives inside it, so the bottom tab bar
(Stylist as action tab), the token pass, and the native-feel
basics (manifest, theme-color, touch physics, no floating
buttons; feedback moves into the account overlay) land here
rather than waiting for later screens. He also chose the
two-identity experiment: the grid ships a second time as a
static preview under one alternate token block ("Gallery" —
cool neutral, ink-blue accent, all-grotesque type) so identity
is judged on realistic content, per the D1 changeability note.

### 3. DESIGN-CHAT-1: Chat screen on the system (M) — pull after Card 2 validates

Chat is the second home screen and the stylist's stage (cards,
composer, pin/trip proposals all live here). Includes absorbing
issue #61's "What should I wear?" cluster as a designed
component instead of a one-off. Starts only once Card 2's
validation lands.

### 4. DESIGN-HOME-1: Today, a stylist-first home (toggle-gated) — in slate

Filed 2026-10-21 after the founder widened the design latitude
("don't be afraid to propose dramatic updates or complete
redesigns — doesn't have to be incremental"). The founder
steered it the same day: build it as a **parallel experience**
(Account toggle, default off) he can test on his phone, with
the design answering his two questions — new-user upload CTAs
and feature discoverability — and chat kept non-load-bearing
(his stated concern). Proposal v0.2 with three critique rounds
folded (`docs/proposals/TODAY-HOME-PROPOSAL.md`); **founder
validated the build 2026-10-21** ("Build the toggle-gated
Today"). It composes with Card 3 (shared proposal-card
components) rather than competing with it.

## Out of scope

- Framework rebuild — governed by the decision point in the
  redesign proposal (evaluate after the design doc validates and
  two screens are re-skinned; spike-decided). Not in this batch.
- Flow/behavior changes anywhere; onboarding build (UX-14) —
  its first-run screen is *designed* against this system later.
- Dark-mode implementation — tokens are specified dark-ready in
  Card 1; shipping dark is a separate call.

## Founder checkpoints

1. Read the explained DESIGN.md; object anywhere taste disagrees
   (the doc is built to be argued with).
2. Phone-verify the grid re-skin (Card 2) before chat starts.

## Amendment 2026-10-23 — Warm Editorial waves (founder-delegated)

The Combina study (PRODUCT.md research, 2026-10-23) ended with
the founder delegating design decisions to Bramble outright
("make all the decisions… until I'm happy with it"). DESIGN.md
§10 records the decisions (A1–A5). The remaining Sprint 18
work re-plans as waves; DESIGN-CHAT-1 folds in as W5.

- **W1 DESIGN-WARM-1: tokens + type voice (S)** — §10 token
  table in both themes, brass discipline, chat user bubble to
  ink, theme-color metas. Built + deployed 2026-10-23
  (release 1792790816577000; suite 256/256). Awaiting founder
  phone verdict — his "happy" is the gate, per the mandate.
- **W2 DESIGN-LOOK-1: named looks (M)** — stylist returns
  lookName + tagline; Today + outfit masthead (A3); radius
  pass (cards 18, sheets 24). Server + client. Built +
  deployed 2026-10-23 (askStylist updated; hosting release
  1792791186579000; suite 257/257). Names ride the main flow,
  both trip tools, and the save path (a saved outfit's name IS
  its look name). Awaiting founder phone verdict.
- **W3 DESIGN-NOTE-1: Behind-the-Look sheet (M)** — bento
  rationale over critique/reflection data (A4); one
  structured field added to the critique prompt.
- **W4 DESIGN-MASONRY-1: category-wall wardrobe entry (M)** —
  A5; hero per category (passed render preferred, photo
  fallback); item grid stays one level down.
- **W5 DESIGN-CHAT-1** — as originally carded, now on the
  finished §10 system.
