# PC-36 design — one photo → wardrobe items + outfit

- **Status:** VALIDATED by the founder 2026-10-28
  (all six questions answered; see "Open questions"
  for the record). Build may proceed. Sprint 25,
  card 1.
- **Owner:** Bramble (design + build), founder (validation).
- **Related:** PC-36 card (`docs/BACKLOG.md`), design sketch on
  GitHub issue #78 (2026-10-28), Sprint 25 plan
  (`docs/sprints/sprint-25/PLAN.md`), render standard
  (Stage C, 4:5 canvas), DATA_MODEL.md v2/v3, PC-34
  (extraction + gate), PC-56 (embeddings), PC-45 (reasoned
  rejection), PC-58 (review gate), PC-13 (photo-parse flow).
- **Code pointers (as of 2026-10-28):** `functions/photo.js`
  (`parseOutfitPhoto`, match-only today),
  `functions/birefnet.js` (`segmentImage`, the provider seam
  to mirror), `functions/extract.js` (`extractGarmentPhoto`,
  `renderPathFor`), `functions/imagenorm.js`
  (`normalizeOrientation`, `alphaStats`, `judgeMask`),
  `functions/extractcheck.js` (layer-2 gate),
  `functions/shortname.js` (`capShortName`),
  `public/index.html` photo-parse overlay
  (`photoParseOverlay`, `photoParseState`).

## The problem, in plain words

Adding clothes one by one is the app's largest cost to a new
user, and it all falls at the start, before the app has given
anything back. One photo the user already owns — a mirror
selfie, a photo of an outfit laid out, a pile of new
purchases — could do the whole job: the pieces enter the
wardrobe and the outfit arrives with them.

Today the app can only do half of this. "Match a photo"
(`parseOutfitPhoto`) recognizes pieces it already knows. It
creates nothing. This card closes that gap: a worn or
multi-garment photo becomes draft wardrobe items plus the
outfit, with the user confirming every AI claim before
anything is kept.

## Principles (carried, not invented here)

1. **AI proposes, the user disposes.** From DATA_MODEL.md:
   every AI-filled field is user-editable, and a later AI
   re-run never modifies or deletes anything the user set.
   Nothing in this flow creates, merges, or logs silently.
2. **Extraction is canonical, never invented.** A render
   shows what was actually seen. A worn photo shows only
   the visible part of a garment, and the render shows
   exactly that — no generative completion of hidden parts
   (PC-57's verdict stands: generation is deferred).
3. **Originals are retained, always.** The source photo is
   never modified or deleted; renders are a display layer.
4. **Nothing fails silently.** Every dropped call, empty
   mask, and failed cut is a visible state with a retry,
   never a quiet omission (OBS-2 doctrine).
5. **Drafts never haunt the wardrobe.** Drafts live outside
   the items collection entirely, so no wardrobe query can
   ever surface an unconfirmed piece (the PC-23 lesson: one
   missed `archived == false` filter and the AI recommends
   ghost clothes).

## The flow

```mermaid
flowchart TD
    A[User opens "Outfit photo"] --> B[Photo uploads]
    B --> C[Parse doc created: status listing]
    C --> D[Gemini lists garments: one call per photo]
    D --> E[One SAM call per garment, async]
    E --> F[Harvest at completion, persist immediately]
    F --> G[Cutout + normalize to Stage C standard]
    G --> H[Layer-1 mask gate: free heuristics]
    H --> I[Orientation verdict per piece]
    I --> J[Draft appears on the review screen]
    J --> K[Matching: pHash, then embeddings]
    K --> L[User confirms or corrects each draft]
    L --> M[Items created + outfit composed]
    M --> N[Optional: Save + log worn today]
```

Stages, in order, with what each one does and what it costs:

### 1. Entry — a dedicated "Outfit photo" door

A fourth option in the "Add an outfit" sheet
(`addOutfitSheet` in `public/index.html`), alongside
"Build manually", "Match a photo", and "Match with
camera": "Outfit photo — one photo, several pieces."
The single-piece path is untouched. The existing "Match
a photo" flow stays for quick match-only logging (it is
the lowest-friction wear logger); this flow is for
creation, not a replacement.

