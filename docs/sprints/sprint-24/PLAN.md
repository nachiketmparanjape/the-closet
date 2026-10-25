# Sprint 24 — The stylist's context, completed

Opened 2026-10-24 on the founder's call ("अजून एक धाव —
one more run"), straight after the UX-18 phone-test fix
buffers and the Context Standard (same day). Planning walk
per the studio algorithm: BACKLOG.md with trigger checks →
studio inbox → open GitHub issues → SHIPPED.md
verification. The founder approved the ranked slate and
added PC-45 himself ("तेही करून बघू").

## Theme

UX-18 made the stylist seamless; this batch completes the
context system around it — the standard gets its missing
proposal door, trips get their steering card, first-run
tabs stop lying by omission, and the chat gains eyes
(reference photos) and a memory for "no" (style rules).

## The slate (build order)

### PC-53: New-user empty states on every tab (S)
- **Status:** Built + deployed 2026-10-24; founder phone
  validation pending.
Design at docs/proposals/NEW-USER-EMPTY-STATES.md (two
tiers, count-derived graduation, no stored flags). Founder
parked it for exactly this walk. In: Outfits/Shop/Trips
Tier-0 intro cards, Wardrobe+Outfits Tier-1 gap banner,
Stylist one-liner. Out: any wizard, any stored state.

### PC-52: The stylist may propose an attachment (S)
- **Status:** Built + deployed 2026-10-24; founder phone
  validation pending.
Completes the Context Standard: attach is an act, and the
stylist may PROPOSE the act (a card mirroring pin
proposals) but never attach silently. In: server-side
proposal signal when a reply reasons over the pick;
client proposal card; accept attaches, dismiss leaves no
trace. Out: auto-attach in any form.

### PC-33: Trip steering in general chat — remainder (S)
- **Status:** Built + deployed 2026-10-24; founder phone
  validation pending.
Correction found while building: the principle was
adopted in the UX-18 context model, but the prompt rule
itself never landed in the brief — so this card carried
both halves after all: the TENSE RULE in the pin-proposal
brief, and the trip-intent confirm
card in general chat per docs/proposals/TRIP-STEER-
PROPOSAL.md — prefilled destination/dates, create-or-
dismiss, at most once per conversation, advice never
gated; a steering card suppresses a pin proposal for the
same fact. The card closes when this lands.

### PC-54: Paste intake on phones (S)
- **Status:** Built + deployed 2026-10-24; founder phone
  validation pending (iPhone fallback tap; the Android
  read path needs an Android device). The button is
  visible everywhere and its tap degrades honestly where
  the read is unavailable (the card's acceptance), and
  PC-51's routing is now one shared routePastedImages.
  The Web Share Target split out as PC-55 on the build's
  evaluation: no service worker exists in the app, and
  that infrastructure gets its own design pass.
PC-51 rides the desktop paste event; phones have none.
In: a visible "Paste a photo" button where the platform
supports clipboard read (Android Chrome, permission
prompt), honest iOS fallback copy pointing at the photo
picker (iOS Safari allows no programmatic read). The Web
Share Target is evaluated during the build and splits
into its own card if it grows.

### PC-38: Attach reference photos in stylist chat (M)
- **Status:** In Sprint 24.
From the Essembl teardown P3 (founder-adopted). In:
attach up to 4 reference images to a message in the
general chat (picker + camera, single-door pattern);
thumbnails in the composer, removable before send;
references ride to askStylist as vision context for that
turn only. Out: creating wardrobe items from references
(PC-36's path), persistence beyond the conversation,
trip-chat parity for now. Acceptance per the backlog
card: the reply visibly reasons over the references and
suggests outfits built only from owned pieces.

### PC-45: Explain-the-no → a proposed style rule (M)
- **Status:** In Sprint 24.
From the Alta teardown (founder-saved, HELD for UX-18 —
the hold released when UX-18 shipped; founder added it
to this slate). In: rejecting a pick with a reason may
propose a style rule as a confirmable fact — never
learned silently; confirmed rules feed the brief via the
fact system and show in the profile; dismissing leaves
no trace. Out: free-text rule editing, learning from
unconfirmed rejections.

## Walk record — dispositions

- PC-7, PC-9, PC-10 — verified shipped in SHIPPED.md
  (Sprints 1–4 entries); cards closed.
- PC-14 — closed: shipped in substance. The shop check
  it asked for is the app's Shop tab, grown since by
  PC-40 / PC-42 / PC-46.
- PC-29 — closed as superseded: its core shipped as
  PC-31 + PC-37 + the trip rooms; the unbuilt remainder
  (activity/luggage awareness) lives in PC-48.
- UX-12 — killed as a separate card: its park rationale
  (flows still changing) has expired; the first-run
  concern folds into UX-14, and PC-35 + PC-53 cover the
  guide/empty-state halves.
- PC-23 (archive layer) — keep parked. Trigger: the
  wardrobe passes ~120 pieces or the founder complains
  about clutter.
- PC-24 / PC-25 / PC-26 (gender cluster) — keep parked
  as a cluster; no new signal since filing.
- UX-14 (onboarding, L) — keep; next sprint's anchor
  candidate.
- PC-36 (person photo → articles) — keep; the vision-
  input slot this round went to PC-38 (smaller, chat-
  scoped).
- PC-41 (in-check follow-up thread) — founder decision
  pending his phone test of the shop attach shipped
  2026-10-24 (its core need may already be met; the
  remainder re-competes or the card closes on his word).
- PC-48 — keep as first alternate; its moment is the
  run-up to the January Canada trip.
- BUG-1 — already killed 2026-10-24; the mirror run at
  this sprint's opening closes the stale GitHub issues
  (the board had drifted behind the markdown).
- Inbox: the long-term visions (garment model, outfit
  composer/ratings) stay parked; the garment model's
  revisit trigger — a conversational loop that exists
  and can measure outfit quality — is now close to met
  and it re-competes at the next walk.

## Standing constraints

- Founder phone test is the ship gate per card; batches
  deploy per card, not in one drop.
- PC-34 stays blocked on the founder's Replicate token
  (outside this sprint).
- Every card updates BACKLOG + SHIPPED in its own commit;
  the mirror runs at sprint close.
