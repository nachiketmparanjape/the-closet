# PC-27 design: "Score my outfit" AI critique

**Status:** validated by founder 2026-10-17 — building.
**Decisions:** tone is honest-but-kind (never brutal); scoped to
manual/photo outfits only — critiquing a stylist pick is the model
second-guessing its own scores, no signal.
**Lane:** Stylist ("pick the right outfit for the moment") — critique is
stylist judgment applied to a fixed outfit, not a new pick.

## The flow

1. **Entry:** an "AI take" button in the outfit view, shown only where
   `appScores` is absent (manual + photo outfits). Stylist outfits already
   carry scores — no button, no duplication.
2. **New callable `critiqueOutfit`:** input `{outfitId}`. Reads the outfit,
   its items, and the style profile, then prompts the model with a
   critique frame — explicitly *not* the pick rubric:
   - "You did not pick this outfit. Critique it honestly: score the same
     sub-dimensions (color, formality, weather, proportion, occasion)
     0–10, then 2–3 sentences of honest critique. Do not flatter; name
     the weakest link."
3. **Storage:** an app-rater rating doc (`rater: "app"`,
   `targetKind: "outfit"`, `targetId`, `score`, `note`) with
   `ratingKind: "critique"` — reuses the existing ratings machinery, and
   the kind label keeps it out of the reflection path (`"reflection"`)
   and out of the pick-calibration metric (which compares predicted
   confidence vs *user* scores only).
4. **UI:** the existing PC-17 score chips render the sub-scores with an
   "AI critique" label + the critique text beneath. Re-tapping "AI take"
   regenerates (latest wins — a critique is an assessment, not a fact;
   the append-only rule covers wears/ratings-as-events, and the doc
   history stays readable).
5. **Never auto-triggered, never blocks saving.** Explicit tap only.

## Why a separate prompt path (not the pick rubric)

The pick rubric is optimized to *choose* — it rationalizes its own
selection and scores run hot (benchmark: 8–10). A critique needs the
opposite stance: adversarial honesty toward a fixed outfit. One prompt
cannot do both jobs.

## Open questions for the founder

1. Tone: "honest but kind" vs "brutally honest"? (Default: honest but
   kind — brutal is a setting, not a default.)
2. Should a critique also be allowed on stylist-picked outfits
   (second opinion), or strictly manual/photo?
