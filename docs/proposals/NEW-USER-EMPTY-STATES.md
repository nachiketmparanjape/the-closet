# New-user empty states — every tab, two tiers (PC-53)

## What this is

What a brand-new user sees on each tab, and what a user with a
few pieces sees, until the wardrobe can actually dress them.
One system, derived from counts — nothing stored, nothing to
dismiss forever; the moment the wardrobe crosses the threshold,
all of it is simply gone.

Founder direction (2026-10-24): users with zero things get the
intro prompt on ALL screens ("where to start?"); users with few
things get an "add more to improve your experience" treatment —
that tier's design delegated to Bramble. This is that design.

## Words we use

- **Tier 0 (empty):** the account has 0 pieces.
- **Tier 1 (few):** 1+ pieces but below the pick threshold.
- **The threshold:** the one already shipped on Today —
  `todayThresholdMet()`: at least 4 pieces including a top and
  a bottom. It is the honest functional minimum (one wearable
  outfit), not a vanity number.
- **Intro card:** a card at the top of a tab saying what this
  tab is for and offering the one next action.

## The design

### Tier 0 — intro card on every tab

Today and Wardrobe already comply (Today's Start-here card +
labeled sample pick; the Wardrobe hanger empty state). The
other three tabs today show only a one-line hint. They get a
real card each, same shape as Today's: eyebrow, two plain
sentences, one primary action, one quiet link where one exists.

- **Outfits:** "Outfits are combinations of your own pieces.
  Add a few pieces first — then the stylist can dress you, and
  the looks you save live here." Action: **Add your first
  pieces**. (No sample strip: Today carries the sample; a
  second fake here teaches nothing new.)
- **Shop:** "Before you buy something, check it against your
  wardrobe and get a straight verdict. Checks work right away —
  and get sharper the more of your wardrobe is in." Action:
  **Check an item** (opens the shop-check sheet; honest at 0
  pieces because the sheet is the product's front door too).
  This replaces the stale one-liner ("tap Save" — checks have
  auto-saved since 2026-10-24).
- **Trips:** "Trips build a packing list from your wardrobe,
  tuned to the weather where you're going. Going somewhere?"
  Action: **New trip** (creating one at 0 pieces is allowed;
  its packing list simply starts empty).
- **Stylist:** the chat empty state already teaches the model;
  at tier 0 it gains one line — "I dress you from your
  wardrobe; add a few pieces and I can start." No card.

### Tier 1 — one slim banner, naming the gap

Today already has the progress card. Extend the SAME component
(a slim banner, not a hero) to the top of **Wardrobe** and
**Outfits**:

- The copy names the *specific* gap, computed from the
  wardrobe, never a bare count: "3 pieces in. Add a bottom and
  morning picks unlock." / "Tops and bottoms covered — one more
  piece and picks begin." The gap logic reads the same
  threshold: missing top → say top; missing bottom → say
  bottom; categories covered but under 4 → say the count left.
- Action on the banner: **Add pieces** — the single capture
  door, as everywhere (consistency rule).
- **Shop and Trips get no tier-1 banner** (deliberate): both
  work properly with a small wardrobe, and a banner on every
  tab trains the eye to ignore all of them. Two banners max.

### Graduation

Crossing the threshold removes every tier-0 card and tier-1
banner on the next render. No flag, no "don't show again" —
the state is the wardrobe itself. Variety nudges beyond the
threshold already exist (Today thread cards: unworn pieces,
shop decisions waiting) and stay the only growth prompts.

## Alternatives considered

- **A higher bar (10 pieces = "ready"):** rejected as the
  intro gate — it would keep nagging users who already get
  real picks. Variety has its own, softer surfaces.
- **One global banner above all tabs:** rejected — it can't
  say what each tab is for, which is the tier-0 job; and a
  permanent chrome element is easier to resent than per-tab
  cards that graduate away.
- **A first-run wizard / carousel:** rejected (standing
  direction: time-to-first-pick is the metric; the tabs
  themselves are the tutorial — each empty tab teaches its
  own job at the moment of curiosity).

## Acceptance

- Fresh account: Today, Wardrobe, Outfits, Shop, Trips each
  lead with their intro treatment; no tab is a blank list
  with a one-line hint.
- 2 pieces (tops only): Today progress card + Wardrobe and
  Outfits banners all name the missing bottom.
- Threshold crossed: no intro cards or banners anywhere.
- All CTAs open the single capture door (or the named
  surface: shop sheet, trip form).

## Code pointers (2026-10-24)

- `public/index.html`: `todayZeroCard()`, `todayProgressCard()`,
  `todayThresholdMet()` (the threshold), `#emptyState`
  (Wardrobe), `#outfitsHint`, `#tripsHint`,
  `renderShopList()`'s empty branch (the stale line).
