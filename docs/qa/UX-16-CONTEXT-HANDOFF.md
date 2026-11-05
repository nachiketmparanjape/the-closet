# UX-16 — Context-handoff audit

Date: 2026-11-01. Result: PASS for the inventory audit; close UX-16.
Source inspected: commit 0970817. No application behavior changed.

## Method and limits

The tester ran the local frontend against hosted Firebase services and supplied
request payload excerpts and backend response manifests in the onboarding chat.
These are user-supplied observations, not independently retrieved backend logs.
Remaining entry points were traced in the source. Code inspection is identified
separately below; this report does not claim a complete device or end-to-end test.
The ticket requires each inventory row to carry its subject, be intentionally
subject-free, or have a separate fix filed.

## Inventory and evidence

| Entry point | Required payload | Verification | Result |
|---|---|---|---|
| Today pick → Ask the stylist | `todayPick` (and iteration base `previousPick`) | Manual: manifest had `todayPick.attached: true`, `lookName: Urban Breeze`; reply described warming the starting outfit. Code: `todayAsk` → `askDoor` → `attachTodayPick` → `sendChat`. | PASS; exact original item IDs were not captured for comparison. |
| General chat after Start fresh | No selected Today/shop/trip subject | Manual: `todayPick.attached: false`, `previousPick.present: false`, `shopItem.attached: false`, `trip: null`, one message. Code: `startFreshThread` clears attachments and references. | PASS |
| @ piece reference | `references.articleIds` | Manual: `references.articles: 1`; reply named Black fleece-lined bomber jacket and returned that piece in `outfit.itemNames`. | PASS |
| @ saved outfit reference | `references.outfits` with resolved `itemIds` | Code: `pickRef` stores selected outfit; `sendChat` resolves its versions and includes item IDs; server `sanitizeReferences` validates references against wardrobe. | PASS by inspection; no manual outfit-reference test claimed. |
| Trip → chat | `tripContext` with leg, notes, packing and weather summary | Manual: manifest named Hawaii Trip; payload leg was Maui / Maui, United States, 2026-11-06 through 2026-11-10; `weatherSummary` was highs 67°F, lows 50°F, rain likely. Reply repeated destination, dates, weather and a packing list. Code: `openTripChat` selects trip thread; `sendChat` supplies trip context. | PASS for handoff; individual packing IDs were not compared. |
| Piece card → Build a look around this | `references.articleIds` | Code: card handler calls `buildLookAround(item)`, which uses `askDoor`, pushes the selected piece into `chatRefs.articles`, and opens chat. `sendChat` includes its ID. | PASS by inspection |
| Outfit card → Ask, if present | Selected outfit, if an Ask action exists | Source inventory of `openOutfit`, chat-opening calls and Ask handlers found no dedicated outfit-card Ask door. Saved outfits are referenced through @ above. | Not applicable in inspected source |
| Shop check result / saved check → Ask | `shopItem` | Code: both buttons call `askStylistAboutShop(r)` → `shopItemFromCheck(r)` → per-thread attachment; `sendChat` includes `shopItem` outside trip mode. Server sanitizes it and assembles its facts into the brief. | PASS by inspection; PC-41's persistent follow-up scope remains separate. |
| Wardrobe / global Stylist entry | No new subject implicitly attached | Code: `chatFab` and `tabChat` call `openChat` without attaching a piece. This is a resume door and can retain explicitly attached context in an existing conversation. Manual fresh-chat test above confirms clean state after Start fresh. | PASS; intentionally no new subject |

## Interpretation notes

- `manifest.weather: null` describes general weather context, not the absence
  of trip weather. Trip weather travels in `tripContext.weatherSummary`.
- `previousPick.fromToday: false` alone does not establish a mismatch: the
  client may supply Today’s IDs directly in `previousPick`.
- The manifest proves which context categories the assembler received, but
  does not expose all underlying item IDs or establish forecast accuracy.
- AI-generated internal handles such as `[i4]` appeared in replies. This audit
  records them as observed; response presentation is outside its scope.

## Separate findings

1. Broad destinations resolve to one point without enough clarification.
   Maui resolved to 20.770, -156.268, and the forecast summary was passed
   faithfully to chat. The tester expected warmer weather; the exact desired
   location and expected forecast were not independently verified. See
   [destination precision issue draft](../issues/TRIP-DESTINATION-PRECISION.md).
2. Destination entry has no suggestions dropdown. It requests one match on
   `change` rather than presenting choices while typing. See
   [destination suggestions issue draft](../issues/TRIP-DESTINATION-SUGGESTIONS.md).
3. @ piece suggestions are capped at six after name filtering. Typing more
   characters searches all pieces; the cap can appear to be missing inventory.
   This is an observation only, not a new issue requested in this change.

## Closure

Every UX-16 inventory row is accounted for above. Close the audit as PASS with
manual and inspection coverage explicitly distinguished. Weather/location UX
findings are separate follow-ups; no weather accuracy fix is claimed here.
