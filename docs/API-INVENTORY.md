# API & Technology Inventory

> **Purpose:** REFERENCE — anyone (founder, collaborator, future agent) asking "which API or model does this part of the app use?"
> **Earns its place if:** a reader can answer that question in under a minute without grepping the code.
> **Owner:** Bramble. **Status:** living.
> **Last verified:** 2026-10-29, against `functions/*.js` source.

Every external API, hosted model, and local library the app depends on,
in one place. Terms are explained at first use. Costs are unit prices;
the in-code price table is `functions/pricing.js` (OBS-3) and the
running cost sheet is the "Studio unit costs" Google Sheet.

Status words: **live** (in the production path), **paused** (evaluated,
not currently called), **local** (runs inside our functions, no API).

## AI models and APIs

| Technology | What it does in the app | Code | Unit cost | Status |
|---|---|---|---|---|
| SAM 3, community build `yodagg/sam3-image-seg` (via Replicate) | Cuts each garment out of an outfit photo — one segmentation call per garment (PC-36 multi-garment flow) | `functions/sam.js`, called from `functions/parse.js` | ~$0.0019 per garment run | live |
| BiRefNet `sprited/birefnet` (via Replicate) | Removes the background from a single-garment photo (the "add a piece" flow) | `functions/birefnet.js`, `functions/extract.js` | $0.000225/sec (T4 GPU) | live |
| Gemini 3.5 Flash (via Vertex AI, global endpoint) | The app's vision-and-language model: catalogues a garment (name, category, colors), lists the garments in an outfit photo, judges photo orientation, powers the stylist chat | `functions/describe.js`, `functions/parse.js`, `functions/extract.js`, `functions/extractcheck.js`, `functions/stylist.js` | $1.50 input / $9.00 output per 1M tokens | live |
| Vertex multimodal embeddings `multimodalembedding@001` | Turns a garment render into a vector (a list of numbers describing the image) so the app can propose "this looks like a piece you own" by cosine similarity | `functions/parse.js` | ~$0.0001 per image | live |
| Replicate Files API | Temporary public image hosting, so Replicate models can fetch their inputs | `functions/sam.js` (`uploadInputImage`) | free (part of Replicate) | live |
| SAM 3, official `fal-ai/sam-3/image-rle` (via fal) | Evaluated as a faster alternative to the Replicate community SAM build (no cold starts, pay per call) | spike `spikes/pc36-fal-spike.js`; connector `~/workspace/custom-connectors/custom.fal/` (local, not in this repo) | $0.005 per call | paused 2026-10-28 (connector returns 401: the saved key is valid, but the connector cannot send fal's required `Key ` auth scheme) |

Notes:

- The official `meta/sam-3` model is not published on Replicate, so the
  community build `yodagg/sam3-image-seg` is the adopted SAM 3
  (decision 2026-10-27, re-confirmed 2026-10-28).
- Gemini history: the 2.5 family retired 2026-10-20; 3.5 Flash was
  probed live on the app's exact request shapes before adoption (see
  `functions/describe.js` header). The 3.x family only serves from
  Vertex's global endpoint — never re-point it blind.
- A full 3-piece outfit photo costs about $0.0375 end to end
  (PC-36 design doc, § Cost).

## Google Cloud / Firebase (project `closet-404e9`)

| Service | What it does in the app | Status |
|---|---|---|
| Cloud Firestore | All app data: items, outfits, parses (drafts), trips, shop checks, settings | live |
| Cloud Storage | Photos, renders, baked files (`closet-404e9.firebasestorage.app` bucket, set explicitly — the default resolver does not find it) | live |
| Cloud Functions, 2nd gen (`us-central1`) | The API backend: callable functions plus the scheduled draft advancer | live |
| Firebase Hosting | The web app itself (`closet-404e9.web.app`) | live |
| Firebase Authentication | Anonymous-first sign-in; upgrade later to Google or email link on the same account | live |

## Local libraries (no API, run inside our functions)

| Library | What it does | Code | Status |
|---|---|---|---|
| sharp | Image resize, rotate, trim, normalize | throughout `functions/` | live |
| pHash | Perceptual hash for duplicate and near-duplicate detection (PC-19's hash space) | `functions/phash.js` | live |
| Mask-gate heuristics | Free checks on cutout quality (coverage, edges) before a draft is ever shown | `functions/imagenorm.js` | live |

## Third-party assets

| Asset | What it does | Status |
|---|---|---|
| Unsplash (`images.unsplash.com`) | Sample/demo photos on the home tab's empty-state card (labeled sample — never real user data) | live |

## Keeping this true

- Change the model or API → update this doc in the same commit.
  The doc-honesty checker (`hosting/scripts/doc-honesty-check.js`)
  and the monthly Studio Doc Review verify it.
- A paused or experimental technology stays listed (with its status
  and why), so a revisit starts from the facts, not from memory.
