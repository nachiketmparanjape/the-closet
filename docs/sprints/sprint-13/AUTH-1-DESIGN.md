# AUTH-1 design — privacy-friendlier sign-in

## Problem
Google sign-in sits in front of the whole app. Privacy-conscious users
bounce before seeing anything. The founder's call: make starting
frictionless while keeping a real account path for persistence.

## Proposal: anonymous-first, upgrade when it matters

1. **First launch → anonymous auth** (`signInAnonymously()`). No login
   wall, no email, the app just works. The anonymous Firebase uid owns
   `users/{uid}/…` exactly like a Google uid does today — **no Firestore
   rules change needed**.
2. **Upgrade paths** (both via `linkWithCredential`, which **keeps the
   same uid** — zero data migration):
   - Google (the existing provider), or
   - Email link (passwordless `sendSignInLinkToEmail`) — for users who
     don't want Google in the loop at all.
3. **Upgrade prompts at natural moments, never nagging:**
   - A quiet banner once the wardrobe has ~5 items: "Love your closet?
     Connect an account so it survives a new phone."
   - Always available in Settings.
   - Honest framing: "Your wardrobe lives on this device until you
     connect an account — reinstalling the app without an account loses it."

## The privacy note (in-app, Settings → Privacy)
Plain-language, no legalese:
- Wardrobe data + photos live in your private cloud store, keyed to your
  account — nobody else can read them.
- No ads, no trackers, no data sold.
- **Honest disclosure:** when you add a photo, it's sent to Google's AI
  service to generate the description/tags, then discarded there. (The
  founder should confirm this wording — it's the one real data-sharing
  fact in the app.)

## Out of scope
- Cross-device account merge (sign in with Google on phone B creates a
  second uid; merging two wardrobes is a real feature, not this cut).
- Apple sign-in (revisit if iOS users ask).
- Deleting the anonymous account / data export (small follow-ups).

## Open questions for the founder
1. Email-link vs Google-only upgrade: is offering both worth the extra
   UI, or is anonymous → Google enough for v1?
2. Privacy-note wording — approve the AI-disclosure line above.