Why a dedicated door instead of auto-detecting by garment
count: auto-routing risks misrouting single-piece photos
into a heavier flow, and the user knows what kind of photo
they hold. Auto-detect is a v2 refinement once the flow
proves out. (Q1, validated 2026-10-28: dedicated door
inside the add-outfit / log-what-you're-wearing CTA.)

### 2. Parse doc — the flow's own record

The client uploads the source photo to the user's
Storage through the existing photo-upload path and
calls the parse endpoint with its storagePath.
Uploading creates `users/{uid}/parses/{parseId}`:

```js
{
  sourcePhoto: { url, storagePath },
  status: "listing" | "cutting" | "review" | "done",
  createdAt: timestamp,
  garments: [ { /* one per listed garment, see below */ } ]
}
```

The parse doc is the review screen's source of truth and
the audit trail. It is never a wardrobe item, so no
wardrobe query, stylist prompt, or packing plan can see
it. Garments are an array on the doc (bounded: the Gemini
list is capped at 8 garments; a longer list truncates with
a note in the UI — a person rarely wears more, and a doc
must stay far from the 1 MB limit). Completed parses are
retained as audit trail (personal scale; no auto-delete
in v1).

### 3. Gemini lists the garments — one call per photo

One vision call on the source photo returns a list of
garments, each with: a type ("jacket", "trousers"), color
words ("black", "mint"), and one distinguishing detail
("graphic print", "open front, tee visible inside").
These three fields become the SAM prompt, color-attributed
("black zip jacket", not "jacket") — the instance-selection
lever proven in the SAM evidence (a bare "jacket" concept
call returned 14 detections in a store photo; attributed
prompts plus a main-subject preference fixed it).

### 4. SAM cuts each garment — async, one call per garment

A new module, `functions/sam.js`, mirrors the
`segmentImage` seam of `functions/birefnet.js` so the host
is a configuration swap, not a rewrite. Per garment:

- **Create** a prediction with the attributed prompt.
  The image reaches Replicate through its Files upload
  API (the path proven in the spikes — never a data URI
  in the prediction input), and the model version is
  pinned at build time from the verified backfill run.
  Never hold one HTTP request open for a whole
  prediction: cold boots on the community build ran ~20
  minutes in the spike evidence (the run itself is ~10
  seconds once warm).
- **Poll** with bounded backoff, then **harvest the moment
  the job completes** and persist immediately. This is law:
  the batch-2 SAM evidence was lost because outputs were
  polled ~90 minutes late and Replicate had pruned them.
- **Cut** from the returned polygon (polygons are enough;
  RLE masks are the fallback) with sharp, then **normalize**
  to the Stage C standard: 1000×1250 canvas, garment
  centered, longest side filling 92% of the frame,
  transparent background.
- **Polygon storage:** polygon JSON lives in Storage at
  `users/{uid}/parses/{parseId}/{garmentId}.json`, not in
  the parse doc — 6,500+ points per garment would bloat
  the doc. The render itself goes to the deterministic
  `users/{uid}/renders/` path (`renderPathFor`, as
  `extract.js` does).

**Instance selection:** from SAM's returned instances,
prefer the largest mask near the frame's center (the main
subject). If the pick is wrong, the review screen is the
correction — the user rejects the draft in one tap. No
silent second-guessing.

**Failure, per piece (never whole-parse):** a boot timeout
retries once with backoff, then that piece shows
"couldn't cut" with a Retry button. A zero-mask result
shows "not found" with Dismiss. Other pieces keep
flowing; a failed piece never blocks the review screen.

### 5. Gates — what runs, what deliberately does not

- **Layer-1 mask heuristics run** (`judgeMask` in
  `functions/imagenorm.js`): free, catches empty and
  broken masks before a draft is shown.
