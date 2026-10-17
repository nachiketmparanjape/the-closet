# Product lanes — the Closet

Per the studio playbook ("product lanes, not product silos"): the work is
organized by lane, the experience stays seamless. Each lane has a job to be
done, an owner, one health metric, and a contract with the lanes it touches.

## Catalogue — "capture a garment faithfully"
- **Owner:** Bramble. **Metric:** AI tag acceptance rate (edits per upload —
  low means the vision call is earning its keep).
- **Covers:** upload, multi-photo, AI description (subtype, style tags,
  colors, brand), item editing, bulk upload, duplicate detection (PC-19).
- **Contracts out:** item schema v2 → Stylist (wardrobe lines), → Outfits
  (itemIds/itemNames).

## Stylist — "pick the right outfit for the moment"
- **Owner:** Bramble. **Metric:** calibration gap — mean(predicted
  confidence) vs mean(user rating) over worn outfits. Positive gap = the
  model runs hot.
- **Covers:** chat UI, askStylist prompt/rubric/handles/slots/scores,
  in-chat iteration (PC-16), benchmark suite.
- **Contracts out:** outfit pick {itemIds, confidence, reasoning, scores}
  → Outfits (save). **Contracts in:** style profile preferences → honored
  in picks.

## Outfits — "keep a trustworthy history"
- **Owner:** Bramble. **Metric:** wear-through rate (saved → worn).
- **Covers:** outfit view, versions, favorites, manual builder, wear logging,
  per-article stats, dedup (PC-18).
- **Contracts out:** wear events + ratings → Loop. **Contracts in:** pick
  schema from Stylist.

## Loop — "capture outcomes faithfully"
- **Owner:** Bramble. **Metric:** rating completion rate (wears that get rated).
- **Covers:** "I wore this" action, wear date picker (PC-20), wear history
  with deletion (PC-21), post-wear rating UI.
- **Contracts out:** wear events + ratings (with predicted confidence) →
  Personalization. **Contracts in:** outfit ids from Outfits.

## Personalization — "the app knows your taste" (pillar, founder 2026-10-16)
- **Owner:** Bramble. **Metric:** suggestion acceptance rate; calibration gap
  (mean predicted confidence vs mean user rating).
- **Covers:** the intelligence layer over recommendations and feedback —
  reflection engine (reflectOutfit), evidence-backed preference suggestions,
  confirm/dismiss flow, style profile storage, calibration logging,
  preference honoring in picks. This is where the smart engineering lives:
  reweighting confidence against ratings, pattern-vs-one-off detection,
  taste decay/refresh.
- **Contracts in:** wear events + ratings from Loop; outfit picks + scores
  from Stylist. **Contracts out:** confirmed preferences → Stylist honors
  them; calibration signals → prompt/rubric tuning.

## Anti-silo rule
A cut that deletes a seam between lanes outranks lane-local polish.
Lane metrics are reviewed at sprint planning; a metric going red
promotes that lane's backlog to the top of the ranked list.
