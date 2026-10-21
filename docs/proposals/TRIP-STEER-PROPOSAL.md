# Trip Steering + Pin Discipline — Proposal

_Founder 2026-10-20: asking the general chat for advice about a
trip next week produced a "Remember as current location?" pin
proposal for the destination. His direction: for trip questions,
the chat should suggest creating a trip object and educate the user
on why working inside it is better — one-off advice stays available,
but pin creation in that case has to be careful. This proposal is
the design; Bramble's recommendation is recorded at the end of the
incident section._

## The incident (verified against code + stored data, 2026-10-20)

The user asked the general chat what to wear for a national-park
trip *next week*. The stylist proposed a location pin:

> 📍 Remember as current location?
> Glacier National Park — Trip next week (late October) — Cold,
> likely 30s-40s°F, potential snow — until 2026-11-01

Mechanics that make this wrong, all verified in the current build:

- **Pins have an end date and no start date.** A pin is "active"
  when it is not expired (`validUntil >= today`, server
  `buildStylistRequest` + client `activePin`). Saving that card
  would have made the destination the user's current location
  *immediately* — a week before the trip — through its end date.
- **An active location pin outranks measured weather.** The prompt
  treats a location/weather pin as the default for scoring, above
  the measured current weather. A week of home outfits would have
  been scored against 30s-40°F and potential snow.
- **Saving replaces the same-kind global pin.** The save flow
  deletes existing global pins of that kind first, so a future
  trip pin would also have evicted whatever current-location pin
  was in place.
- **The framing itself conflates tenses.** The card copy is
  hardcoded "Remember as current \<kind\>?" — for a future fact,
  the honest copy doesn't exist.

What actually got stored from that conversation: nothing for the
location card (it was dismissed), and one **preference** pin
("travels to national parks; prefers lightweight, functional,
packable clothing") — which is correct behavior. Preferences are
timeless; locations are not. And notably, no trip object existed
for that trip: the chat reached for a pin because a pin was the
only durable container it had to offer.

## The principle

**Pins are the present-tense layer. Trips own the future.**

- A pin answers "where are you / what are you like, *now and in
  general*."
- A trip object answers "where will you be, *then*" — it already
  carries dates, destination weather, a packing plan, and (with
  threads-lite live, PC-32 full version pending) its own
  conversation.
- Anything future-dated belongs in a trip. Anything stated as
  current or lasting can be a pin.

## Design (when pulled)

### 1. Trip-intent steering in general chat

When a general-chat message carries trip intent — a destination
plus future timing ("next week", explicit dates, "my trip to…") —
the stylist:

1. **Answers the question anyway.** Steering never gates advice.
2. **Offers an inline trip card** (same propose-and-confirm pattern
   as pin cards): prefilled name / destination / dates extracted
   from the conversation, with two actions:
   - **Create this trip** — creates the trip object, generates the
     packing plan, and offers to continue inside the trip thread.
   - **Just advise me here** — dismisses; the conversation
     continues as a one-off (see §2).
3. **Educates in one line**, on the card, not in a lecture: what
   the trip buys — its own thread, its own weather, a packing
   plan that stays scoped to the trip instead of leaking into
   daily context. Copy is a judgment call; founder validates the
   final wording before it ships.
4. **Asks at most once per conversation.** A dismissal is
   remembered for that thread; no repeat nagging.

Mechanically this is a sibling of the pin proposal: the model may
return a `tripProposal` alongside its reply in general mode,
sanitized server-side (destination string, optional start/end
dates as YYYY-MM-DD, dropped when malformed), rendered by the
client as the confirm card. Trip creation reuses the existing
trips flow (geocode + `planPacking`), so the object lands fully
formed, not as an empty shell.

### 2. The one-off path stays first-class

If the user declines the trip, advice continues in the general
thread with **no durable writes at all**. This works today:
conversation-stated weather/location already outranks pins and
measured weather in the priority order, so a one-off "what do I
wear in Glacier next week" needs nothing stored. The thread's own
history carries the context for as long as the conversation lasts.

### 3. Pin discipline (prompt rules, general + trip modes)

The pin-proposal rules gain a tense check:

- Propose a **location/weather pin only for a fact that is true
  now** ("I'm in Tahoe until Sunday", "it's snowing here").
  Never for a place the user is not at yet, no matter how good the
  extracted end date looks.
- **Preference pins are unaffected.** Lasting facts surfaced by
  trip talk ("I pack light for national parks") stay proposable —
  they were the correct half of the incident.
- When trip intent is detected and no trip object exists, the
  steering card (§1) is the proposal — a pin proposal for the
  same fact is suppressed, so the user never sees two competing
  cards for one fact.

This is a prompt + sanitizer change only; no data-model change.
The discipline half could split out as its own (S) cut if planning
wants the guardrail before the steering UI.

### 4. Rejected: future-dated pins

Adding `validFrom` so a pin "activates" when a trip starts was
considered and rejected:

- It duplicates the trip object — dates, destination, weather —
  in a second, weaker container with no packing plan or thread.
- It needs a new inactive/"upcoming" state in the chip and the
  account list, for facts the trip view already presents better.
- It reopens the context-mixing failure (a global list quietly
  holding other places' weather) that trip-mode pin scoping just
  closed.

**Revisit trigger:** the user repeatedly asks about future trips
in general chat, declines creating trip objects, *and* asks why
the app didn't remember the trip details next time. That pattern
would mean the one-off path is failing, not that pins need a
second tense.

## Relationships

- **PC-32 (chat threads):** steering is the on-ramp to trip
  threads — creating the trip from chat and continuing inside its
  thread is exactly "continuation of context at the right place."
  Works with threads-lite now; better once threads persist.
- **PC-29/PC-31 (trips):** the more a trip object holds (packing,
  tagged shop items), the more honest the education line can be.
- **CONTEXT-1 (Sprint 17 pins):** §3 amends the pin-proposal
  prompt rules; the pin data model is unchanged.

## Open questions (for the planning walk)

1. Intent threshold: destination + explicit future timing only,
   or any "trip" mention? (Recommendation: timing required —
   vague travel talk shouldn't trigger a card.)
2. Card placement: after the advice in the same reply (current
   pin-card pattern), or before? (Recommendation: after — advice
   first, offer second.)
3. Does creating a trip from chat jump straight into the trip
   thread, or stay in general with a "continue there" link?
   (Recommendation: offer the jump as the card's success action;
   don't yank the user automatically.)
4. Education-line copy — founder validates.
