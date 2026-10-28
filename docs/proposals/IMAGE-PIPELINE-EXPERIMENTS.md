# Image pipeline experiments — plan

Purpose: the plan for the three image experiments the
founder listed on 2026-10-27, in his order. Each
experiment answers one question, with its test set and
its pass bar written down before it runs. An experiment
never ships a feature directly: a pass writes (or
unblocks) the feature card; a fail records its evidence
and closes. The founder judges every result on his
phone, side by side — his verdict is the gate.

The three questions, in the founder's words, restated:

1. Can we crop one garment out of its photo and show it
   in the app, oriented correctly? (Card PC-34.)
2. Can we identify and crop every garment in one photo
   of a person, add them to the app oriented correctly,
   and create the outfit they form? (Card PC-36.)
3. Can we make the Google Photos style of clean image —
   a standardized view carrying the garment's real
   details — for any piece? (Card PC-57.)

## Method notes (all three)

- One vendor, one token. Every model call runs on
  Replicate, through the token the founder added to
  Secret Manager on 2026-10-27. Spikes run server-side
  (small throwaway functions on the same pattern as
  extractGarment), so the token never leaves Google
  Cloud and never passes through chat or a local file.
- Costs are estimates until a run measures them; every
  call is written to the ai_usage ledger (OBS-3), so
  the real per-image cost replaces the estimate after
  the first runs.
- The canonical item picture stays the extracted
  cutout, real by construction. Generated pictures
  (Experiment 3) are labeled, and are never canonical.

## Experiment 1 — one garment, cut out, right way up

- State: built and deployed 2026-10-27 (extractGarment
  live; its token binding and health confirmed from the
  server side). This experiment is the live
  verification, most of which only the founder's phone
  can do.
- Step 0 (done 2026-10-27, before any test): the first
  live check found the pinned Replicate model id
  (zhengpeng-7/birefnet) does not exist — its page
  returns 404. The endpoint is now sprited/birefnet, a
  maintained packaging of the same MIT model, with the
  output pinned to a cutout. Tests updated; the full
  suite passes.
- Test set: the founder adds a few new items as he
  normally would — aiming for one plain top, one
  patterned piece, one dark garment, and the
  sunglasses (the known hard case for edges).
- Pass bar: each added item's picture becomes the
  clean cutout, right way up, edges clean at the size
  the app shows; when the built-in quality gate
  rejects a cutout, the original photo stays and
  nothing looks broken. Failure is safe by design —
  the experiment is judging quality, not survival.
- Cost so far: about $0.001–0.002 per item for the
  cutout, plus a few cents for the vision gate across
  the whole set (estimates).
- Decides: PC-34 ships or returns with evidence. Its
  finishing step (crop, orient, standard framing) is
  Experiment 2's last step, so Experiment 2 waits for
  this pass.

## Experiment 2 — one person photo → the garments + the outfit

- State: prototype approved on PC-36 (2026-10-21);
  SAM 3 chosen as the finder (research, 2026-10-25);
  hosting decided: Replicate (2026-10-26). Not started;
  waits for Experiment 1's pass.
- Test set: three to five of the founder's real outfit
  photos, including one layered or partly hidden
  outfit — the case that decides whether this works.
