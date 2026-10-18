# Sprint 10 — UX polish

**Dates:** batch pulled 2026-10-17 by founder ("let's do it" — UX polish
track approved following the 2026-10-17 research).
**Status:** in progress — UX-1 running.
**Theme:** the app works; now make it feel designed. Audit first, fixes
ranked from findings.
**Delegation (founder 2026-10-17):** Bramble uses judgment on obvious calls
and executes; anything needing an opinion goes to the founder by message.
**Planning note:** per the no-ad-hoc rule this batch is planned up front.
The audit (UX-1) produces the ranked fix list; fix cuts (UX-2+) are defined
from its findings, not invented here.

## Cuts

### UX-1: Heuristic audit (S)
- **Status:** Shipped 2026-10-17.
- **In scope:** Nielsen's 10 heuristics across every screen and modal;
  automated cross-checks (contrast ratios from the CSS variables,
  touch-target sizes); a pass of screenshots through a free AI audit tool
  for the systematic catches. Deliverable: ranked paper-cut list with
  severity, filed to the backlog.
- **Out of scope:** fixing anything (that's UX-2+); hiring a designer
  (only if the audit leaves big open questions — research recommendation).
- **Done looks like:** every screen has findings or a clean bill; the
  founder vets the ranked list; the top fixes are unambiguous.
- **Size:** S. **Constitution check:** passes.

### UX-2+: Fix cuts (ranked from UX-1)
- **Status:** Shipped 2026-10-17.
- 7 fixes shipped: outfits header wrap, faint contrast, 44px chips/icons,
  hero compaction, FAB redesign as labeled pair, "Ask the stylist" label.
- Defined from the audit's ranked findings. Obvious fixes execute on
  Bramble's judgment per the delegation; opinion-needing calls go to the
  founder first. Each fix ships via CI like any cut.
