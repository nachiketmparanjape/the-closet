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

## Loop — "learn without nagging"
- **Owner:** Bramble. **Metric:** suggestion acceptance rate (confirmed vs
  dismissed style-note suggestions).
- **Covers:** post-wear rating UI, reflection, evidence-backed preference
  suggestions, style profile.
- **Contracts in:** wear events + ratings (with predicted confidence) from
  Outfits; writes confirmed preferences → Stylist honors them.

## Anti-silo rule
A cut that deletes a seam between lanes outranks lane-local polish.
Lane metrics are reviewed at sprint planning; a metric going red
promotes that lane's backlog to the top of the ranked list.
