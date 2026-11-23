# Sprint 32 — Polish the thing people already have (PROPOSED)

- **Status:** APPROVED by the founder 2026-11-23 ("Approve it all — build
  Sprint 32"). Slate + backlog cleanup + aging dispositions all approved.
- **Theme:** polish + discoverability. Standing brief (2026-11-14, still
  live): "the goal is to make the app easy to use." Founder direction
  (2026-11-23): the app is reasonably feature-rich; the game now is
  making the existing experience polished, easy to use, and easy to
  discover. PC-49 shelved the same day.
- **Goal:** every card in this sprint makes something that already
  exists easier to find, tap, or understand. No new feature surfaces.

## The planning walk (2026-11-23, full inventory)

Walked per the standing rule: BACKLOG.md end to end (parked items +
trigger checks, untriaged ideas, open questions) → studio inbox → open
GitHub issues.

- **Closet BACKLOG.md (57 cards):** ~30 closed-but-listed (cleanup
  proposed below — verification against SHIPPED.md first, not executed
  at this walk). 12 built awaiting founder phone verification: PC-34,
  PC-36, PC-37, PC-35, NAMING-1, UX-15, PC-63, PC-65, PC-66, PC-67,
  PC-68, PC-70 (incl. all six Sprint 31 cards). Genuinely open: UX-14,
  UX-16, PC-55, PC-64, PC-69, PC-71, PC-72, PC-48 (trip — its home is
  a pre-Canada sprint), parked PC-23/24/25/26, shelved PC-49.
- **Fluencia:** 0 open cards. **One at a Time:** PC-O1, PC-O3, PC-O4.
  **Vocab Quiz:** PC-V1, PC-V3.
- **Inbox:** 9 OPEN at walk time (4 stale: studio import, outfit epic,
  mirror pilot, UX-audit approach; 4 founder-owned: Combina, Essembl
  APK, SAM 3, UX-audit; 2 unslop: re-check + round-2 findings).
- **GitHub issues (the-closet, open):** the Nov 5 cluster (#135 tap a
  suggested piece, #136 explicit Home destination, #137 garment photos
  — PR #140 addresses it, #138 reset daily state, #139 Today repeats
  recently worn outfits) + #141 chat attach consolidated picker +
  "Style around this" (Nov 15). #135 overlaps PC-64; #136 is a small
  nav discoverability fix.

**Trigger checks:**
- Outfit-as-first-class-object epic — **FIRED** at this walk: sliced
  into PC-73 (object + history), PC-74 (worn + ratings), PC-75 (manual
  builder), PC-76 (favorites/search/calendar). Backlog, not this sprint
  — new-feature work waits for the post-polish phase.
- Studio import bundle — **FIRED** at this walk: sliced into OAT PC-O5
  (AI task breakdown) + PC-O6 (calendar bridge), Fluencia PC-F4
  (Marathi) + PC-F5 (conversation mode), and Reset + studio starter kit
  as PARKED inbox ideas. The merge question was already decided (PC-F3,
  Nov 2).
- Mirror pilot — **verdict at this walk: KEEP.** The mirror works (77
  cards synced; it created PC-70/71/72). Follow-up: dedupe the
  double-mirrored issues in one-man-studio (UX-14, UX-12, BUG-1 appear
  twice).
- PC-48 (trip planning depth) — not fired. Canada trip is Jan 14–24;
  its natural home is a pre-Canada sprint.
- LayerUp inbox ideas ×3 — no fire (still pre-launch; no surface
  pressure). Stay in the inbox.

## The slate (6 cards)

1. **UX-14a — Demo wardrobe + greatest-hits-first (M).** Slice of
   UX-14's "cut the threshold" attack line: feel the value before
   paying the cost — a labeled demo wardrobe, ~10 favorites unlock
   picks. Design: `docs/proposals/ONBOARDING-PROPOSAL.md` (exists).
   This is the sprint's anchor: onboarding is the biggest
   discoverability lever.
2. **PC-64 — Tappable item chips (M).** Sprint 31 alternate. Names in
   stylist prose become objects: thumbnail + short name inline,
   tapping opens the item page.
3. **PC-69 — Outfit card actions (M).** Sprint 31 alternate. Cards stop
   being dead ends: tap a tile to open the item, Swap chips per piece,
   Warmer / More formal refinement chips.
4. **PC-71 — "Not for me" (M).** Sprint 31 alternate. The missing
   negative signal: quiet reason chips on outfit cards, stored on the
   message, riding future stylist context.
5. **PC-72 — Chat polish bundle (S).** Sprint 31 alternate. Context bar
   never cuts mid-word; prose stops repeating stock phrases; a
   double-send produces one message.
6. **UX-16 — Context-handoff audit (S).** A chat opened from a surface
   carries that surface's subject.

**Alternates:** #136 explicit Home destination (first — small nav
discoverability fix from the open issues), PC-55 Web Share Target
(second — intake ease, filed Oct 24).

