# DESIGN.md — The Closet design system

_Living spec (the PERSONALIZATION.md pattern: design lives here,
cut records live in sprint folders). v1 drafted in Sprint 18
(card DESIGN-SYSTEM-1) from a full inventory of the current app,
then put through three recorded critique rounds before founder
review — log in `docs/sprints/sprint-18/DESIGN-CRITIQUES.md`,
with the fixes folded into this version. **Founder approved the
direction 2026-10-21** ("let's go with this") — which also
satisfies condition (a) of the UX-13 framework decision point;
condition (b) is two screens re-skinned on this system._

_Founder latitude, widened 2026-10-21: "Don't be afraid to
propose dramatic updates or complete redesigns — doesn't have
to be incremental updates." Bold structural proposals are
in-scope for this doc and its proposals folder; they still
validate before they build._

**How this doc is used:** new or re-skinned UI is built from the
tokens and components here — nothing freehand. A deviation is a
doc edit first (argue it here, in the open), never a quiet
one-off in code. Decisions are numbered (D1…) with the *why* and
the alternatives, so a future session — human or agent — can
re-litigate intelligently instead of re-inventing.

## 0. Where we start (inventory, 2026-10-20)

Honest state of `public/index.html` today:

- Tokens exist embryonically: a `:root` palette in warm paper
  tones (bg `#f5f4f0`, ink `#171917`, raspberry accent `#b8425b`,
  sage secondary) with a full dark mapping under
  `prefers-color-scheme`. Two self-hosted families: "Closet
  Serif" (display) + "Closet Sans" (UI).
- No scales: border radii in the wild are 4 / 5 / 6 / 10 / 14 /
  99 / 999px; spacing is per-component improvisation.
- No component kit: at least five different chip implementations
  (weather, trip, pin, palette, chat-reference), card styles
  re-derived per feature (outfit, trip, shop), one stray
  hardcoded color (`#e58db1` in the trip chip) bypassing tokens.
- Semantics leak: hint text is accent-colored by default, so the
  brand color does non-semantic work everywhere.
- Good bones to keep: bottom sheets already exist and feel
  right; primary buttons already meet the 44px touch floor;
  one strong soft shadow token; the serif/sans pairing is a
  genuine identity most products never get.

## 1. Principles

1. **Photo-first.** The clothes are the content; the interface
   is the frame. Chrome recedes — neutral surfaces, restrained
   color — so a rack of real photos looks like a lookbook, not a
   database.
2. **Morning-fast.** The core job happens half-awake, one
   thumb, in under 30 seconds. Every screen answers "how many
   taps to the thing I came for?" and the answer is small.
3. **Editorial, not dashboard.** Gallery-paper tones, serif
   moments, generous whitespace. This is a fashion product; it
   should read like a magazine that happens to be software.
4. **One component per job.** If two features need a card, they
   use *the* card. Consistency is what "designed" means to a
   user's eye.
5. **Quiet AI.** AI surfaces (picks, proposals, scores) wear
   the product's clothes, not a chatbot skin. The one exception
   is the proposal pattern (§4.6), which is deliberately
   recognizable — trust needs a consistent shape.
6. **Spec only what the stack can do.** This system is
   implementable in the current single-file vanilla client.
   Anything needing a framework waits for the UX-13 framework
   decision point.

## 2. Tokens

### 2.1 Color (roles, not hexes)

Keep the existing identity (D1). Code refers to roles only; the
hexes live in one `:root` block (light) + one dark mapping.
**Superseded 2026-10-23 by §10 (Warm Editorial)** — the table
below is the v1 Gallery identity, kept for the record; §10's
table is the live one.

