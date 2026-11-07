"use strict";

// Discard a draft parse (PC-36 drafts): the user looked at a draft
// and decided against it. Deleting only the parse doc would leave
// orphaned renders, a baked file and an uploaded photo behind, and
// deleting only the listed parse would leave a hidden retry lineage
// pointing at a deleted photo — so a discard removes:
//
//   - every parse sharing the source photo (a retry creates a new
//     parse for the same upload; the drafts list shows one card per
//     photo, newest wins, so the card IS the whole lineage),
//   - each parse's baked file and garment renders,
//   - the source photo itself, but ONLY when it lives under the
//     user's outfit-photos/ upload area. A parse's photo is an
//     upload by construction; the prefix guard means a future flow
//     that parses an existing wardrobe photo can never lose that
//     item's photo to a discard.
//
// Guards: a missing parse throws PARSE_NOT_FOUND (same as
// advanceParse — the advancer's per-parse catch already treats a
// deleted doc as a no-op, so a discard racing a tick is harmless).
// A parse with status "done" is saved work, not a draft, and is
// refused — saved parses never appear in the drafts list, so this
// is a defense-in-depth check, not a reachable button. Durable
// match rejections (users/{uid}/match_rejections) are NOT deleted:
// they record a judgment about an item, not about this draft, and
// removing them would resurrect proposals the user already rejected.
// File deletes are best-effort (a missing file must not fail the
// discard), mirroring the client's photo-delete pattern.

const { codedError } = require("./errors");

async function discardParse(uid, parseId, deps) {
  const db = deps.db;
  const bucket = deps.bucket;
  const parses = db.collection("users").doc(uid).collection("parses");
  const snap = await parses.doc(parseId).get();
  if (!snap.exists) {
    throw codedError("PARSE_NOT_FOUND", "discard: no such parse");
  }
  const doc = snap.data();
  if (doc.status === "done") {
    throw codedError("PARSE_NOT_DISCARDABLE", "discard: parse already saved");
  }
  const sourcePath = doc.sourcePhoto && doc.sourcePhoto.storagePath;
  const all = await parses.get();
  const doomed = all.docs.filter((d) => {
    if (d.id === parseId) return true;
    if (!sourcePath) return false;
    const dd = d.data();
    return dd.sourcePhoto && dd.sourcePhoto.storagePath === sourcePath;
  });
  const files = new Set();
  for (const d of doomed) {
    const dd = d.data();
    if (dd.bakedStoragePath) files.add(dd.bakedStoragePath);
    for (const g of dd.garments || []) {
      if (g.renderStoragePath) files.add(g.renderStoragePath);
    }
  }
  if (sourcePath && sourcePath.startsWith("users/" + uid + "/outfit-photos/")) {
    files.add(sourcePath);
  }
  for (const d of doomed) {
    await parses.doc(d.id).delete();
  }
  const deletedFiles = [];
  for (const f of files) {
    try {
      await bucket.file(f).delete();
      deletedFiles.push(f);
    } catch (e) {
      // Best-effort: the file may already be gone. The parse docs
      // are deleted regardless, so the draft is gone either way.
    }
  }
  return {
    parseId,
    deletedParses: doomed.map((d) => d.id),
    deletedFiles: deletedFiles.length,
  };
}

module.exports = { discardParse };