## Constitution check

Pass. Every card is inside v1 scope (catalogue + conversational picks +
onboarding/discoverability); no non-goal features; PC-49 stays shelved;
PC-48 stays out (trip feature, pre-Canada home).

## Note the bottleneck

12 cards built await the founder's phone verification, including all six
Sprint 31 cards. This sprint adds no new feature surface and its builds
are small — but the verification queue is the bottleneck, and it needs
his phone time, not more builds.

## Walk decisions (for the founder's yes)

1. **Approve the slate above** — build Sprint 32.
2. **Approve the backlog cleanup** — remove the ~30 closed-but-listed
   cards from the Closet BACKLOG.md, each verified against SHIPPED.md
   first (curator proposal #1, Nov 22).
3. **Aging dispositions** (one line each, per the safeguard):
   - PC-O1 / PC-V1 (auto-deploy): KEEP — same verified fix pattern as
     Fluencia's PC-F1 (check Vercel Git connection + commit email);
     pull into the next non-Closet sprint.
   - PC-O3 ("why this task"): KEEP — discoverability for OAT's core
     view; next OAT sprint.
   - PC-O4 / PC-V3 (code-split): KEEP — performance polish, low
     priority; next non-Closet sprint.

## Filed at this walk (done, not proposals)

- PC-73..76 (outfit epic slices), PC-77..81 (unslop round-2 findings),
  PC-O5/O6, PC-F4/F5; Reset + starter kit as PARKED inbox ideas.
- The studio-import bundle, outfit epic, and mirror pilot inbox entries
  are DONE (sliced / verdict recorded). The UX-audit approach entry
  stays OPEN — founder decision (Nielsen-heuristics audit vs unslop
  rubric).

## Founder decisions still open (not this sprint)

Combina A/B fork (Option B recommended); Essembl APK adoption
candidates; SAM 3 prototype amendment verdict; UX-audit approach;
dark muted text (one step lighter?); dark primary inversion (keep or
restyle?). The last two came out of the unslop round-2 findings.

## Build results

- **UX-14a — demo wardrobe + greatest-hits-first.** Commit
  `22454e7` (2026-11-23). Design note
  `docs/sprints/sprint-32/UX-14A-DESIGN.md` (written before the cut;
  the proposal did not settle which items, how labeled, or where it
  lives). Built + deployed; CI Hosting deploy success (run
  45291641287); live site serves the new code; `askStylist`
  redeployed via `deploy-update.js`. Tests: 9 new, suite 538
  passing in `tests/` + 10 in `functions/`; `node --check` clean;
  doc-honesty exit 0. Founder phone verification pending — see
  phone paths below.
- **PC-64 — tappable item chips.** Not built yet.
- **PC-69 — outfit card actions.** Not built yet.
- **PC-71 — "Not for me".** Not built yet.
- **PC-72 — chat polish bundle.** Not built yet.
- **UX-16 — context-handoff audit.** Not built yet.

## Phone-test paths (founder — what still needs his phone)

Per card, exact paths to cover. Nothing below is verified until
his phone does it.

- **UX-14a:** (1) sign out / fresh guest — Today tab shows the
  "Start here" card with "Try the demo wardrobe first"; tap it —
  the chat opens labeled Demo with 10 sample pieces in the context
  bar. (2) Ask "casual dinner, 60°F" — a pick comes back from the
  sample pieces; the card says "Demo outfit" and has no Save
  button. (3) Tap "Add your own pieces" — demo exits into the
  capture flow. (4) With 4–9 real pieces, ask for a pick — the
  stylist works with what's there and says so honestly. (5) Reload
  mid-demo — the demo conversation is gone (in-memory only).