| Role | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#edf0f2` | `#0e1218` | app background (cool paper) |
| `--paper` | `#ffffff` | `#171c24` | cards, sheets, raised surfaces |
| `--paper-soft` | `#e2e7ec` | `#1f2631` | inset surfaces, card fills |
| `--ink` | `#10141a` | `#eef1f5` | primary text, primary buttons |
| `--muted` | `#5b6572` | `#9aa5b1` | secondary text on `--bg`/`--paper` |
| `--muted-strong` | `#49525e` | `#c3ccd6` | small text on `--paper-soft` (see §6) |
| `--faint` | `#6b7684` | `#7d8794` | tertiary text, never body copy |
| `--line` | `#d3dae1` | `#2a313b` | hairline borders |
| `--line-strong` | `#aeb9c4` | `#3d4654` | interactive borders |
| `--accent` | `#2456c8` | `#6f9bff` | THE action/emphasis color (D7) |
| `--accent-dark` | `#1a41a0` | `#9dbdff` | accent text, pressed states |
| `--accent-soft` | `#dde6fa` | `#1d2a47` | accent-tinted fills |
| `--sage` / `--sage-ink` | `#dde5da` / `#3d5238` | `#22302a` / `#b7d3c0` | calm positive (fits, success) |
| `--danger` | `#b3263e` | `#ff8296` | destructive, errors |
| `--black` / `--on-black` | `#10141a` / `#f5f7fa` | `#eef1f5` / `#10141a` | score badges, inverted chips |

Rules: accent means *act or attend* — nothing else wears it
(D7). No hardcoded colors anywhere; a color that isn't a token
doesn't merge. Garment colors in photos are content, never UI.

### 2.2 Type

Two families stay (D2): **Closet Serif** for moments,
**Closet Sans** for work.

| Style | Spec | Used for |
|---|---|---|
| Display | Serif, 40px / 1.0, −0.03em | landing hero, empty-state headlines — never interior screens |
| Title | Serif, 27px / 1.1 | screen titles, outfit names |
| Score | Serif, 56px / 1.0 | shop-check + confidence numerals |
| Heading | Sans, 19px / 600 | card titles, section heads |
| Body | Sans, 15.5px / 1.55 | default text, chat |
| Small | Sans, 13px | metadata, hints, reasons |
| Eyebrow | Sans, 12px / 700, +0.04em, uppercase | sheet titles, card eyebrows |

Floors: serif never below 19px (it turns to mush); no text
below 12px; body copy never in `--faint`.

### 2.3 Spacing + radius (the rhythm section, D11)

- Spacing scale (4pt base): **4 · 8 · 12 · 16 · 24 · 32 · 48**.
  Screen padding 16 (compact) / 24 (wide). Card padding 16.
  Section gap 24. If a value isn't on the scale, the layout is
  wrong, not the scale.
- Radius scale: **8** (buttons, inputs, small media) · **14**
  (cards, proposal cards) · **20** (sheets, top corners) ·
  **full** (chips, badges, pills). Photos inside a card take
  the card radius minus 4. The 4/5/6px one-offs are retired.

### 2.4 Elevation

Two levels, that's all (D6): **flat** — cards sit on `--bg`
with a `--line` border or a `--paper-soft` fill, no shadow;
**floating** — sheets, overlays, the one existing `--shadow`
(`0 18px 50px rgba(26,29,25,.08)`), reserved for things that
physically float above the page.

## 3. Layout + navigation

- Content column max-width 1120px, centered; interior screens
  are single-column flows inside it.
- **Primary nav: a bottom tab bar** (D4) — Wardrobe · Outfits ·
  Stylist · Trips · Shop list. Five equal tabs, text labels
  (§4.1 note), active tab in `--ink`, inactive `--muted`, top
  hairline border, safe-area padding. Account lives top-right
  (avatar/initial button → the existing account overlay).
  There are **no floating action buttons** in this system — the
  tab bar owns the bottom edge; feedback lives as a row inside
  the account overlay (Critiques, round 1). On wide screens
  (≥900px) the tab cluster caps at 780px, centered — five tabs
  stretched across a laptop read as scattered, not native
  (fix buffer, 2026-10-21).
- Wardrobe grid (D3): 2 columns compact / 3–4 wide, gap 12,
  photo tiles at **4:5** (`object-fit: cover`). Item detail
  shows the full garment: `object-fit: contain`, max-height
  320px, on a `--paper-soft` backdrop — the grid may crop for
  recognition, the detail view never amputates (Critiques,
  round 2).
