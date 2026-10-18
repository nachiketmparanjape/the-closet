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

## Decisions (founder 2026-10-18)
- **Anonymous allowed**, with a clear, simple warning: browser storage can
  be wiped (cookies cleared, private mode, new device) and the wardrobe
  goes with it. Copy direction: "You're browsing as a guest — your
  wardrobe lives in this browser and can disappear. Connect an account to
  keep it safe." (Final wording to be simplified in UI copy pass.)
- **Maximum options via account linking.** One account per email across
  providers: signing in with an email link as `x@gmail.com` and later
  with Google as `x@gmail.com` must resolve to the **same** Firebase user,
  never two accounts. Implementation: on sign-in, `fetchSignInMethodsForEmail`
  first; on `auth/account-exists-with-different-credential`, complete
  sign-in with the existing provider then `linkWithCredential` the new
  one. Settings shows "Connected accounts" (Google ✓ / Email ✓) with
  link/unlink — both providers stay usable for sign-in afterward.
- Upgrade nudge after the **first** item added; persistent guest banner
  until an account is connected.

## The guest-mode fragility problem (founder 2026-10-18)
Firebase auth sessions live in browser storage (IndexedDB). Safari can
evict that: "clear website data", private mode, storage pressure, and
the ITP 7-day rule. The key distinction: a **Google/email session is
recoverable** (sign in again → same uid → wardrobe back). An
**anonymous session is not** — the uid is random and unrecoverable. No
technical mitigation exists; it's inherent to web storage.

Design response — treat anonymous as **trial mode**, honestly:
- Persistent guest banner (not one-time-dismissible): "Guest mode — your
  wardrobe lives in this browser only. Connect an account to keep it."
  One tap → upgrade sheet.
- Upgrade nudge after the **first** item added (not the fifth) — the
  earlier the conversion, the less there is to lose.
- Privacy note states it plainly.
- If guest-wardrobe loss ever shows up as a real complaint, revisit:
  the fallback is leading with email-link instead of anonymous.

## Open questions for the founder
1. ~~Email-link vs Google-only upgrade~~ — decided 2026-10-18: both, linked
   to one account per email.
2. Privacy-note wording — approve the AI-disclosure line above.
