# BUG-1 — pre-diagnosis brief (prepared 2026-10-11, before Sprint 2 opens)

Diagnosis-only card. This brief narrows the search from the code; it does
not claim a cause. Source: `public/index.html`
(the live app, single-file build), read 2026-10-11.

## What the code establishes (no founder recall needed)

1. **A bounce mid-upload means the piece was lost, not saved.**
   The upload handler uploads photos to Storage one at a time
   (`uploadOne`, ~line 1049) and only writes the Firestore item in
   `saveDoc()` *after* the last photo finishes (~line 1022). There is no
   draft/partial doc. So if the page died during upload, no item can exist
   for it — the "saved or lost?" question is answered by the code for any
   bounce that happened before the final save step.
2. **A bounce leaves evidence behind: orphan Storage files.**
   Photos upload under `users/{uid}/items/{docId}/…` before the doc
   exists, and cleanup only runs on an explicit upload error — not on a
   crash/reload. A crashed upload should leave a Storage folder whose
   docId has no matching Firestore item.
   **Decisive check for the build session:** list Storage under
   `users/{uid}/items/` and compare folder ids against Firestore item
   ids. Orphan folders ≈ the bounced uploads, with timestamps and file
   sizes — this can confirm the Oct 5 incidents objectively instead of
   relying on memory.
3. **Photos upload at full original resolution — no downscaling.**
   `fileRef.put(file, …)` sends the raw file (~line 1056); the only gate
   is the 10 MB per-image check. iPhone originals are large, and up to
   4 photos (MAX_PHOTOS) go up per item.
4. **The auto-suggest path is the memory-heavy part.**
   On photo selection, the cover photo is decoded at full natural size
   into an `Image`, drawn for the dominant-color sampler, and then handed
   at that same full size to MobileNet `model.classify(img)` (~lines
   943–990), with TF.js + MobileNet loaded and kept resident
   (`tagModelPromise` is cached, never disposed). Thumbnails for up to
   4 photos are also decoded concurrently. This runs *before* upload, on
   the same page/session the upload then uses.

## Ranked suspects (unchanged prime suspect, now with mechanism)

1. **iOS Safari memory pressure (jetsam)** killing the web content
   process during/after the full-res decode + MobileNet classify,
   possibly compounding across a session of ~8 uploads with the model
   resident. Symptom fit: intermittent (~2 of 8), mid-flow, app appears
   to "go back" — a crashed tab reloading to the gallery looks like a
   bounce home inside the app.
2. Storage upload of large originals on a weak connection stalling —
   fits less well: upload errors route to `failUpload` with a toast,
   not a bounce, and no error was reported.

## Reproduction plan for the Oct 15 session (headless-first, per studio rule)

- Static: confirm no other code path writes the item doc earlier
  (already checked: `saveDoc` is the only write in the add flow).
- Live-data: run the Storage-vs-Firestore orphan check above.
- Device/headless: upload a set of large (8–12 MB) iPhone-size photos in
  one session with auto-suggest enabled, watching for tab reloads;
  repeat with auto-suggest's classify step skipped to isolate the model.
- Only then write the fix card (likely candidates, *not* pre-decided:
  downscale before upload/classify, classify a small canvas copy instead
  of the full-res image, dispose/release the model between uploads).

## Founder input — downgraded from blocker to nice-to-have

The two open questions (saved or lost? iPhone home screen or gallery?)
were re-asked 2026-10-11. Item 1 above answers "lost" for a mid-upload
bounce, and the orphan check can corroborate it. The home-screen-vs-
gallery answer would still help distinguish a full app/tab crash from
an in-app navigation bug, but diagnosis no longer waits on recall from
2026-10-05.