- The header is context, not chrome: screen title left;
  weather chip and (general context only) the pin chip right —
  one shared *chip row* pattern so context looks identical
  everywhere it appears.
- The Stylist is the tab bar's fifth element — an **action
  tab**, not a view: it opens the chat overlay (chat is a
  conversation layer over any view, not a place). It is a
  **filled accent pill**, the one loud element in the bar —
  amended 2026-10-21 on founder feedback: as accent *text* it
  read as hidden next to the quiet tabs; the AI action must be
  unmissable (D7). The bar itself carries a soft top shadow
  (the one sanctioned floating-layer shadow outside §2.4's
  overlays, because the bar floats over scrolling content).
  The action tab carries no active state.

### Native feel (founder directive, 2026-10-21)

The web app should feel like a native app. Concretely, that is
a checklist, not a vibe — each item is cheap in this stack and
verified on the phone, not assumed:

- **Installable + standalone:** web manifest, app icons,
  `theme-color` per scheme, iOS standalone metas — launched
  from the home screen it opens full-screen in `--bg` with no
  browser chrome and no white flash.
- **Touch physics:** no tap-highlight flash, no double-tap
  zoom (`touch-action: manipulation`), momentum scrolling,
  overscroll contained (no rubber-band revealing a "page"
  behind the app), every target ≥ 44px (§6).
- **No web tells:** inputs at 16px so iOS never auto-zooms a
  form; no floating web-style buttons (§3); navigation is the
  bottom tab bar, not in-page links; loading is skeletons
  shaped like the app (D9), never a browser-style blank.
- **Honest limits:** haptics, native share sheets, true
  offline, and app-store presence are *not* achievable in this
  stack — they belong to the framework/shell decision (UX-13
  decision point), and this doc doesn't pretend otherwise.
- **This system is the future native app's blueprint**
  (founder goal, 2026-10-21): a consistent, native-looking
  experience now is deliberately an investment in whatever
  client comes next. Tokens (color roles, type scale, spacing,
  radius) and component anatomy are platform-independent —
  they map 1:1 onto a native theme (SwiftUI / Compose) — so a
  future native app inherits a *tested* design and starts at
  implementation, not at design. Every screen re-skinned to
  this doc is a screen the native app doesn't have to invent.

## 4. Components

One per job (Principle 4). Each lists its anatomy once; feature
code composes these, never re-derives them.

### 4.1 Buttons
- **Primary** — `--ink` fill, `--paper` text, radius 8,
  min-height 48, 15.5px/600. One per view: the screen's main
  action. (Accent fill is reserved for the proposal card's
  confirm, §4.6 — the moment the AI asks, color marks it.)
- **Secondary** — transparent, `--line-strong` border, same
  sizing. **Ghost** — no border, `--ink` text. **Danger** —
  `--danger` text/border; fills only inside confirm dialogs.
- Pressed state: 0.98 scale + 120ms (see §5). Disabled: 45%
  opacity, no pointer events. Every action has a text label —
  never icon-only (a founder call, 2026-10-18, and now law).
- Tab bar labels follow the same rule: text, no glyphs, in v1.
  (Revisit when/if an icon set arrives with the framework
  decision — see Critiques, round 3.)

### 4.2 Item card
Photo (4:5) → name (Heading, truncated 1 line) → one Small
muted line (category · color). Badges float top-left on the
photo (score badge pattern: `--black` pill, `--on-black` text).
No attributes on the card — recognition is visual (D3);
attributes live in item detail.

### 4.3 Outfit card
`--paper` fill, `--line` border, radius 14, padding 16. Eyebrow
(source: "Today's pick" / trip name), serif outfit name when
named, item rows as small photo thumbs + names, reasoning in
Small italic `--muted`, confidence in Small. Actions as ghost
buttons in a footer row ("I wore this", "Shuffle", "Save").