- **The Gemini quality gate does NOT run on drafts.**
  The user reviews every draft with their own eyes —
  that review IS the gate (the PC-58 philosophy: the
  user's eyes for AI-made images). Running a second AI
  judge on top of a human judge buys nothing and costs
  a call per piece. (Open question Q6.)
- **Orientation verdict runs, one per piece.** A vision
  call per piece decides which way is up (collar /
  waistband position). The verdict is applied two ways:
  **baked into the render** at build time (the render
  file itself is upright, as Stage C did), and **as the
  `rotation` field for the original-photo view** (the
  original file is never modified, so its turn is
  display-only). One verdict covers both views, because
  the render is cut from the original. The manual
  per-picture rotate buttons remain the override layer
  on top. (This is the PC-34 layer-3 check, landing
  here first and reused by the flat-photo swap.)

### 6. Matching — propose, never merge

Two layers, in order, both computed on the **render**
(background removed, so the vector describes the garment,
not the scene):

1. **pHash (PC-19):** the 64-bit perceptual hash of the
   draft render against stored render hashes. Hamming
   distance ≤ 5 is a strong candidate — it catches the
   same image lineage. Render hashes are a new photo
   field (`renderPhash`), computed at render time, with
   a one-time backfill over the 69 normalized renders.
2. **Embeddings (PC-56's layer, built here):** a vision
   embedding of the render, compared by cosine
   similarity against stored render embeddings
   (`renderEmbedding`, same backfill). Bands, as
   starting values to tune on the founder's photos, not
   calibrated truths: ≥ 0.85 proposes a match, 0.70–0.85
   shows "possibly", below that the draft is new.
   Similar-but-different garments (two plain white tees)
   are indistinguishable to any visual system, so **no
   threshold ever earns auto-merge or auto-link**.
   Under uncertainty the default is always NEW, and
   every match is user-confirmed with both renders side
   by side.

**Rejection, made durable:** confirming "no, different
piece" writes `{ draftEmbedding, itemId, createdAt }` to
`users/{uid}/match_rejections`. The matcher excludes an
item when any stored rejection embedding for it is within
cosine ≥ 0.97 of the draft embedding — deliberately far
above the 0.85 propose bar, so suppression fires only on
near-identical renders (essentially the same photo
lineage). The tension: a lower bar would wrongly
suppress true matches of near-duplicate garments (two
plain white tees). The residual cost of a missed
suppression is a duplicate item, which the user deletes;
the cost of a false merge would be a lost piece. So the
bar stays high and the sketch's promise ("never proposed
again") holds for the cases that matter — the same piece
photographed again — while near-duplicates stay
proposable. This is the mechanism's honest limit, not a
footnote.

**Embedding provider (open question Q2):** recommendation
is Vertex multimodal embeddings — the project already
calls Gemini through Vertex, so no new vendor or key.
Replicate CLIP is the fallback. Price is confirmed at
build time and recorded in the studio cost sheet; it is
deliberately not estimated here.

### 7. Review screen — the surface that makes it safe

A full-screen sheet (the app's rule: windows are bottom
sheets, or full-screen for workspaces like this one):

- **Top:** the source photo with tappable outlines
  around each detected garment (SAM's boxes, scaled to
  display). Tapping an outline focuses that piece's
  card. Pieces appear progressively as their SAM jobs
  finish — a "still cutting…" state, never a spinner
  that pretends otherwise.
- **Below:** one card per piece — render, AI name,
  category, status ("New" / "Looks like your X" /
  "Needs a look"), and inline actions: **Confirm as new**
  / **This is X** (from candidates) / **Not a garment**
  / **Fix details** (name + category editable inline;
  colors come from the Gemini guess and stay editable
  later in item detail, where editing already exists —
  keeping the card light is deliberate).
- **Low-confidence cuts are shown**, labeled "not sure
  what this is", never hidden. Hidden AI work is
  uncorrectable work.
- **No bulk confirm in v1.** Each draft deserves eyes;
  a "confirm all" button would reintroduce silent
  creation through the back door. (Open question Q5.)
- **Known edge, stated not solved:** if Gemini lists two
  garments with identical descriptions, both SAM calls
  return the same mask and the review shows duplicate
  drafts. v1 behavior: the user dismisses the extra.
  A dedupe pass is a follow-up, not a launch blocker.

### 8. Confirm — what gets written, and where

Confirming a draft creates a real item with the usual
shape (DATA_MODEL.md v2): name, category, colors with
`source: "ai"` entries, `shortName` via `capShortName`,
and `photos` with one entry — the source photo itself
(`{ url, storagePath, renderStoragePath: <draft render>,
renderStatus: "passed", source: "photo-parse" }`).
The cover is that source photo, so the detail view's
clean/original toggle reads exactly as it does today:
clean shows the piece's render, original shows the whole
outfit photo it was cut from. The `ai` block holds the
guesses, and provenance records the parse id. AI guesses
stay editable; user edits outrank them forever (the
authority rule).

Confirming a **match** does two things: the outfit uses
the existing item's id, and the source photo is appended
to that item's `photos` — never as cover — as
`{ url, storagePath, renderStoragePath: <draft render>,
renderStatus: "passed", source: "photo-parse" }`
(additive `source` field; absent means an original
upload). The draft render becomes that photo's render,
so the matched item's detail view shows the piece clean
and the outfit photo original, like any item. Rationale:
it reuses the photo manager, rotation, and render
machinery instead of a second photo system. (Open
question Q3.)

Confirming the set creates the outfit in the exact
shape the existing photo-parse save already writes
(`savePhotoParseOutfit` in `public/index.html`):
`versionGroup` = doc id, `version: 1`, `itemIds` =
confirmed items (new + matched), `itemNames` snapshot,
`source: "photo"` (the enum already carries this value
in shipped code; DATA_MODEL.md's v1 enum is stale on
this point), `photoUrl` = the source photo,
`appConfidence` null — the user composed it, the app
did not predict it, so there is no prediction to score —
plus `dedupHash`, and the same dedup check that today
says "This exact outfit is already saved." Occasion
stays editable later; save is one tap, not a form.
**Save + log worn today** reuses the same pattern: a
wear event with `articleIds` populated and `outfitId`
set.

## Cost (honest, from the studio cost sheet)

Per 3-piece photo, at Oct 2026 prices and assumed token
counts. The list and gate token counts are the sheet's
existing assumptions; the orientation row (2000 in /
500 out per piece, same as the gate check) is a new
assumption, added to the sheet's assumptions block when
the build lands:

| Step | Cost |
| --- | --- |
| Gemini garment list (1 call) | ~$0.009 |
| SAM, 3 runs | $0.0057 |
| Orientation verdicts, 3 calls | ~$0.0225 |
| Embeddings, 3 pieces | TBD at build time |
| **Total** | **~$0.037 + embeddings** |

Note: the cost sheet's PC-36 row ($0.0147) counted the
list + SAM only. It will be updated to this fuller math
when the build lands. At experiment scale the whole
photo costs less than a nickel; the decision that
matters is capability, not cost, until volume grows.
The 5,000-images-a-month self-host trigger still stands.

## Security and privacy

- No new personal data: the source photo, renders, and
  drafts are the user's own wardrobe data, already in
  their Firestore and Storage, under the existing
  owner-only rules.
- No new external destinations: Replicate (SAM),
  Vertex (Gemini + embeddings) — both already in use.
  No new keys beyond the embedding call's existing
  Vertex access.
- Drafts are the user's data too: the parse docs live
  under their user doc, never shared, never used for
  anything but their review.

## Testing and verification

- Unit tests (suite must stay green): instance
  selection (center-largest wins; attributed prompt
  beats bare concept), harvest-at-completion (a
  completed job's outputs persist before any later
  read), normalization reuse (draft renders meet the
  Stage C canvas), match bands (pHash ≤ 5 proposes,
  embedding bands behave, no threshold auto-merges),
  rejection filter (a rejected pair never re-proposes
  within the band), parse state machine (partial
  failure leaves other pieces usable).
- Founder phone validation is the gate, as always: a
  mirror selfie → drafts with clean renders → confirm
  → wardrobe items + outfit; a worn piece he already
  owns proposes the match instead of duplicating; a
  junk cut rejects in one tap. Server-side checks and
  emulator passes are not verification.
- Spike teardown (standing rule): the spike harness
  (`functions/spike.js`, its export, the spikeRun
  function, SPIKE_KEY) is deleted only after this
  in-app flow validates on his phone.

## Rollout order

1. SAM service + parse backend + review UI behind the
   new "Outfit photo" door (this card).
2. PC-34 flat-photo swap onto the same service, with
   the orientation verdict reused (Sprint 25, card 2).
3. PC-59 part 2, the too-small warning (Sprint 25,
   card 3, same pipeline).

## Open questions for the founder (validation items)

- **Q1 — Entry: DECIDED 2026-10-28.** Dedicated
  "Outfit photo" door inside the add-outfit /
  log-what-you're-wearing CTA (the "Add an outfit"
  sheet), as this doc recommends.
- **Q2 — Embedding provider: DECIDED 2026-10-28.**
  Vertex multimodal embeddings (the recommendation).
  Price confirmed at build time.
- **Q3 — Matched photo: DECIDED 2026-10-28.** Append
  to the item's photos as a non-cover entry (the
  recommendation).
