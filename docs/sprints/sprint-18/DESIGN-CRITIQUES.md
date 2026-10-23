# DESIGN.md — critique log (Sprint 18, DESIGN-SYSTEM-1)

_Founder's process ask (2026-10-20): Bramble designs AND plays
critic, iterating before he has to judge — his inexperience should
never be the weak link. Three rounds were run against the v0
draft, each with a different lens. Every finding has a
disposition; "folded" means DESIGN.md changed because of it
(section cited). The doc the founder reads is the post-critique
version._

## Round 1 — Internal consistency + stack feasibility

1. **Floating buttons collide with the tab bar.** The current app
   floats a feedback pill at bottom-left; D4's bottom tab bar
   occupies exactly that space, and the draft silently kept both.
   → **Folded:** the system has *no* floating action buttons.
   Feedback becomes a row in the account overlay (§3 note).
2. **"One accent-filled button" had an unstated exception.**
   §4.1 makes primary buttons ink-filled; §4.6's proposal
   confirm is accent-filled. Drafted as a contradiction; it's
   actually the design's best idea (color = the AI is asking).
   → **Folded:** stated explicitly as the single sanctioned
   exception, in both sections.
3. **Display size had no scope limit.** Serif at 40px "for
   screen heroes" would creep onto interior screens and eat
   the content it frames. → **Folded:** Display is landing +
   empty states only; interior screens use Title (§2.2).
4. **Feasibility check on motion.** Shimmer skeletons, sheet
   rise, tab transitions: all plain CSS, no framework needed —
   spec holds. But `backdrop-filter` blur (tempting for the tab
   bar) is a low-end-phone perf trap. → **Folded:** §5 bans
   backdrop-filter in v1; the tab bar is a solid `--paper` fill.

## Round 2 — Does it serve this product's actual jobs?

1. **Principle 2 (morning-fast) indicts the nav itself.** The
   fastest morning path is "open app → see today's pick," but
   v1 keeps Wardrobe as home and the pick flow a tap away.
   Making a "Today" home is a *flow* change — outside a
   behavior-preserving re-skin, and a founder call, not a
   designer's smuggle. → **Disposition: flagged, not fixed.**
   Recorded as DESIGN.md §9 open question for the founder.
2. **4:5 cover-cropped tiles can amputate long garments**
   (coats, dresses) in the grid. → **Accepted with guardrail:**
   grid keeps cover (every photo-led marketplace does; the tile
   is for recognition, not inspection); item detail uses
   `object-fit: contain` on `--paper-soft` so the full garment
   always survives somewhere (§3, folded wording).
3. **Badge collision audit.** Score badge (top-left, §4.2/4.4)
   vs shop status chip (top-right of photo, §4.4): opposite
   corners, no collision. Pin chip + weather chip share the
   header chip-row (§3) — one pattern, verified consistent.
   → **Pass, no change.**
4. **Proposal card inside chat bubbles.** Chat width on wide
   screens could squeeze the card's footer buttons. →
   **Folded:** §4.6 specifies full bubble width; on narrow
   widths the footer stacks (Save above Dismiss), never wraps
   mid-label.

## Round 3 — Accessibility + the modern-reference bar

1. **A contrast failure hiding in a token pair.** `--muted`
   (#666963) on `--paper-soft` (#ebe9e3) is ≈4.4:1 — under the
   4.5 floor for the 13px metadata text cards are full of.
   → **Folded:** new `--muted-strong` token for small text on
   soft surfaces (§2.1, §6). This is exactly the class of bug
   that ships silently without a system.
2. **Serif at small sizes is mush.** The draft let Title
   styles drift downscale. → **Folded:** hard floor — serif
   never below 19px (§2.2, §6).
3. **Text-only tab labels vs the modern reference.** Instagram/
   Airbnb tabs are icon + label; text-only risks reading
   sparse. → **Accepted for v1, with a revisit trigger:** an
   icon set is an asset + consistency project of its own, and
   icon-only-ism already burned this product once (the 🎲
   lesson, 2026-10-18). Text labels are honest and
   unambiguous; revisit when an icon set arrives (likely with
   the framework decision). Noted in §4.1.
4. **Reduced motion was unspecified.** → **Folded:** §5
   collapses all motion + shimmer under
   `prefers-reduced-motion`.
5. **Focus visibility was unspecified.** → **Folded:** §6 —
   focus always visible via the §4.8 accent outline pattern.
6. **Dark-mode badge check.** Score badge uses
   `--black`/`--on-black`, which invert correctly under the
   existing dark token mapping. → **Pass, no change.**

## What the rounds did NOT catch (honest residue)

- No real user has seen any of this. The grid re-skin (Card 2)
  on the founder's phone is the first true test; the doc
  expects amendments from it and says so (§8).
- Type *sizes* are reasoned, not tested — 15.5px body is a
  judgment call between density and readability that only
  real reading on a real phone settles.
- The "Today home" question (round 2, finding 1) is the
  largest known unknown and it is deliberately the founder's.

## v2 amendment critique (2026-10-23, Bramble under delegated authority)

Three passes over the Warm Editorial amendment before W1 built:
(1) Contrast — brass on ivory fails small text; fixed by the
accent-dark rule (§10 A1) and moving the chat user bubble to
ink. (2) Register drift — script accents and all-italic
rationale both skew feminine/fatiguing; rejected in A2 with
reasons recorded. (3) Feasibility honesty — category masonry
presumes cutouts that don't exist yet (PC-34 pending); A5
specs the photo fallback instead of pretending, and heroes
upgrade automatically as renders pass the gate. LookName
letterspacing capped at Title size so mastheads don't shout.
