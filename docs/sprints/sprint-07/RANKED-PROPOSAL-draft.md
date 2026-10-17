# Sprint 7 — ranked backlog proposal (DRAFT)

Prepared 2026-10-17 (pre-planning draft, founder vetoes). Sprint 6 closed
tonight; sprint dates get set at planning. This is the first ranked
proposal under the new playbook rule ("Prioritization is the PM's job",
founder directive 2026-10-16): every open item scored on user value,
effort, data-model risk of delay, dependencies, and founder energy.

## Open items, scored

**1. PC-21 — Delete a wear history entry (S)**
Founder-reported (2026-10-16): mis-taps append forever and pollute wear
counts and per-article stats. Shape: swipe/tap-to-delete with confirm;
deleting a wear un-counts it from derived stats automatically. Tiny,
same-surface as PC-20, immediate data-quality win. Founder energy: high.

**2. PC-20 — Log a wear on a chosen date (S)**
Founder-reported (2026-10-16): "I wore this" stamps today only; no way
to log yesterday's outfit remembered today. Shape: date picker on the
wear action, defaulting to today; existing entries keep server
timestamps. Tiny, pairs with PC-21 in the same code area. Founder energy:
high.

**3. PC-18 — Outfit dedup: one canonical record per unique combination (S/M)**
Founder explicitly asked for this in the ranked list (Sprint 6 closeout).
Every save mints a fresh doc — saving the same pick twice fragments wear
history, ratings, and version chains across duplicates. **Data-model risk
of delay is the driver here: duplicates compound silently the longer it
ships late.** Shape: content hash over sorted itemIds (+ source) at save
time; "you already saved this exact combination" nudge instead of a
silent duplicate. No new dependencies.

**4. AI-box restyle (XS)**
Leftover from the PC-7 founder phone test (2026-10-14): restyle the AI
suggestion box to match the other hints. Founder-visible polish, near-zero
effort; batch with the wear-history bundle.

**5. PC-22 — Reference articles/outfits in chat (M/L)**
Founder's idea (2026-10-16): @-style reference chips so the chat has
context — "this outfit but warmer", "build around this navy tee". A
reusable component for many future features; generalizes PC-16's implicit
previousPick. Shape: chips in the chat input, payload carries
{articleIds, outfitIds}, server resolves to wardrobe lines + outfit
context. Effort is real and it's design-first; ranked below the quick
data-quality wins but it is the sprint's natural feature piece. Founder
energy: high.

**6. Lane metric instrumentation (S/M)**
The four lanes are defined (docs/LANES.md) but tag acceptance rate and
wear-through rate aren't queryable yet — so the "red metric promotes that
lane's backlog" rule can't fire at planning. Small queries/dashboards;
unblocks the new planning mechanism. PM-driven (supports the playbook),
not founder-pulled.

**7. PC-13 — Outfit photo parsing (M/L)**
Lowest-friction wear logging: photograph today's outfit, AI identifies
garments, human-in-the-loop shortlist matching, outfit doc + optional
wear logged. Valuable, no founder pull, real effort.

**8. PC-14 — Shop compatibility check (M) — ⚠ VISION FLAG**
"Should I buy this?" — photo → wardrobe-fit score with reasoning + gap
analysis. Nice-to-have; no founder pull. **Flagged, not smuggled:**
VISION.md explicitly lists "shopping/commerce" as not-v1, so this one
needs a founder yes to enter the product at all. Ranked at the bottom
until that call is made.

**9. PC-19 — Article duplicate detection (M)**
Founder-parked ("not high priority, on our mind"): warn on same-image
upload, never block (two identical black tees is legitimate). Stays parked.

## Recommended sprint shape

Bundle: PC-20 + PC-21 + AI-box restyle (one wear-history cut, tiny) +
PC-18 (dedup). If capacity and energy allow, PC-22 design doc as the
second thread (build starts after the design is validated — playbook).
PC-19 stays parked per founder.

Constitution check: all items pass VISION.md except PC-14 — shopping/commerce
is an explicit v1 non-goal, so it is flagged at the bottom rather than
smuggled in.

## Evidence for the scores

- PC-18/19/20/21/22 and their shapes: docs/BACKLOG.md (ideas section).
- Founder pull for PC-18 in the ranked list: wardrobe thread 2026-10-17
  (Sprint 6 closeout message).
- PC-20/PC-21 reported by founder with the mis-tap detail: wardrobe
  thread 2026-10-17 ("where is on a random date manually… it will go on
  adding again and again").
- PC-22 as founder idea / future component: wardrobe thread 2026-10-17.
- AI-box restyle leftover: PC-7 founder phone test 2026-10-14.
- Lanes + metrics defined but not instrumented: docs/LANES.md, wardrobe
  thread 2026-10-17.
- Prioritization rule: studio PLAYBOOK.md ("Prioritization is the PM's job",
  founder directive 2026-10-16).
