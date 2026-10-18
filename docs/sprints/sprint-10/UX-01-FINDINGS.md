# UX-1 heuristic audit — findings (2026-10-17)

Method: Nielsen's 10 heuristics across every screen/modal, plus automated
contrast-ratio checks from the CSS variables and touch-target measurement.
One founder screenshot (outfits view, iPhone) as rendering ground truth.

## Fixed immediately (obvious, shipped 7fb89bc)

1. **Outfits header overflow** — `.catalog-head` was a non-wrapping flex
   row; three action buttons bled off the right edge on phones (visible in
   the screenshot). Now wraps; buttons drop to their own row on narrow
   screens. (Heuristics: aesthetic/minimalist, consistency.)
2. **Light-mode `--faint` contrast 2.98:1** — used for the search
   placeholder and icon; failed WCAG even at large-text level. Darkened to
   #6a6d68 (4.77:1). (Heuristic: accessibility/standards.)
3. **Filter chips 32px touch targets** — below the 44px platform guideline.
   Padding bumped to 12px 16px (~46px). (Heuristic: error prevention.)
4. **Icon buttons 40px → 44px** — same guideline. (Heuristic: error
   prevention.)

## Open — founder opinion needed

5. **Hero dominates the viewport.** "Your wardrobe, laid out." at display
   serif size pushes all function below the fold on phones. Options: keep
   (it's the brand), or compact to a small header once the wardrobe is
   non-empty (full hero only for the empty state). → founder call.
6. **Floating actions clash.** The pink ✨ chat FAB and the Feedback pill
   float over content in a clashing accent against the editorial aesthetic.
   Options: restyle to the design language, move into the header/menu, or
   keep. → founder call.
7. **Chat entry is unlabeled.** The ✨ button carries meaning only via
   aria-label; a first-time user may not discover the stylist. Options:
   text label, one-time coach mark, or leave. → founder call.

## Clean bills

- Filter row already wraps; search + filters layout is sound.
- Builder overlay (guardrails, slot pills, warn-don't-block) is coherent.
- Upload/bulk flows, photo-parse confirm, outfit detail, feedback modal:
  no heuristic violations found in the static pass.
- Contrast: all other text pairs pass AA in both modes (ink 16:1,
  muted 5–9.7:1, accent buttons 5.3:1).
