# Sprint 21 — Quiet proofs + shop polish

Approved by the founder 2026-10-24 (revised slate — see the
PC-41 note). Batch, not a timebox.

## The planning walk (2026-10-24, second walk of the day)

Full inventory: BACKLOG.md (53 cards), studio inbox (nothing
new since the Oct 22 curator pass), open GitHub issues via the
mirror (gh CLI still unauthenticated — the mirror is the list).
Verified against SHIPPED.md. Aging: no undispositioned items
over a month old — the Oct cluster was dispositioned at the
Sprint 20 walk hours earlier.

**The PC-41 correction.** The first proposed slate ranked PC-41
(follow-up chat on a shop check) #1 on dependency momentum. The
founder killed it in review: the stylist chat is slated for a
bottom-up rethink (UX-18, designed completely rather than in
stages), so a chat feature built now is rework by definition —
and the chat itself is an important invisible, not just its
context model. PC-41 joins PC-38 + PC-32/PC-33 in the
held-for-UX-18 set. Doctrine gained a rule the same day:
extensions queue BEHIND a pending bottom-up redesign, never in
front of it (PLAYBOOK, Important invisibles).

## Slate

1. **PC-42 — Crop the shop-check photo to the garment (M).**
   Crop step inside the check flow before upload/analysis
   (fixed frame, drag to pan, zoom slider + wheel; canvas
   render, long edge ≤1600px JPEG); "Use full photo" reproduces
   today's behavior exactly; the cropped photo is the saved
   subject of record.
2. **OBS-4 — Data-model drift spot-check (S).** New card, from
   the important-invisibles register: the catalog data model
   (docs/DATA_MODEL.md) has no proof surface. A drift section
   in the quality report: sample live items/trips/checks,
   verify the required v2 fields + the NAMING-1 standard,
   report drift counts by kind. Read-only.
3. **UX-17 — Manual theme choice in Account (S).** System /
   Light / Dark, stored per device, data-theme attribute
   overriding the media query both ways. Default stays System.
   (Trigger honesty: the founder's question was curiosity, not
   priority — pulled because it is small and closes his own
   question.)

## Research slot

Alta teardown, background, per the studio teardown protocol —
findings return as candidates thrashed at P3; nothing built ad
hoc.

## Held with reasons

- PC-38, PC-41, PC-32, PC-33 — chat; behind the UX-18 redesign.
- PC-36 — big; extraction input gated on PC-34's token.
- OPERATIONS OP-1 (CI restore) — unbounded permission
  archaeology; manual path works; pulls when it bites twice
  more.
- PC-13 (remaining slice) — filler if the sprint runs light.
- PC-34 — unchanged rail: token lands, ships as a fix outside
  the sprint.
