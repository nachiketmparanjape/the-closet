# Closet — AI wardrobe stylist

A mobile-first web app for cataloguing your wardrobe, tagging pieces, and getting
outfit recommendations. Built as a learning project: every architectural decision
is recorded as an ADR in the project notes.

**Live:** https://closet-404e9.web.app

## Stack

- **Hosting:** Firebase Hosting (auto-deploys from `main` via GitHub Actions)
- **Auth:** Firebase Authentication (Google sign-in)
- **Database:** Cloud Firestore — `users/{uid}/items/{itemId}`
- **Storage:** Firebase Storage — `users/{uid}/items/{itemId}/{file}` (images, ≤ 10 MB)

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
