# Visual Redesign + Design System — Proposal

_Founder 2026-10-20: the app "looks extremely rudimentary
compared to modern apps." It has to feel modern and seamless —
feeling is directly related to whether someone wants to use an
app — and because this product carries an unusually high initial
overhead (a user must add their clothes before anything works),
everything after that overhead has to be really good. This
proposal is the design-first plan. Nothing here builds until the
founder validates a visual direction._

## Diagnosis (why it feels rudimentary today)

- **Grown, not designed.** Every feature arrived as a functional
  sprint and brought its own card. Pin cards, trip cards, shop
  cards, sheets and chips are cousins, not siblings — similar
  jobs, visibly different executions.
- **No component language.** Buttons, cards, sheets, list rows and
  empty states are re-invented per feature in one 3.2 MB
  single-file client (`public/index.html`). There is no kit to
  reuse, so consistency depends on memory.
- **No motion language.** Modern feel is largely consistency of
  spacing/typography plus how things move: transitions, sheet
  behavior, loading skeletons. The app has spinners and instant
  state swaps.
- **The identity is real but thin.** A custom serif/sans pairing
  and an accent color exist; they're applied unevenly, so the app
  reads as a prototype of itself.

## Approach: system first, screens second

1. **A living design document** (`docs/DESIGN.md`, same pattern
   as `docs/PERSONALIZATION.md`): tokens (type scale, spacing
   rhythm, color, radius, shadow), the component kit (button,
   card, sheet, chip, list row, empty state, toast), motion rules
   (durations, easing, what animates and what never does), and
   state patterns (loading = skeletons, errors, empty states).
2. **Direction before rollout.** 2–3 visual directions, each
   mocked on one real screen (the wardrobe grid — the screen
   users live in). Founder picks. Look-and-feel, placement and
   wording are the founder's calls; the system records them.
3. **Screen-by-screen re-skin**, behavior-preserving, in
   priority order: wardrobe grid → chat → outfit result → item
   detail → trips → shop list → settings. Each screen is a
   normal sprint cut on top of the system, phone-verified per
   the standing gate. Flow changes, where a screen's *behavior*
   (not just its look) should change, are separate decisions —
   the re-skin doesn't smuggle them in.
4. **First-run is one of the screens** (see the onboarding
   proposal): the empty-wardrobe experience gets designed with
   the system, not after it.

## The framework question (founder 2026-10-20)

Should the client also move off the single-file vanilla build to
a component framework — and if so, when? The founder's instinct:
if it makes long-term life easier, sooner rather than later.
Here is the honest ledger.

### What "rebuild" means, precisely

A **client port**, not a product rewrite. The Firebase backend,
Cloud Functions, Firestore data model, rules and auth design do
not change. The 3.2 MB single HTML file becomes a built project
(modules, components — a boring, mainstream stack chosen at spike
time) that renders the same screens against the same backend.

### Benefits

- **The design system becomes code.** Components exist once and
  are reused; today the same card is copy-varied per feature,
  which is the root cause of the rudimentary feel.
- **Testability.** Today the client test suite works by
  regex-extracting pure functions out of the HTML file — fragile,
  silent when it breaks. Real modules get real unit tests.
- **Maintainability, by humans or agents.** Standard structure,
  modules with names, a build/typecheck step that catches what
  grep can't. This is also the agent-agnosticism play: any future
  tool reads a normal codebase faster than a 3.2 MB file.
- **Performance.** Code-split bundles instead of parsing 3.2 MB
  up front on a phone.
- **Future surfaces get cheap.** A shareable outfit page, a
  native shell, an embed — all want shared modules, not a slice
  of a monolith file.

### Risks

- **Porting bugs in the fiddly flows.** The dangerous parts
  aren't the grids; they're anonymous auth + account upgrade +
  guest migration, Firestore listeners, and in-flight state
  (chat threads, trip packing). These port last and slowest,
  behind the phone-verification gate.
- **Double work if sequenced wrong.** Re-skinning a screen in
  vanilla and then porting it pays twice. The decision point
  below exists to bound exactly this.
- **Bandwidth.** A port competes with OBS-2, PC-32, PC-33 and
  everything user-facing for the same one-man-studio hours, and
  it is invisible to users — nobody stays for a framework.
- **Hidden coupling.** A 3.2 MB file grown over months has
  globals and ordering assumptions nobody wrote down. Ports
  always find them; the estimate must assume it.
- **Choice risk.** Frameworks churn. Mitigation: pick the
  boring, widely-adopted option at spike time; the port targets
  our component kit, not framework idioms, where practical.

### The timing tension

Every feature added to the single file (persisted threads,
trip steering, whatever comes next) is one more thing to port —
**the cost of waiting grows monotonically**, which argues for
sooner. But rebuilding *before* the design system exists means
designing inside the rebuild (two risks multiplied), and porting
flows the redesign might delete is waste. Both halves are real;
the decision point threads them.

### Decision point (proposed, for the founder to ratify)

**Evaluate at the first planning walk after (a) `docs/DESIGN.md`
is validated and (b) the first two screens are re-skinned on it**
— with evidence, not vibes:

- **A timeboxed spike:** port the wardrobe grid alone into the
  candidate stack, behind a flag, against the real backend.
  Measure port effort vs. the vanilla re-skin effort for the
  same screen, test coverage gained, and phone load delta.
- **GO if** the spike's port effort is ≤ ~1.5× the vanilla
  re-skin effort for the same screen **and** at least two of
  these strain triggers are true:
  1. Persisted threads (PC-32) have landed or are in flight and
     single-file state management is genuinely painful, not
     merely ugly.
  2. A second surface (share page, native shell) is planned
     within two sprints.
  3. The regex-extraction test approach has broken or blocked a
     change at least once.
  4. Phone performance is a measured complaint (load/parse
     timing), not an aesthetic one.
- **NO-GO means** vanilla + the design system continues, and the
  question re-opens only at the next trigger — at most one
  re-evaluation per two sprints, so the studio doesn't pay a
  standing "should we rebuild?" tax.
- **If GO:** strangler pattern, never a freeze. The new shell
  takes over one screen at a time; the old file shrinks;
  every sprint still ships user-visible value; auth and data
  layers port last, with the strictest verification.

## Open questions (for the planning walk)

1. Ratify or amend the decision point + GO criteria above.
2. Which two screens re-skin first — wardrobe grid + chat, or
   grid + outfit result (the "magic moment" screen)?
3. Does the redesign get its own sprint batch, or interleave
   one screen per sprint alongside feature work?
   (Recommendation: its own batch for the system + first two
   screens — momentum matters for feel — then interleave.)
4. Dark mode: in scope for the system tokens from day one
   (cheap if tokenized early, painful retrofitted)?