### 4.4 Trip card / shop card
Same shell as 4.3. Trip: name (Heading), dates + destination
(Small muted), packing status line. Shop: photo-led like 4.2
with the score badge; verdict in Small `--sage-ink` or
`--danger` by outcome; status chip (§4.5) top-right of the
photo.

### 4.5 Chip (exactly one)
Pill, radius full, 13px, padding 4px 10px, `--paper` fill,
`--line` border, `--ink` text. Variants: **info** (weather —
muted text), **removable** (adds a × ghost button — pins,
references), **state** (shop status — tinted fill by state,
never a new shape). This one component replaces the five
current chip implementations.

### 4.6 Proposal card — the trust pattern
Every "the AI wants to remember / create / change something"
moment in the product is this card (D5): inline in chat, full
bubble width, `--paper` fill, `--accent-soft` eyebrow row with
the kind glyph + a question as the title ("Remember as current
location?", "Create this trip?"), body lines (label — detail —
weather — until…), footer: **Save/confirm** (accent primary) +
**Dismiss** (ghost). One shape, every time, so the user learns
it once: *this shape means my call.* On narrow widths the footer
stacks — Save above Dismiss — never wraps mid-label.

### 4.7 Sheet
Bottom sheet (existing pattern, standardized): radius 20 top,
handle bar, Eyebrow title, options as full-width rows (title
15px/600 + optional Small muted sub), cancel row last,
safe-area bottom padding, rises in 260ms (§5). Sheets are for
choices; dialogs (centered) are only for destructive confirms.

### 4.8 Forms
Label above (Small/600), input height 48, radius 8, `--paper`
fill, `--line-strong` border, focus = `--ink` border + 2px
accent outline offset. Error: `--danger` border + Small danger
message under the field — never color alone, always text.
AI-suggestion rows (the describe/name hints) in Small
`--accent-dark` — the one sanctioned accent-text use besides
§4.6, because it literally is the AI speaking.

### 4.10 Today home (the default home since 2026-10-21)

