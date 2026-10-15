# Tech-debt registry

Every shortcut taken in this repo gets logged here the moment it lands —
what, why, and what paying it down looks like. The point isn't zero debt;
it's *known* debt. Unknown debt is what bites.

**Pilot:** this registry is a trial of the [debt-ops](https://github.com/bcanfield/agentic-tech-debt)
discipline, running as a manual practice (no hooks installed — they're
Claude Code-first). Pilot runs through Closet Sprint 3 (ends 2026-11-11);
verdict at the Sprint 3 review.

**Adopt if:** the registry captures real shortcuts that would otherwise
go unrecorded; at least one entry turns into action (a fix, a paper cut,
or a deliberate "accepted"); churn ranking surfaces a non-obvious
hotspot; logging stays under two minutes per entry and never slows a cut.

**Kill if:** the registry stays empty or fills with trivia; entries are
written but never read; it adds ceremony friction; or the existing paper
trail (SHIPPED.md, sprint plans, friction.md) was already doing 80% of
this — redundancy is a kill reason, not a tiebreaker.

The falsifiable core: *did the registry change any decision?*

## How to log

Append to `registry.md`: date, the shortcut in one line, why it was
taken, and the paydown shape (a future paper cut, an accepted
"won't fix", or a trigger for revisiting). Architectural calls get an
ADR in `adr/` instead — the decision, the alternatives, the why.
