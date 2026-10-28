"use strict";

// rotateRender core (2026-10-28, founder phone-fix batch): turn a
// saved clean render 90 degrees clockwise, in place. The item
// detail's Rotate control is the self-serve half of the render
// orientation story — the automated half (a vision orientation
// check at extraction time) is designed on PC-34 and lands with
// the engine swap; until then, a sideways render is two taps
// from fixed instead of a support thread.
//
// Contract: reads the item's cover photo entry server-side (the
// client sends only the item id — the render path is never
// trusted from the client), downloads the CURRENT render,
// rotates it, and stores the result at a content-addressed path
// (sha256 of the rotated bytes — a new orientation is new
// content, so the path and therefore the URL always change and
// no stale cached copy can survive). Returns the new
// renderStoragePath; the client patches it onto the photo entry
// and clears the stored renderUrl so every surface re-resolves,
// exactly like the extractGarment flow. The original photo is
// never touched. Rotating the normalized 4:5 canvas swaps its
// aspect on odd quarter-turns; display surfaces use contain/cover
// fits that absorb that.

const crypto = require("crypto");
const sharp = require("sharp");

function keyedError(key, message) {
  const err = new Error(message);
  err.key = key;
  return err;
}

async function rotateItemRender(uid, itemId, deps) {
  const ref = deps.db
    .collection("users").doc(uid)
    .collection("items").doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) throw keyedError("ITEM_NOT_FOUND", "item not found");
  const data = snap.data() || {};
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const cover = photos[0];
  if (!cover || !cover.renderStoragePath) {
    throw keyedError("NO_RENDER", "this item has no clean render to rotate");
  }
  const [buf] = await deps.bucket.file(cover.renderStoragePath).download();
  const rotated = await sharp(buf).rotate(90).png().toBuffer();
  const hash = crypto.createHash("sha256").update(rotated).digest("hex").slice(0, 32);
  const renderStoragePath = `users/${uid}/renders/${hash}.png`;
  if (renderStoragePath !== cover.renderStoragePath) {
    await deps.bucket.file(renderStoragePath).save(rotated, {
      contentType: "image/png",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
  }
  return { renderStoragePath };
}

module.exports = { rotateItemRender };