- **Q4 — SAM hosting for the build: DECIDED
  2026-10-28.** Community build first with fal as
  fallback (the recommendation).
- **Q5 — Bulk confirm: DECIDED 2026-10-28, reading
  flagged.** The founder's "Yes" is recorded as
  accepting the recommendation — per-card only in v1,
  no "confirm all new" button. If he meant the
  opposite, one word corrects this line.
- **Q6 — Gate on drafts: DECIDED 2026-10-28.** Skip
  the automated gate for PC-36 v1 drafts — the
  founder's review is the gate. The automated check
  becomes its own card, PC-60, designed later with
  research behind it (web literature + his manual
  checks as the calibration set). The founder's
  reasoning: an automated check will be needed at
  some point, so plan it properly rather than
  rushing it into this sprint.
  - The gate, in plain words: today, when a flat photo
    is cut, the app runs a second automated check — a
    Gemini call that looks at the cut and judges
    whether it looks right — before the result is
    shown. That check is the "quality gate."
  - For PC-36 drafts, this doc recommends SKIPPING
    that automated check, because the founder reviews
    every draft with his own eyes on the review screen
    — his eyes are the gate. A bad cut still shows up;
    he rejects it in one tap.
  - Running it anyway would mean: bad cuts get
    flagged (or held back) before he sees them, at one
    extra AI call per piece (~$0.0075), with the small
    risk that the judge occasionally doubts a good
    cut. The question is whether he wants that second
    opinion in front of his own review, or is happy
    with just his review.

