# Closet — AI wardrobe stylist

**Live app: https://closet-404e9.web.app**

## The idea

Your wardrobe, catalogued — and a stylist that already knows what's in it.

Closet turns the clothes you own into a searchable photo catalog, then helps
you decide what to wear: tell it the occasion and the weather, and it suggests
outfits built only from pieces you actually have. No shopping, no generic
fashion advice — just your clothes, organized, and the morning decision made
easier.

It's also a learning project: the app is built in small, shippable increments
("paper cuts") inside a one-person studio system, and every architectural
decision is recorded as an ADR in the project notes.

## What the current version does

- **Photo catalog** — add pieces with up to 4 photos each (front, back,
  detail); the first photo is the cover.
- **Auto-suggested tags at upload** — on-device analysis pre-fills a category
  guess and the dominant color; you confirm or correct before saving. No
  server, no API keys, no cost.
- **Full piece management** — edit tags/category anytime; delete a piece and
  all its photos go with it.
- **Conversational outfit picks** — describe the occasion and weather in
  chat and get outfit suggestions from your catalog.

**In progress:** AI-generated names and rich descriptions for each piece
(material, pattern, formality, warmth) via a backend proxy, so suggestions
get smarter without re-tagging by hand.

## Tech stack

- **Hosting:** Firebase Hosting (auto-deploys from `main` via GitHub Actions)
- **Auth:** Firebase Authentication (Google sign-in)
- **Database:** Cloud Firestore — `users/{uid}/items/{itemId}`
- **Storage:** Firebase Storage — `users/{uid}/items/{itemId}/{file}` (images, ≤ 10 MB)
- **On-device ML:** TensorFlow.js (MobileNet) + canvas color sampling, in the browser

## Repo layout

| Path | What it is |
|---|---|
| `public/index.html` | The built app (single file, exported from the app builder) |
| `firebase.json` | Firebase project config (Hosting + Firestore rules) |
| `firestore.rules` | Database security rules — users can only read/write their own items |
| `storage.rules` | Storage security rules — owner-only image uploads under 10 MB |
| `.github/workflows/` | CI/CD: deploy to live on merge, preview URL on every PR |

## Updating the app

1. Export the latest build and copy it to `public/index.html`.
2. Commit and push to `main`.
3. GitHub Actions deploys automatically — no manual step.

Pull requests get a temporary preview URL so changes can be reviewed before merge.

> **Note:** CI deploys Hosting only. If you change `firestore.rules` or
> `storage.rules`, publish them separately with a reviewed manual deploy
> (`firebase deploy --only firestore:rules,storage`) — security rules are
> never auto-published by the pipeline on purpose.

## Security notes

- The Firebase client config in `public/index.html` is public by design.
  Real security lives in `firestore.rules` and `storage.rules`.
- The deploy service account key is stored as a GitHub Actions secret
  (`FIREBASE_SERVICE_ACCOUNT_CLOSET_404E9`) — never committed.
