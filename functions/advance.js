"use strict";

// PC-36 background advancer: drives unfinished parses to a visible
// terminal state on a schedule, so a photo left mid-cut completes
// without the user reopening anything. The client only polls while
// a review sheet is open; this is what finishes parses whose user
// already left. It is the reliability core of the passive flow:
// a background process that silently drops work is worse than a
// foreground one that fails fast, so every parse this touches ends
// in review, done, or failed — never in limbo.
//
// Stall rules (ages from the parse's createdAt):
// - "listing" past 15 min: start died during the garment list
//   (start takes ~2 min even cold). Marked failed; the photo
//   still exists, so the failed card's retry re-parses it.
// - "cutting" past 60 min with advance leaving it cutting:
//   SAM takes ~11 min observed, so 5x that means the prediction
//   is not coming. Remaining cutting garments are marked
//   failed and the parse moves to review (if anything is
//   ready) or failed — visible, retryable, never stuck.
// A tick that overlaps the previous one is wasteful, never
// corrupting: harvest is a pure function of terminal
// predictions, and re-harvesting recomputes identical renders
// at deterministic paths.

const { advanceParse } = require("./parse");

const LISTING_STALL_MS = 15 * 60 * 1000;
const CUTTING_STALL_MS = 60 * 60 * 1000;

async function advanceAllParses(deps) {
  const db = deps.db;
  const advanceFn = deps.advance || advanceParse;
  const now = deps.now || Date.now();
  const summary = { users: 0, advanced: 0, reviewed: 0, failed: 0, errors: [] };
  const userSnaps = await db.collection("users").get();
  for (const u of userSnaps.docs) {
    if (!u.exists) continue;
    const uid = u.id;
    summary.users++;
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("parses")
      .where("status", "in", ["listing", "cutting"])
      .get();
    for (const s of snap.docs) {
      if (!s.exists) continue;
      const doc = s.data();
      const parseRef = db.collection("users").doc(uid).collection("parses").doc(s.id);
      const createdMs =
        doc.createdAt && doc.createdAt.toDate
          ? doc.createdAt.toDate().getTime()
          : doc.createdAt
            ? Date.parse(doc.createdAt)
            : NaN;
      const ageMs = Number.isFinite(createdMs) ? now - createdMs : 0;
      try {
        if (doc.status === "listing") {
          if (ageMs > LISTING_STALL_MS) {
            await parseRef.update({ status: "failed", error: "listing stalled" });
            summary.failed++;
          }
          // Fresh listing: start may still be running. Leave it.
          continue;
        }
        const result = await advanceFn(uid, s.id, {
          db,
          bucket: deps.bucket,
          apiKey: deps.apiKey,
          hooks: deps.hooks,
          embedFn: deps.embedFn,
        });
        summary.advanced++;
        if (result.status === "review" || result.status === "done") {
          summary.reviewed++;
          continue;
        }
        if (result.status === "failed") {
          summary.failed++;
          continue;
        }
        if (result.status === "cutting" && ageMs > CUTTING_STALL_MS) {
          // Re-read: advance may have just harvested some pieces,
          // and the stored garments (with prediction ids) are the
          // only safe write-back — never write back the public
          // garments, which strip prediction ids.
          const fresh = await parseRef.get();
          if (!fresh.exists) continue;
          const garments = (fresh.data().garments || []).map((g) =>
            g.status === "cutting" ? { ...g, status: "failed", error: "cutting stalled" } : g
          );
          const anyReady = garments.some((g) => g.status === "ready");
          await parseRef.update({
            garments,
            status: anyReady ? "review" : "failed",
            ...(anyReady ? {} : { error: "cutting stalled" }),
          });
          if (anyReady) summary.reviewed++;
          else summary.failed++;
        }
      } catch (e) {
        // One bad parse never blocks the rest; the next tick
        // retries it, and the stall rules eventually fail it.
        summary.errors.push({ parseId: s.id, error: (e && e.message) || String(e) });
      }
    }
  }
  return summary;
}

module.exports = { advanceAllParses, LISTING_STALL_MS, CUTTING_STALL_MS };