## Alternatives considered (and why they lost)

- **BiRefNet for this flow:** it cuts the dominant
  subject, not a named garment. It cannot do this job
  at any price. It stays PC-34's flat-photo engine and
  the fallback where SAM finds nothing.
- **Template + overlay matching:** closed at the
  founder's SAM verdict (2026-10-27) — SAM answered
  both use cases, so the head-to-head is moot.
- **Generative completion of hidden parts:** rejected
  by the catalog's promise — the picture IS the user's
  piece. A half-hidden garment renders half-hidden,
  labeled by what it is.
- **Auto-merge on high similarity:** rejected — a false
  merge deletes a real piece from the wardrobe. No
  threshold earns it.
- **Drafts as items with a status flag:** rejected —
  every wardrobe query would need a filter, and one
  missed filter surfaces ghost clothes (the PC-23
  lesson). A separate parse doc cannot leak.
- **Polygons in the parse doc:** rejected — doc bloat
  toward the 1 MB limit. Storage is the right home
  for 6,500-point polygons.
- **One orientation call for the whole photo:**
  rejected — in a worn photo each piece can sit at a
  different angle. The verdict is per piece.

## Implementation notes (added during build, 2026-10-28)

These record decisions the build had to make that the
design left open. They do not change the user-facing
design above; they pin the machinery down.

- **Poll driver.** The client drives polling: it calls
  `pollOutfitParse` every few seconds while the review
  sheet is open, and again when the sheet reopens. A
  parse left mid-flight resumes instead of restarting.
  No request ever waits out a SAM boot.
- **Rotation fields are degrees.** The client's
  `photoRotationDeg` reads numbers, so the verdict
  maps to degrees (none 0, cw90 90, ccw90 270, flip180
  180). `renderRotation` is set explicitly to 0 on
  draft/matched photo entries — the render is baked
  upright, and leaving it unset would make the clean
  view fall back to `rotation` and double-turn it.
- **Embeddings via Vertex REST.** The GenAI SDK's
  embedContent does not cover the publisher model, so
  the pipeline calls the
  `multimodalembedding@001:predict` REST endpoint
  (us-central1 default, `VERTEX_EMBED_LOCATION`
  override), authenticated by ADC. The render goes in
  composited over white, the same ground as the hash.
  Price is filled from billing when the first real
  calls land — it is not estimated here. An embedding
  failure soft-fails to pHash-only matching; it never
  blocks a piece.
- **Baked source stored.** `startParse` stores the
  EXIF-baked source bytes under the parse
  (`parses/{id}/source-baked.*`) so `advanceParse`
  cuts from exactly the pixels the polygon
  coordinates were measured on, without re-baking.
- **New error catalog keys.** `SAM_FAILED`,
  `SAM_NOT_CONFIGURED`, `RENDER_FAILED`,
  `PARSE_NOT_FOUND` (see `functions/errors.js`).