The stylist-first home from
`docs/proposals/TODAY-HOME-PROPOSAL.md` (validated 2026-10-21,
built as DESIGN-HOME-1). Anatomy: serif greeting (Display) +
weather chip; the **proposal slot** — today's pick composed as
piece photos with names, the stylist's one-line why, and
*Wear this · Another · Ask the stylist*; then the **day's
thread**: doorway cards (rate yesterday's outfit, trip
countdown, saved shop checks, unworn pieces), each deep-linking
in context; an **Explore row** as the floor when the thread is
thin. Graded empty states (zero / below-threshold / ready)
per the proposal — honest progress, a labeled sample, never a
fake pick. With the experiment on, the topline carries a
tappable serif **"Closet"** wordmark (the home affordance; the
tab bar itself never changes). One generation per day, cached;
the screen renders instantly and the proposal streams in.
**Fix buffer 4 (founder's first real use, 2026-10-21):** the
wordmark alone failed as the way back — it reads as a title and
scrolls away. Today now also **leads the stylist sheet**: with
the experiment on, opening the stylist shows the pick card
(compact mirror, same actions) above the conversation, so the
always-visible ✦ Stylist pill is the persistent door home —
the founder's own steer ("part of the whole stylist
experience"). The wordmark stays as a secondary affordance.
**Fix buffer 5 (manual testing, 2026-10-21):** (a) Today state
is server-side — the toggle lives in `settings/app`, the day's
picks in `today_picks/{day}`; localStorage is a first-paint
mirror only, and the first device of the day composes while
others adopt (a 90-second compose claim prevents duplicate
generations). (b) **Worn derives from actual wear data** —
`wear_events` for today — never a local flag; deleting the
wear record removes the tag, and a deleted outfit un-saves
the pick. (c) **A trip is a page** (`#tripView`, back to the
list), not a floating window; the editor remains a sheet.
(d) **The stylist docks**: bottom sheet on phone, a 420px
right-edge panel on desktop. (e) **Motion basics shipped**
(§5): 200ms view fade-rise, 260ms overlay entrances (the
docked stylist slides), press compression, all of it off
under reduced-motion.
**Graduation (founder, 2026-10-21):** "make the experimental
experience default — it looks good enough to me." Today is now
the default home: with no stored choice anywhere, the app
opens on Today; an explicit off (settings doc or device) is
still honored everywhere, and the Account toggle survives as
an opt-out, relabeled from "Experimental" to "Today home."

### 4.9 Toast, empty state, skeleton
- **Toast:** bottom-center above the tab bar, `--ink` fill,
  `--paper` text, radius full, auto-dismiss 3.2s. One at a time.
- **Empty state:** Display serif headline, one Body line of
  why-it's-empty + what-to-do, exactly one primary CTA.
  Conversational emoji allowed here and in chat (D8) — nowhere
  in chrome.
- **Loading:** skeletons, not spinners (D9): shimmer blocks in
  the shape of the coming content (grid tiles, card rows).
  Spinner survives only inside a busy button.

## 5. Motion

- Durations: **120ms** (presses, hovers) · **200ms** (fades,
  tab swaps — content slides 8px + fades) · **260ms** (sheet
  rise) · **350ms** (overlays). Easing: `cubic-bezier(.2,.7,.2,1)`
  everywhere; nothing linear except shimmer.
- Animate entrances and state changes; never animate data —
  lists appear, they don't cascade in.
- `prefers-reduced-motion`: all of the above collapses to
  instant + fades off, shimmer off.
- No `backdrop-filter` blur in v1 — it's a low-end-phone
  performance trap; the tab bar is a solid `--paper` fill
  (Critiques, round 1).

## 6. Accessibility floors (non-negotiable)

- Tap targets ≥ 44px; primary actions 48px.
- Contrast ≥ 4.5:1 for text (≥ 3:1 for Display/Score). Known
  tight pairs get the `--muted-strong` token on `--paper-soft`
  surfaces (Critiques, round 3); accent text only ≥ 14px/600
  or `--accent-dark` on `--accent-soft`.
- Focus is always visible (accent outline). Errors always pair
  color with text. Serif floors per §2.2.

## 7. Decisions — the why, and what else was on the table

**D1 — Identity: "Gallery" palette + serif moments (merged
verdict, 2026-10-21).** v1 proposed evolving the existing
identity (warm paper + raspberry). The founder asked to
experiment while the product has one user, so Card 2 built the
grid twice: *Lookbook* (the existing identity, systematized) vs
*Gallery* (cool neutral paper, ink-blue accent, all-grotesque
type) — one toggle, same components (`/preview.html`). His
verdict: **Gallery looks much better; the Lookbook font is
better.** Adopted identity = the merge: Gallery's palette
(§2.1) with the serif display face kept for moments (D2
unchanged). The lesson is D1's own changeability note, proven
the day after it was written: because the identity was
tokenized, a full identity change cost one token swap — and
the experiment itself cost one static page. Warm-paper
raspberry is retired, not mourned: it read "craft project"
next to Gallery's gallery-wall calm, and cool neutrals flatter
a *wider* range of garment colors (the warm cast was quietly
grading every photo).
_Changeability (founder question, 2026-10-21):_ identity is
tokenized — the palette is ~20 role values in two `:root`
blocks, the voice is two font families + the §2.2 scale. A
future identity change is therefore a token swap + font swap:
hours, not sprints — *provided* the §2.1 no-hardcoded-colors
rule holds (every stray hex is a small mortgage on this).
What does not change cheaply: component shapes and layout
grammar (tab bar, card anatomy, the proposal pattern) — those
are the system, not the identity — and anything captured
outside the app (screenshots, an app icon, a name). While the
product has one user, this is the cheap experiment window:
identity experiments run as alternate token blocks on the
reference screen, judged on real content, adopted or dropped
by editing this doc.

**D2 — Serif for moments, sans for work.** *Why:* fashion is
editorial; headlines, outfit names and scores in serif give the
app a magazine voice no dashboard has, while lists/forms/chat
stay in the legible sans. *Alternative:* all-sans (the
Linear/Notion school) — cleaner, safer, and generic; it would
make the app look like every productivity tool. *Alternative
2:* serif everywhere — romantic until a settings form sets in
it; illegible at small sizes, hence the 19px floor.

**D3 — Photo-first grid; attributes live one tap down.**
*Why:* people recognize their clothes visually; a grid that
reads like a contact sheet is scannable in a way attribute-
dense cards never are, and dense cards are precisely what
makes the current app read as a database. *Alternative:*
info-rich cards (color/formality/warmth on every tile) — wins
for power-user closet management, loses the morning-fast,
lookbook feel; the data is still one tap away in detail.

**D4 — Bottom tab bar for primary nav.** *Why:* the phone is
the device, thumbs live at the bottom, and every modern app
the user compares us to (Instagram, Depop, Airbnb) navigates
there; it also frees the header to carry context (weather,
pins) instead of nav. *Alternative:* keep the current top
segmented row — perfectly good for desktop-first tools and
cheaper to leave alone, but it reads "web page," not "app,"
and pushes content down on the device that matters.

**D5 — One proposal card for every AI ask.** *Why:* trust is a
learned shape. Pins, trip creation (PC-33), catalogue adds
(UX-14) all ask the user to let the AI change their data; if
the ask always looks identical — question title, plain body,
Save/Dismiss — the user builds one fast, confident reflex.
*Alternative:* bespoke cards per feature (what we have) —
each can be locally prettier; collectively they teach nothing
and every new feature re-litigates consent UX.

**D6 — Flat cards (border/fill), shadows only for floating
layers.** *Why:* depth from paper tones + hairlines fits the
editorial direction and is dark-mode-safe; shadowed cards are
the single most dated signal in 2016-era Material design.
*Alternative:* soft shadows on cards (the Airbnb-ish look) —
warmer and more tactile, at the cost of muddying dark mode
and competing with photo content for depth.

**D7 — Accent is rationed: it means act/attend.** *Why:* today
hint text wears the accent, so raspberry shouts everywhere and
signals nothing. Rationed, the one accent element on a screen
is unmissable — which is the entire point of having one.
*Alternative:* accent as decoration (the current state) —
friendlier, more colorful, and it spends the signal.

**D8 — Emoji out of the chrome, kept in conversation.**
*Why:* emoji render differently on every platform, age fast,
and in buttons/tabs they read as toy-like; in the stylist's
mouth (and empty states) they're warmth and voice.
*Alternative:* emoji as the icon system (free, friendly) —
the current drift; it caps how modern the app can ever feel,
which is the complaint that started this redesign.
(Companion rule: actions are never icon-only either — labels
always; see §4.1.)

**D9 — Skeletons over spinners.** *Why:* perceived speed —
a shimmering grid-shaped placeholder feels ~instant and holds
layout still; a centered spinner says "wait" and lets the
page jump when content lands. *Alternative:* spinners —
honest, simple, and the visual signature of an app that
hasn't been designed yet. Chat keeps a typing indicator
(three dots) because there, "someone is composing" is true.

**D10 — Dark mode via token mapping, OS-driven.** *Why:* the
tokens already map both schemes; following
`prefers-color-scheme` is free, respectful, and one less
setting to design. *Alternative:* a manual in-app toggle —
a nicety for later; it is a settings feature, not a system
property.

**D11 — A 4pt spacing scale and a 4-step radius scale,
enforced.** *Why:* rhythm is the invisible half of "feels
designed" — the eye reads aligned repetition as quality
without knowing why. Freehand spacing is how the current app
got five chips and six radii. *Alternative:* designer's-eye
spacing per component — works with a full-time designer
iterating visually; we are a doc-driven studio, so the scale
*is* the designer between sessions.

**D12 — Serif numerals for scores.** *Why:* the shop score is
a verdict moment; a 56px serif numeral reads like a magazine
rating, not a dashboard KPI, and it's the number users will
screenshot. *Alternative:* sans tabular numerals — better
for scanning columns of figures, which this app never has.

## 8. Applying it (per the Sprint 18 plan)

1. Wardrobe grid + item card first (Card 2) — the reference
   implementation; every later screen copies its moves.
2. Chat + proposal card second (Card 3), absorbing the
   "What should I wear?" cluster as designed components.
3. Then trips, shop list, outfits, settings — one screen per
   cut, behavior-preserving, phone-verified.
Framework migration, when its decision point (redesign
proposal) says go, ports *this* system — the tokens and
components above are the spec it must reproduce.

## 9. Open questions carried to the founder

- A "Today" home (the morning pick as the literal first
  screen) is a *flow* change, not a re-skin — out of Sprint
  18's scope by the plan's own rule, flagged here because
  Principle 2 keeps pointing at it. Founder's call, separately.
- An icon set for the tab bar (replacing text-only tabs)
  rides with the framework decision; text tabs are v1-honest.

## 10. Amendment — Warm Editorial (2026-10-23, founder-delegated)

**Mandate.** After the Combina aesthetic study
(`research_notes/closet-combina-aesthetic.md`), the founder
delegated design decisions outright: lean into high-quality
design, reference any high-adoption design-led app, Bramble
decides and iterates "until I'm happy with it." This amendment
is the decision record for that mandate (the A-decisions),
written to the same standard as §7: why, plus what else was on
the table. Category cross-checks (Indyx, Whering, Acloset —
real adoption, per 2026 roundups) confirm the baseline moves:
cutout imagery as the catalogue standard, clean editorial
grids, analytics worn lightly. Combina contributes the
register and the components; the category contributes the
proof that clean catalogues retain.

**A1 — Temperature: warm wins; dark is the primary theme.**
Ivory / espresso / brass replaces Gallery's cool blue-grey.
Why: fashion reads warm — every design-led reference in the
category (Combina, Indyx's editorial flatlays, Whering's
"best static UI") works in warm neutrals with restrained
accents, while blue-grey reads "productivity tool." Brass is
the quietest luxury signal available and the most unisex;
it also never competes with garment colors (Principle 1).
Dark is designed first, not inverted as an afterthought: the
founder's default is dark, so espresso *is* the product and
ivory is its sibling. Alternatives: keep Gallery (rejected —
tech register, and the founder's adoption bar points the
other way); revive the pre-Sprint-18 raspberry (rejected —
playful, gendered, fights warm garments); true black + white
minimalism (rejected — cold, and wastes the serif).

| Role | Light (Ivory) | Dark (Espresso) |
|---|---|---|
| `--bg` | `#f2ebdb` | `#16120d` |
| `--paper` | `#fdfaf1` | `#211a12` |
| `--paper-soft` | `#e9dfc8` | `#2b2317` |
| `--ink` | `#1e1710` | `#f2e9d8` |
| `--muted` | `#6f6350` | `#b3a68d` |
| `--muted-strong` | `#4f4433` | `#d3c6ab` |
| `--faint` | `#96876c` | `#8d8172` |
| `--line` | `#ddd0b2` | `#3a3122` |
| `--line-strong` | `#bfae8c` | `#5a4c33` |
| `--accent` | `#a87c1c` | `#dfae54` |
| `--accent-dark` | `#85600f` | `#f0c778` |
| `--accent-soft` | `#efe3c2` | `#37290f` |
| `--sage` / `--sage-ink` | `#e2e5d2` / `#44512f` | `#27331f` / `#c4d8b2` |
| `--danger` | `#b3263e` | `#ff8296` |
| `--black` / `--on-black` | `#171208` / `#f7efdd` | `#f2e9d8` / `#171208` |
| `--shadow` | `0 18px 50px rgba(46,34,10,.12)` | `0 18px 55px rgba(0,0,0,.45)` |

Contrast discipline (critique-applied): brass `--accent` is
for fills, large text, and graphic accents; small accent
*text* uses `--accent-dark` (≥5.9:1 on ivory, brighter brass
on espresso). Nothing wears accent except act/attend (D7
unchanged).

**A2 — Type voice: the payoff word.** The serif gains one
rule, stolen from Combina's headlines: in hero/empty-state/
feature moments, set the emotional word in *italic serif*,
accent-colored — sparingly (one per surface, or it becomes
noise). Screen titles stay serif roman. Two new styles:
**LookName** (serif, letterspaced +0.04em, Title size) for
named outfits, and **Note** (serif italic, Body size) for
stylist rationale wherever it appears. Alternatives: script
accent (Combina's Notes pill) — rejected for now, no script
family in the self-hosted set and it skews the register;
all-italic rationale in chat — rejected, italics fatigue at
paragraph length; Note style is for the composed sheet (A4).

**A3 — Outfits get names (the masthead).** The stylist
returns a `lookName` + `tagline` with every pick; Today and
the outfit detail render a masthead: eyebrow ("Today's
feature"), LookName, italic tagline, then the pieces. Why:
a named look is a *thing* — memorable, saveable, shareable —
where "today's outfit" is a list. This is the single highest
quality-per-effort move in the study. Alternatives: names
only on save (rejected — the name is what makes the morning
moment); auto-names from a template bank (rejected — the
model already writes the rationale; a name + 3–6 word
tagline rides the same call, tracked by OBS-3).

**A4 — Explanation is composed: the Behind-the-Look sheet.**
Critique/reflection content renders as a bento sheet, not
chat prose: rationale (Note style) up top; then small cards
— palette (item color dots on a ring, "color orbit"), a
material note, a proportion/silhouette note, the weather
slide-card, the mood/story chip. Data already exists across
describe tags + critique output; this is presentation, plus
one structured field from the critique prompt. Alternatives:
keep prose, restyle it (rejected — prose is why explanations
feel cheap; the artifact is the difference); generate a
rendered image card (rejected — text must stay selectable,
translatable, and cheap).

**A5 — Wardrobe opens as a category masonry.** Two staggered
columns of category cards, each with ONE hero piece on a
`--paper` card and a serif label — tap through to the
existing item grid (DESIGN-GRID-1 stands, one level down).
Why: recognition over inventory; a 69-item grid is a
database, a category wall is a closet door. Hero = the
category's most-worn piece with a passed PC-34 render when
one exists, else its best photo (honest fallback; cutouts
take over as renders accumulate). Alternatives: masonry of
all items Pinterest-style (rejected — chaos at 69 items,
and it orphans the grid work); keep grid-first (rejected —
it's the "database" feel the founder keeps flagging).

**Component notes (from the Combina UI inventory).**
Story chips: named-mood chips (from vibe/style tags); the
selected chip is a brass fill with ink text — never an
outline. Day strip: rounded-square day cells, today gets a
brass ring, planned days a filled dot; serves trips and any
future plan-ahead. Weather becomes a slide-card (photo sky
+ temperature) inside sheets, stays a quiet line inline.
Glass pills (frosted, on photos) are reserved for actions
floating on imagery — masthead only. Radius: cards move
14 → 18 and sheets 20 → 24 in the W2 pass (the references
are visibly rounder; §2.3 amends then, with the screens).

**Waves.** W1 tokens + type voice (this amendment's build).
W2 named looks (stylist fields + masthead) + radius pass.
W3 Behind-the-Look sheet. W4 category masonry. W5 chat
re-skin (Sprint 18's DESIGN-CHAT-1) on the finished system.
Each wave is its own card, phone-validated before the next
is called done — "verified" means the founder's phone.

**Critique applied before building** (delegated-authority
rounds, logged in the sprint file): brass-on-ivory small
text (fixed via accent-dark rule); warm-dark + photo-heavy
surfaces (garment colors gain saturation against espresso —
desirable); masonry without cutouts (fallback specced in
A5, not hand-waved); letterspaced caps shouting (LookName
capped at Title size); renaming everything at once (names
land per-wave with their components, not as a find-replace).
