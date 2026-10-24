# Operations — Closet (living doc)

How the app gets from code to live, and how a broken deploy is
recovered. This pipeline is an important invisible: it is pure
agent-held knowledge today (hard-won, scattered across session
notes), its failures are silent by default — a deploy that
didn't happen looks exactly like one that did — and every
session depends on it. This doc is its design surface: if it
can't be followed from here, it isn't a pipeline, it's a habit.

**Secrets note.** This repo is public. Everything credential-
shaped lives outside it: helper scripts that embed OAuth
constants are gitignored in `hosting/`, tokens live in
`~/.config/` at 600 perms. This doc names files and procedures,
never values.

## The moving parts

| Surface | What it is | How it ships |
| --- | --- | --- |
| Hosting | the web app (`public/`) | manual REST deploy (CI is broken — see below) |
| Functions | 8 callables in `functions/` | `deploy-update.js <fn>`, one at a time |
| Firestore rules | `firestore.rules` | `deploy-firestore-rules.js` (reads the file from disk) |
| Storage rules | bucket rules | REST release, named `firebase.storage/<bucket>` |
| Secrets | Secret Manager | versioned; new versions added by the founder where the credential is his (e.g. Replicate) |
| New function creation | first deploy of a callable | `deploy-create.js` / `deploy-create-extract.js` + a public-invoker IAM binding (below) |

Callables: `describeItem`, `askStylist`, `reflectOutfit`,
`critiqueOutfit`, `parseOutfitPhoto`, `shopCheck`,
`planPacking`, and `extractGarment` (built; first deploy gated
on its Replicate secret version).

## The deploy rules (each one is a scar)

1. **Hosting: manual REST deploy is the working path.**
   `node ~/workspace/wardrobe-app/deploy-hosting-manual.js` from
   `~/workspace/wardrobe-app`. Gotchas it encodes: version config
   wants `glob` (not `source`), rewrites target `path` (not
   `destination`), hashes and upload bodies are over the
   **gzipped** bytes.
2. **GitHub Actions hosting deploy is broken** (since
   2026-10-21: `403 Permission denied … serviceusage.services.get`
   — the CI service account lost a permission). Re-runs fail the
   same way. Until it's restored, a green CI run says nothing
   about hosting. Restoring it is OP-1 below.
3. **Functions: one per foreground call.** A multi-function
   loop in one background process was killed mid-loop by a
   runtime restart (2026-10-23); its outcome was unknown until
   checked function-by-function. Either deploy one at a time in
   the foreground, or verify every function's `updateTime` via
   the Cloud Functions v2 API after any interrupted batch and
   redeploy only the stale ones. Never assume a killed loop
   finished.
4. **Verify against the live surface, then say "live."** After
   a hosting deploy, re-fetch the live URL and grep for a marker
   from the new build (CDN races have produced false readings —
   fetch twice if the first looks stale). After a function
   deploy, the script's own "function updated" plus the API
   `updateTime` are the evidence. A URL is never written from
   memory — verify it against the deployment or fetch it.
5. **A new callable needs a public invoker binding.**
   `deploy-create.js` creates the function but sets no IAM; the
   endpoint then 403s at Cloud Run before the function runs, and
   the client sees a generic INTERNAL. Fix: grant
   `allUsers: roles/run.invoker` on the Cloud Run service (the
   Firebase callable framework does its own auth per request).
   Diagnose: unauthenticated curl → 403 = IAM; 401 = framework
   auth (healthy).
6. **Piped exit codes lie.** `cmd | tail` returns tail's code.
   A failed deploy has read as exit 0 through a pipe (2026-10-15,
   reported "shipped" wrongly). Check the command's own output,
   or `PIPESTATUS`, never `$?` after a pipe when it matters.
7. **Rules deploys read from disk.** `deploy-firestore-rules.js`
   reads `firestore.rules` at deploy time (it once hardcoded a
   stale ruleset that would have regressed every collection —
   only a failing release PATCH prevented it). Release PATCHes
   use the `{ release: { name, rulesetName } }` wrapper; the
   storage release id is `firebase.storage/<bucket>` with the
   slash **not** URL-encoded.
8. **Firebase CLI on this VM needs a config workaround:**
   `XDG_CONFIG_HOME=/tmp/fb-config npx firebase-tools …`
   (`~/.config/configstore` is root-owned). The CLI's own auth
   is unreliable here regardless — the REST scripts above are
   the supported path.
9. **Firestore REST quirk:** `orderBy=createTime` on a document
   list silently returns zero documents. Drop the orderBy; sort
   client-side.
10. **Storage bucket facts:** new projects use
    `*.firebasestorage.app` buckets; the Admin SDK must be given
    the bucket explicitly, and buckets ship with **no CORS
    config** — browser `fetch()` of download URLs needs a CORS
    PATCH allowing the app origins (`<img src>` works without
    it, which hides the gap).

## Recovery playbook

- **Deploy interrupted / outcome unknown:** query each affected
  function's `updateTime` (v2 API). Redeploy only the stale
  ones. (Rule 3.)
- **Hosting looks stale after deploy:** re-fetch the live URL
  after a few seconds; grep a build marker. The manual script's
  "release created" line + a live marker = shipped.
- **Callable 403s / client sees INTERNAL on a NEW function:**
  check the invoker binding first (Rule 5).
- **A function misbehaves after deploy:** Cloud Logging by
  `correlationId` (see OBSERVABILITY.md); roll back by
  redeploying the previous commit's `functions/` — there is no
  versioned rollback button in this pipeline, git is the
  version store (OP-2).
- **Rules deploy failed midway:** the release PATCH failing is
  what *protects* the live ruleset — a failed deploy leaves the
  previous rules live. Verify the live ruleset id before
  retrying.

## Verification standard

A change is "shipped" when: the deploy evidence exists (rule
4), the app was exercised headlessly as far as possible
(build, syntax, tests, live fetches), and the remaining
human-only check is named. The founder's phone is the final
gate for anything user-visible — server-side green is never
called "verified" before that (studio verifier rule).

## Open points

- **OP-1 — Restore CI hosting deploys.** Fix the service
  account's `serviceusage.services.get` permission or replace
  the workflow; then this doc's rule 1 flips back to "CI ships
  hosting" and the manual script retires to fallback.
- **OP-2 — Function rollback ergonomics.** Rollback = redeploy
  an old commit by hand. Acceptable at one user; revisit if
  deploy frequency or user count makes a bad deploy expensive.
- **OP-3 — One-command status.** "What's live right now?" is
  currently three checks (hosting marker, function updateTimes,
  ruleset id). A small `scripts/live-status.js` could answer it
  in one run — build when the question has been asked by hand
  a few more times.

## Code pointers (as of 2026-10-24)

- Hosting: `~/workspace/wardrobe-app/deploy-hosting-manual.js`
  (outside the repo — it reads OAuth constants at runtime).
- Functions: `hosting/deploy-update.js`,
  `hosting/deploy-create.js`, `hosting/deploy-create-extract.js`.
- Rules: `hosting/deploy-firestore-rules.js`.
- Ops scripts: `hosting/scripts/` (reports, probes, repairs —
  one-off repair scripts are kept there as worked examples of
  the REST + OAuth pattern).
- Auth for all of the above: OAuth refresh exchange; refresh
  token at `~/.config/firebase-ci-token` (600). GitHub pushes
  go over HTTPS with a classic PAT (SSH is blocked from this
  VM).
