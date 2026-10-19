# Sprint 14 — approved 2026-10-18 (founder: "looks good" + feedback)

**Theme:** the morning loop, grown up + finishing PC-13. Planned via the
full-inventory walk (playbook hard rule); PC-13's partial shipment caught
and split during the walk.

## Cuts

### 1. Outfit composer — "Dress me today" (M)
Design: `COMPOSER-DESIGN.md`. One-tap morning pick: occasion chips +
WX-1 weather + vibe profile → one outfit + 2 alternates, reusing the
existing `askStylist` callable (client orchestration, no new function).
**Built 2026-10-18 with the recommended defaults** (founder green-lit
the sprint without overriding): hero placement, Work/Casual/Dinner
out/Workout + none chips, main pick + "show another option" up to 2
alternates (previousPick iteration), same saveable card component as
chat, alternates carry the model's one-line reasoning as a caption.

### 2. PC-13 (remaining): wear logging in the photo-parse flow (S)
"Save & log as worn today" in the photo-parse confirmation — one tap
instead of photo → save → open outfit → "I wore this". Spec is in this
plan; no separate design doc (small, no open questions).

### 3. "What should I wear?" cluster (S)
Outfits tab: three labeled buttons — **Dress me today** (composer),
**Rewear something** (weighted-random saved outfit, weight = days since
worn, never-worn = 365), **Surprise me** (chat, exploration-leaning
prompt, auto-sent). Founder design call 2026-10-18: icon-only dice
retired (ambiguous), intent labeled before the tap; hero keeps its
"Dress me today" as the front-door entry. Needs founder phone test.

## Needs-founder (not builds)
- PC-29 Trips: validated 2026-10-18 — Sprint 15 candidate, ready for scoping.
- Sprint 4 loop: still 0 wear events — the composer + photo wear logging
  are built to fix exactly this; the founder still has to wear things.

## Parked (walk verified — all genuinely unstarted)
BUG-1, PC-23, UX-12, PC-24/25/26, personalization exploration,
garment-model multi-photo.
