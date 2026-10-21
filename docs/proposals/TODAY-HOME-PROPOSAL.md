# Proposal — Today: a stylist-first home (sketch v0.1)

Filed 2026-10-21, after the founder widened the design latitude:
"Don't be afraid to propose dramatic updates or complete
redesigns — doesn't have to be incremental updates." This sketch
answers that with the boldest structural move available to the
product. **Status: sketch, awaiting founder steer.** If the
direction validates, it gets the full treatment — critique
rounds, a DESIGN.md amendment, a sprint card — before anything
is built.

## The inversion

Today the app opens on the **catalogue**: a grid of your own
clothes, with the stylist as a button in the bar. The catalogue
is the *cost* of the product (UX-14: cost front-loaded, value
back-loaded). The app greets you with the filing cabinet and
hides the magic in the chrome.

**Invert it.** The app opens on **Today**:

- A greeting moment (serif): "Good morning." + the day's
  weather chip — the context the stylist already reasons over.
- **One outfit proposal for today**, front and center: piece
  photos composed as an outfit card, the stylist's one-line
  why, and three actions — *Wear this*, *Another*, *Ask the
  stylist* (opens chat with the proposal in context).
- Below: the day's thread — yesterday's outfit to rate (the
  wear→rate→reflect loop finally gets a front door), a trip
  countdown when one is near ("Vancouver in 8 days — packing
  list ready"), the catalogue a tap away as its own tab,
  unchanged underneath.

The tab bar stays (Wardrobe becomes the catalogue tab; a Today
tab takes the home slot — or Today *is* the home and Wardrobe
keeps its tab; a detail for the full design). The grid, chat,
trips, and shop systems don't change. What changes is **which
screen the product's promise lives on**.

## Why this is the lever

- **Time-to-first-value (UX-14's metric):** today it is
  "catalogue ~10 pieces, then ask." With Today, a returning
  user gets value in the first second of every open — the
  proposal is already there. A new user's Today degrades
  honestly: "Add a few pieces and your mornings get easier,"
  with the greatest-hits path built in.
- **The loop that has never closed:** wear events are still 0
  (Sprint 4's loop never completed end-to-end). Nobody opens a
  catalogue every morning; people *do* get dressed every
  morning. Today puts Wear/Rate where the habit already is.
- **Feeling:** the founder's own redesign framing — "feeling is
  extremely related to wanting to use it." A grid of your own
  clothes feels like storage. An app that has an opinion about
  your morning feels like a stylist. This is the difference
  between a tool you maintain and a product you open.
- **The sparkle request, answered structurally:** he asked for
  the Stylist to attract more attention twice. A pill can only
  shout so loud; a home screen *is* the stylist attracting
  attention by being the point.

## What it costs / risks

- One new screen (the proposal card machinery already exists
  in chat — DESIGN-CHAT-1's components get reused, so this
  composes with the sprint rather than competing with it).
- Risk: a bad 7 AM proposal is more visible than a bad chat
  answer. Mitigations already in the system: the calibration
  data, *Another* as a first-class action, and Rate feeding
  the loop.
- Risk: catalogue-first users (organizers) lose their home.
  Mitigation: the tab remembers; Wardrobe is one tap, and the
  catalogue itself is untouched.
- Framework decision point: unchanged — a new screen is
  buildable either way; if anything, Today is the ideal spike
  candidate (self-contained, high-visibility).

## Open questions for the full design

1. Today as a fifth tab, or the home the app cold-opens to
   (with Wardrobe keeping its slot)?
2. How much of the day's thread lives on Today vs staying in
   its own views (rating prompt, trip card, gaps)?
3. The empty/first-run Today: demo proposal from the labeled
   demo wardrobe (UX-14 attack line 2) from minute zero?