- Steps: SAM 3 is prompted per garment type ("shirt",
  "trousers", …) and returns one outline per garment;
  each garment is cropped; two finishes are compared —
  the outline alone, and the outline refined by
  BiRefNet — through Experiment 1's quality gate; the
  surviving cutouts are normalized to the standard
  shape (canvas 4:5, garment centered, longest side
  filling a fixed share — the shape measured from the
  founder's wardrobe on 2026-10-25); the app drafts
  one wardrobe entry per garment plus one outfit of
  exactly those pieces; the founder confirms or edits.
  Nothing is kept silently.
- Pass bar: every clearly visible garment is found
  (no miss the founder notices first); separations are
  clean enough that drafts need only small edits; the
  outfit contains exactly the found pieces.
- Cost: about $0.002 per SAM 3 call, one call per
  garment type per photo, plus about $0.001 per
  garment to finish — a few cents for the whole set
  (estimates).
- Decides: whether PC-36 is built as designed, and
  whether BiRefNet stays in this pipeline at all (the
  comparison above is its audition).

## Experiment 3 — the generated standard view (Google-style)

- State: its own card, PC-57, since 2026-10-25.
  Independent of Experiments 1 and 2 — it runs on
  photos the founder already has, whenever he gives
  the word.
- The founder's model of how Google does it, recorded
  as a hypothesis (Google's internals are unpublished;
  the try-off research note covers what is known):
  standardized shapes, with the important cloth
  information from the photos laid over them, giving
  one clean image for every piece. The candidate we
  can actually test today reaches the same output by a
  different mechanism — a general image-editing model
  (Qwen Image Edit) instructed to produce the clean
  view. If it fails the fidelity bar, the
  shape-and-overlay mechanism becomes the next thing
  to scope; it is a larger build and is not assumed.
- Test panel (set on PC-57): one printed-logo piece,
  one patterned piece, one plain piece, the
  sunglasses; each starting from a worn or wrinkled
  photo.
- Pass bar (set on PC-57, before running): side by
  side, the generated view is recognizably the same
  piece; print and pattern survive; no invented
  details appear. The model's license is pinned on
  the card before the run.
- Cost: about $0.003–0.03 per image depending on the
  chosen build's settings — the whole panel, even
  with retries, stays under about a dollar (estimate).
- Decides: a pass writes the feature card for a
  labeled, opt-in generated view (PC-36 consumes it;
  PC-49 — outfit previews on a model — may reuse the
  engine). A fail closes the gated slot on PC-36 with
  the evidence recorded on PC-57.

## Sequence and total cost

Experiment 1 runs now (the founder's next few adds are
the test). Experiment 2 follows its pass. Experiment 3
runs whenever the founder calls it — before, during, or
after 2. Total spend across all three, at the estimates
above: a few dollars at most, most of it Experiment 3
retries.

## Test set received (2026-10-27)

The founder supplied seven photos (his own; a second
person's outfit photos were offered and may follow).
Files live in the user media library under the names
below; at run time they are uploaded to Storage under
`spikes/inputs/` so the harness can pass URLs.

Worn, multi-garment — Experiment 2's test set:
- `IMG_6949.jpg` — mirror selfie, fitting room: light
  quarter-zip sweatshirt, tan chinos, watch. Clean
  separation; the baseline parse.
- `IMG_7257.jpg` — outdoors: olive trucker jacket with
  fleece collar OVER a white top, tan chinos, bright
  running shoes, beanie in hand. The layering /
  occlusion case. Same chinos as IMG_6949 (a
  cross-photo matching datum for later).
- Both are stored sideways (EXIF orientation); the
  runs use orientation-baked copies, as production
  does.

Flat, single garment — Experiment 1-style inputs and
Experiment 3's print panel:
- `IMG_0792.jpg` — white UT tee, large multi-character
  manga print (Jujutsu Kaisen), on a bed, tags on.
- `IMG_0794.jpg` — navy UT tee, One Piece flame print,
  on a bed, tags on.
- `IMG_0797.jpg` — black UT tee, yellow-panel manga
  print (Jujutsu Kaisen), on a bed, tags on.
- `IMG_0850.jpg` — black joggers on carpet (the dark
  garment case).
- `IMG_0852.jpg` — khaki shorts on carpet, wrinkled
  (the wrinkle case).

Panel gaps, accepted for the first run: no patterned
(plaid / striped) worn piece, no sunglasses. The
three flat prints are a harder print-fidelity test
than the planned small logo; the worn panel is plain
pieces plus one occlusion case.

Addendum (2026-10-27, later): the worn-print gap is
closed by `IMG_6624.jpg` — a store mirror selfie: the
mint cat-graphic tee worn under an open black jacket
(the print partly covered), black shorts, slides.
Background: other shoppers (one woman directly
behind, herself in a jacket and trousers) and racks
of hanging clothes — the noisiest parsing case in
the set, and Experiment 3's worn-print case.

## First results (2026-10-27)

The pipe is proven end to end (token → billing →
credit → harness → stored outputs), after an evening
of Replicate mechanics lessons now recorded on the
cards: version-hash creation, a burst-throttle that
punishes probe calls, per-build input shapes (Qwen
wants its image as an array; SAM 3 wants `prompt`).

- Experiment 3 (PC-57) ran first, twice, on the fast
  Qwen build. Cat tee (easy input): faithful, one
  color deviation (grey darkened). Jujutsu Kaisen tee
  (hard input): print survived, garment did not —
  sleeves deleted, a "ZARA" label invented. Detail
  and the license pin are on PC-57's card.
- Experiment 2's engine is the open problem: the
  community SAM 3 build boots slowly (~25 min) and
  crashed on a channel mismatch; a retry on a clean
  JPEG is running. Fallbacks, if it fails again: our
  own pinned SAM 3 deployment, or fal.
- Experiment 1 still waits on the founder's next
  adds in the app (extraction itself is deployed
  with all of tonight's fixes included).
