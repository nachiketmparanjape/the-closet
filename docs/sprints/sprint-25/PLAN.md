# Sprint 25 — "One photo in, wardrobe + outfit out"

Approved by the founder 2026-10-28 (planning walk: full inventory —
backlog, inbox, open issues, trigger checks, aging check; no aging
disposition forced, nothing open and unstarted is over a month old).

Theme: the multi-clothes flow the founder prioritized the same day.
One photo of several garments — or of a person wearing an outfit —
becomes wardrobe items plus the outfit, with the user confirming
every AI claim. The SAM service built for it also replaces BiRefNet
as the flat-photo engine, and the automatic orientation check lands
with it.

## Order of work

1. **PC-36 design doc first, then build.** PC-36 is a complex system
   (service + matching + review UI + outfit composition), so the
   living design doc comes before code, for the founder's
   validation. The design sketch filed on issue #78 (2026-10-28)
   is the starting point, not the doc.
   Design doc (draft for validation, 2026-10-28):
   `docs/sprints/sprint-25/PC-36-DESIGN.md`.
2. **SAM service, then the PC-34 swap.** The service proves itself
   on PC-36's multi-garment path first; the flat-photo path
   switches to it second, since it is the same service.
3. **PC-59 part 2** rides the pipeline work (it measures at
   extraction time).

## Card 1 — PC-36: photo of a person → individual articles + the outfit

- Flow: Gemini lists the garments (one vision call per photo) →
  one SAM call per garment with a color-attributed prompt →
  cutout → normalized render (Stage C standard: 4:5 canvas,
  centered, 92% fill) → DRAFT item → user confirms or corrects
  → outfit composed of exactly the confirmed articles.
- Matching: pHash first (same photo, certain, free); garment
  embeddings second (same piece, different photo — PC-56's
  layer, built here as PC-36's matching step, not a separate
  card). Similarity proposes, never merges; default under
  uncertainty is NEW.
- Correction: one tap per draft — confirm as new / this is an
  existing item / not a garment / fix details. A rejected match
  is recorded and never re-proposed (PC-45 pattern). The outfit
  is proposed (pieces + date) for confirm / edit / discard,
  with one-tap "log worn today".
- Display: one review screen — source photo with tappable
  garment outlines on top, one card per piece below (render,
  name, status: New / Looks like your X / Needs a look, inline
  actions). Low-confidence cuts show as "not sure", never
  hidden. After confirmation, pieces land in the grid like any
  item; the outfit lands in Outfits with the source photo as
  its reference image.
- SAM hosting decision at build time: community build vs our
  own pinned deployment vs fal — on reliability evidence from
  the backfill (boot latency and flakiness, not quality, were
  the community build's problems). Async create/finish split
  for slow boots; outputs persisted the moment a job
  completes (the batch-2 loss lesson).
- Cost shape (from the studio cost sheet, Oct 2026): a 3-piece
  photo runs ~$0.015 (one Gemini list + three SAM runs).
- Acceptance: the founder's mirror selfie → each garment as
  a draft with a clean render → confirm → wardrobe items +
  outfit; a piece he already owns is proposed as a match,
  not duplicated; a junk cut is rejectable in one tap.

## Card 2 — SAM engine swap + automatic orientation (PC-34)

- The flat-photo extraction path moves from BiRefNet to the
  SAM service. BiRefNet stays as the fallback for
  single-garment photos where SAM finds nothing (the rescue
  that saved the two backfill holdouts).
- The automated vision orientation check (PC-34's layer 3)
  lands inside the pipeline: one verdict per piece orients
  both the clean render and the original photo (one verdict
  covers both views, since the render is cut from the
  original). The manual per-picture rotate buttons remain
  the override.
- Acceptance: a new flat-photo upload cuts via SAM, lands
  upright without a manual rotate, and shows the clean
  render under the same toggle/rotation rules as today.

## Card 3 — PC-59 part 2: too-small-in-photo warning (S)

- At extraction time, measure garment frame share (mask
  pixels / photo pixels) and source long edge. Proposed
  trigger: frame share under ~25% or long edge under ~700px
  on a camera photo (retail-sourced photos exempt — the
  remedy there is "add your own photo").
- Surfaces: a note at add time ("this piece is small in its
  photo — a closer photo will look sharper") and a small
  persistent note on the item until a better cover photo
  replaces it. Non-blocking: the render still ships.
- Acceptance: a far-away photo warns; a normal flat-lay
  does not; dismissing or replacing the photo clears it.

## Housekeeping alongside (not a card)

- PR #80 (design docs in the new format): the
  conflict-resolution pass + post-merge folds + doc-honesty
  check. Founder-approved 2026-10-27, blocked on the merge.

## Alternates (not in this sprint)

- PC-58 review gate — first alternate. Its trigger fired
  (renders exist), but PC-36's draft-confirm covers its core
  for the multi-photo flow, so it follows rather than leads.
- UX-16 context-handoff audit — second alternate (small).
- PC-48 trip planning — on visa watch (Canada visa pending,
  not landed).

## Held / parked (triggers unmet, not in this sprint)

- PC-41: waits for the founder's shop-attach phone verdict.
- PC-49: needs a PC-36 verdict first.
- PC-55: needs service-worker infrastructure pulled for
  another reason, or recurring share-friction evidence.
- PC-44 / PC-50: need a fetch approach measured at 90%+
  across a representative store panel.
- PC-23 / PC-24 / PC-25 / PC-26: parked, triggers quiet.
- PC-57: closed FAIL (founder verdict 2026-10-27).

## Founder gates (his actions, not build work)

- His upload experiment (fresh uploads on the current
  BiRefNet flow) feeds this sprint's validation.
- Phone-validation backlog: Sprint 24 cards, fix buffers,
  PC-41's shop-attach verdict, render-batch re-check.
