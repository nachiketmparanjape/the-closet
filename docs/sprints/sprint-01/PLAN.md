# Sprint 1 — Closet

**Dates:** 2026-09-30 → 2026-10-14
**Status:** all cuts shipped and founder-tested on phone 2026-10-06 — done.
(Definition of done met: shipped via CI/CD + tested on a real device.)

## Cuts

### PC-1: Delete a wardrobe piece (S)
- **Problem:** No way to delete an added piece.
- **In scope:** Delete affordance on the item + confirm step; removes the
  Firestore doc (`users/{uid}/items/{itemId}`) and its Storage image.
- **Out of scope:** bulk delete, undo/restore.
- **Done:** founder deletes a test piece on their phone; gone after reload;
  no orphan image in Storage.

### PC-2: Edit a piece (S)
- **Problem:** Tags/details are permanent after upload; without edit, fixing a
  mistag forces delete + re-upload.
- **In scope:** Edit tags/category on an existing item via the detail view;
  Firestore update.
- **Out of scope:** replacing the photo.
- **Done:** founder changes a tag, reloads, change persists.

### PC-3: Auto-suggest tags at upload (S)
- **Problem:** Manual tagging is the biggest friction in cataloguing.
- **In scope:** At upload, on-device analysis pre-fills category guess
  (TensorFlow.js MobileNet via CDN) + dominant color (canvas sampling).
  No server, no API keys, no cost. User confirms or corrects before saving.
- **Out of scope:** server-side vision APIs, auto-saving without confirmation.
- **Done:** founder uploads a photo, sees pre-filled category + color,
  corrects if needed, saves.
- **Known risk:** general-purpose model, not fashion-trained — guesses will
  whiff sometimes. The confirm step is the design answer.

## Backlog (pull in if time)
- "Surprise me" shuffle: one-tap random outfit suggestion per category
  (deferred from Sprint 1 in favor of PC-3).

### PC-4: Multiple photos per item (S) — added mid-sprint 2026-10-05 at founder's request
- **Problem:** One photo per item can't capture front/back/detail of a garment.
- **In scope:** Up to 4 photos per item at upload (first = cover); thumbnail
  strip in the detail view to flip through photos; delete removes all of an
  item's Storage files. Old single-photo items keep working unchanged.
- **Out of scope:** adding/removing photos on an existing item (upload-time only).
- **Done:** founder uploads a 2-photo item, sees both in the detail view.
- Shipped 2026-10-05, direct to main (quick turnaround per founder request).

### PC-5: Add/delete individual photos + choose cover (S) — added mid-sprint 2026-10-05 at founder's request
- **Problem:** A wrong upload couldn't be removed without deleting the whole piece; and the only way to change the cover was deleting photos until the right one surfaced.
- **In scope:** In the detail view, each thumbnail gets a × delete (with confirm;
  last photo can't be deleted — delete the piece instead); "Add photos" button
  appends up to the 4-photo cap; "Set as cover" promotes the currently-previewed
  photo. Deleting the cover auto-promotes the next one.
- **Out of scope:** reordering photos.
- **Done:** founder deletes a bad upload, adds a missing back photo, and picks a
  cover on an existing item.
- Shipped 2026-10-05, direct to main.

## Notes
- Planning took ~10 min in the wardrobe thread 2026-09-30. Founder swapped
  PC-3 (shuffle) for auto-tagging mid-planning — good use of the swap rule.
- Weather API explicitly deferred (overengineering for v1) — see VISION.md.

## Retro (2026-10-11)

**Scoreboard:** planned 3 cuts, shipped 6 (PC-1–PC-5 + color fix), all
founder-tested on phone 2026-10-06. Definition of done met with days to spare.

**What worked**
- All-S sizing: every cut shipped the day it was picked up. Small ships.
- The mid-sprint pull-in rule: PC-4/PC-5 joined without a replanning
  ceremony, exactly as designed.
- Research before building: the article-understanding research killed
  multi-photo AI and embeddings before a line of code; the one-call decision
  it produced is what Sprint 2 builds.
- PR #1 up front verified the whole GitHub → Firebase pipeline before the
  stakes were real.

**What hurt → what changed**
- PC-4, PC-5, and the color fix went straight from chat to `main`, skipping
  triage. The color fix shipped off a *question* ("would 3–5 colors help?"),
  not a request. → Fixed 2026-10-05: the triage gate in the playbook + the
  `studio-triage` skill; workflows codified as a studio-wide concept.
- The one real bug (upload bouncing to home screen, 2 of 8, 2026-10-05) sat
  undiagnosed for days because its two diagnostic questions never got
  answered. Lesson: a bug without answers stalls silently. → Sprint 2
  carries it as a diagnosis-first card (BUG-1) with the questions inside
  the card.
- On-device category guesses hit their expected ceiling. Not a tuning
  problem — the decided fix is the AI description (Sprint 2), gated on the
  founder's Blaze decision.
- The weekly build sessions carried the system-design learning track
  (concept note + homework + quiz per session). Retiring that cadence on
  2026-09-30 silently retired the learning with it — nobody decided to
  drop learning; the vehicle just vanished and the goal went quiet for two
  weeks. Process change ≠ goal change: when a cadence dies, name what it
  was carrying. → Learning lane restored inside the sprint loop for
  Sprint 2 (see its plan).

**Retro question** ("what should we change about how we work?"): answered by
the triage gate + workflow registry, already in the playbook. No further
change this retro.
