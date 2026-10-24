# Agent fundamentals → our stylist: a mapping for the sit-down

Companion to AUDIT.md (same folder). The audit says what
our stylist chat actually does today; this note says how
grown-up AI agents — the Gemini app, Claude-class
assistants, agent frameworks generally — structure the
same problems, translated into our scale and our open
questions (Q1–Q9 and disagreements D1–D10 in the audit).

Honesty note: this is pattern-level knowledge of how
agent systems are built (including how I'm built), not
any product's internal documents. The patterns are
stable across implementations even where details differ.

The one-sentence version: **agents treat "what the model
sees" as a designed object with an owner, tiers, ranks,
and a read-back. Ours grew as five-plus mechanisms glued
into one function. Every fundamental below is a facet of
that single difference.**

## F1. One context assembler

**How agents do it.** Before the model is called, ONE
step assembles everything it will see — instructions,
memory, the conversation, tool results — from named
sources, in a deliberate order. That assembled context
is a thing: it can be inspected, logged, tested, and
changed in one place. Nobody assembles context as a
side effect of three different screens.

**Where we are.** Three client call sites hand-build
payloads (chat, composer, Today — audit §1), and the
server then concatenates prompt sections inside a
13-parameter function. The iteration-base merge exists
twice (D3). Adding a context kind touches five places.

**Decision it hands the sit-down.** Name the assembler:
one client step that gathers context *candidates*, one
server step that assembles them in the ranked order
(F5). CONTEXT-MODEL.md describes that step; code
follows it. (Feeds Q5, Q9.)

## F2. Memory tiers, with read/write policies

**How agents do it.** Memory comes in tiers that obey
different rules. *Working memory*: the live conversation
— read fully, dies with the session unless saved.
*Long-term memory*: stored facts and preferences — read
selectively, written only through some gate (the user
says it, confirms it, or an explicit save action),
because a wrong "fact" poisons every future answer.
*Episodic memory*: records of what happened (past
sessions, outcomes) — consulted for patterns, not
recited. The design work is the policies: what each tier
may contain, when it's read, how writes are gated,
when entries expire.

**Where we are.** The tiers already exist, unnamed:
thread = working; pins + style profile + vibe profile =
long-term; wear history + ratings = episodic (the vibe
profile is literally learned from it). Writes are gated
well — pin proposals need confirmation, preferences
enter the profile only on confirmation; that's
agent-grade and worth protecting. Reads are the wild
part: the server loads pins, vibe, and style profile on
EVERY call including the silent morning pick (D6), none
of it visible (D4), and no per-door read policy exists —
a cold chat open and the morning pick drink from the
same firehose.

**Decision it hands the sit-down.** Adopt the tier names
and write the policies: per door (Q1), what long-term
memory is read; per tier, what may be written and by
which gate; expiry rules (pins already expire — say so
as policy, not behavior). (Feeds Q1, Q4, Q9.)

## F3. History is managed deliberately — compaction, not silent cuts

**How agents do it.** Conversations outgrow the model's
window, so agents manage the overflow on purpose: older
turns get summarized into a compact brief ("here's what
matters from earlier"), recent turns stay verbatim, and
the system knows — and often shows — that compacting
happened. The summary is a designed artifact with rules
about what survives (decisions and facts survive; small
talk doesn't).

**Where we are.** The server silently keeps the last 20
messages and drops the rest (D8). No summary, no signal.
Our threads are short today, so this is a cheap fix now
and an expensive retrofit later — the boundary behavior
just needs to be *chosen*: at our scale, an honest
answer might be "the window is N turns; the chat says so
when you approach it; starting fresh is one tap." If
threads get persisted (Q6) and long, compaction becomes
the v2 answer — the model doc should name the trigger.

**Decision it hands the sit-down.** Q7, answered as a
policy with a named v2 trigger.

## F4. Tools: a registry the host validates; proposals everywhere else

**How agents do it.** Capabilities the model can invoke
are declared tools with schemas. The model proposes a
call; the host validates the arguments against reality
(ids exist, values in range), executes, and returns the
result. A malformed call earns one guided retry, not a
crash. Anything that isn't a tool call is just text —
the model *proposing* in words, a human or host step
confirming before state changes.

**Where we are.** Trip mode is already exactly this —
updateTripPacking is validated client-side, executed by
the client, retried once server-side with a hint when
the model's args don't survive mapping. It's the most
agent-grade part of the app. The inconsistency is that
general mode uses a different mechanism for the same
idea: pin proposals ride as a JSON field in the reply
contract (D5), and "learning" (PC-45's style rules)
would need a third. Agent practice says: one mechanism.
Either everything state-changing is a tool-shaped
proposal with validation + confirmation, or the model
doc states why chat gets two.

**Decision it hands the sit-down.** Unify the proposal
mechanism as a named principle in CONTEXT-MODEL.md —
every future capability (PC-38 attachments as input,
PC-41 check follow-ups, PC-45 rules) enters through it,
never as a new prompt mode. (Feeds Q5, Q8.)

## F5. Precedence is a ranked table, not prose

**How agents do it.** Conflicts between instructions
are resolved by an explicit hierarchy — platform rules
outrank developer instructions, which outrank the user,
which outranks stuff the environment (tools, web pages)
claims. The ranking is written down once; behavior
follows from it; when two sources disagree you can
point at the table and say which wins and why.

**Where we are.** Our ranking exists only as persuasive
prose scattered through the prompt: "references outrank
the previous pick," "vibe outranks everything," "stated
weather beats pins beats measured" (audit §4 — I had to
reconstruct the table by reading the whole function).
Prose precedence drifts: every new context kind gets
bolted on with its own paragraph and its own claim.

**Decision it hands the sit-down.** Q5 answered as an
actual table in CONTEXT-MODEL.md — every context kind,
ranked, with its scope (per-door, per-thread) — and the
prompt is then written to *implement* the table, in
section order. New kinds don't merge without a rank.

## F6. The assembled context can be read back

**How agents do it.** Debuggable agents can answer "why
did it say that?" because each turn's context is logged
or reconstructible: which memory items were loaded, what
the tools returned, which instructions were active.
Without that, every weird answer is a guessing game.

**Where we are.** Our observability logs cost per call
(ai_usage) and failures (error_events) — never the
context. The founder-facing version of read-back is the
visibility rule we already hold ("whatever is in the
context should show up"): today it fails for pins (D4)
and can disagree with itself (D2). The builder-facing
version doesn't exist at all.

**Decision it hands the sit-down.** CONTEXT-MODEL.md
names the visibility surface (the proof stack demands
one): user side — one chip row that is the complete,
truthful list of active context, each removable; builder
side — a per-turn context digest (thread key, base,
active pins, vibe source, window state) recorded with
the usage event, readable in the quality report. (Feeds
Q2, Q4.)

## Deliberately NOT importing

- **Multi-agent orchestration / sub-agents.** Our
  stylist is one model, one turn, three tools. Nothing
  to orchestrate.
- **Planning loops.** No multi-step autonomous tasks
  exist in this product; the one retry we run (packing)
  is a repair, not a plan.
- **Retrieval-ranked memory (vector stores).** That
  machinery exists to search memory too big to hold.
  Ours maxes at 20 pins and a handful of preferences —
  fully enumerable. Ranking is a solution shopping for
  our problem.
- **A plug-in/tool platform.** Three tools, one
  registry-shaped list in code is enough; platform
  abstractions are for ecosystems, not one app.
- **On-device model routing** (Alta ships a bridge for
  it): parked with its triggers already; the context
  model just shouldn't forbid a future second tier.

## The mapping, on one screen

| Fundamental | Our gap (audit) | Sit-down question |
|---|---|---|
| F1 one assembler | 3 payload sites, 13-param chain (audit §1, D3) | Q5, Q9 |
| F2 memory tiers + policies | invisible reads, no per-door policy (D4, D6) | Q1, Q4, Q9 |
| F3 deliberate history | silent 20-message cutoff (D8) | Q7 (+ Q6) |
| F4 tools/proposals unified | two proposal mechanisms (D5) | Q5, Q8 |
| F5 ranked precedence table | precedence as prose (D5, D9) | Q5 |
| F6 context read-back | display can lie; no digest (D2, D4) | Q2, Q4 |
