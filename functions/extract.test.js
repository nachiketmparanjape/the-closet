// PC-110: extractGarment links the render server-side.
// The Black tee (2026-11-26): the server saved the cutout at
// 02:56:40Z but the callable died at its 120s timeout (123s after
// creation), so the client's patchPhotos never ran — the photo entry
// kept no render fields and the app showed the original. The server
// now writes the render fields to the item doc itself (the client's
// patch stays as an idempotent second write) and mints the download
// token at save time, so a saved render is always reachable.
// Run from hosting/: node --test functions/extract.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { extractGarmentPhoto, renderPathFor, linkRenderToItem } = require("./extract");

const UID = "u1";
const ITEM_ID = "it1";
const STORAGE_PATH = `users/${UID}/items/${ITEM_ID}/0-IMG_0419.jpeg`;
const RENDER_PATH = renderPathFor(UID, STORAGE_PATH);

async function garmentOnWhite(color) {
  const block = await sharp({ create: { width: 300, height: 300, channels: 4, background: { ...color, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: block, left: 50, top: 50 }]).png().toBuffer();
}
async function garmentCutout(color, size = 300) {
  const block = await sharp({ create: { width: size, height: size, channels: 4, background: { ...color, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: block, left: (400 - size) / 2, top: (400 - size) / 2 }]).png().toBuffer();
}

function fakeBucket(photoBytes) {
  const saved = {};
  return {
    name: "test-bucket",
    saved,
    file: (path) => ({
      getMetadata: async () => [{ size: photoBytes.length }],
      download: async () => [photoBytes],
      save: async (buf, opts) => { saved[path] = { buffer: buf, opts }; },
    }),
  };
}

function fakeDb(item) {
  const updates = [];
  const itemRef = {
    get: async () => ({ exists: true, data: () => item }),
    update: async (data) => { updates.push(data); },
  };
  return {
    updates,
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => itemRef }) }) }),
  };
}

function fakeReplicate(cutoutBytes) {
  const json = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o), arrayBuffer: async () => Buffer.from(JSON.stringify(o)) });
  const bytes = (b) => ({ ok: true, status: 200, json: async () => ({}), text: async () => "", arrayBuffer: async () => b });
  return async (url, opts = {}) => {
    if (url === "https://api.replicate.com/v1/models/sprited/birefnet") return json({ latest_version: { id: "v1" } });
    if (url === "https://api.replicate.com/v1/predictions" && opts.method === "POST") {
      return json({ status: "succeeded", output: "https://replicate/output.png" });
    }
    if (url === "https://replicate/output.png") return bytes(cutoutBytes);
    throw new Error("unexpected fetch: " + url);
  };
}

const fakeCallModelOk = async () => ({ text: '{"ok": true, "problems": []}', usage: null, model: "test" });

describe("PC-110: the server links the render it saved", function () {
  it("a passed cutout is linked to the item doc, with a download token at save", async function () {
    const photoBytes = await garmentOnWhite({ r: 128, g: 0, b: 32 });
    const cutoutBytes = await garmentCutout({ r: 128, g: 0, b: 32 });
    const bucket = fakeBucket(photoBytes);
    const item = {
      name: "Black tee with red back graphic",
      photos: [{ url: "https://example.com/0-IMG_0419.jpeg", storagePath: STORAGE_PATH }],
    };
    const db = fakeDb(item);
    const result = await extractGarmentPhoto(UID, STORAGE_PATH, {
      bucket,
      db,
      apiKey: "rk-test",
      fetchImpl: fakeReplicate(cutoutBytes),
      callModel: fakeCallModelOk,
      embedFn: async () => [0.1, 0.2, 0.3],
    });
    assert.equal(result.gatePassed, true);
    assert.equal(result.renderStoragePath, RENDER_PATH);
    // The save minted a download token — the render is reachable
    // even if the callable dies before returning.
    const saved = bucket.saved[RENDER_PATH];
    assert.ok(saved, "render saved at the deterministic path");
    const token = saved.opts.metadata.firebaseStorageDownloadTokens;
    assert.match(token, /^[0-9a-f-]{36}$/, "save metadata carries a UUID download token");
    // The item doc was linked server-side, with the same fields the
    // client's patchPhotos writes.
    assert.equal(db.updates.length, 1);
    const linked = db.updates[0].photos[0];
    assert.equal(linked.storagePath, STORAGE_PATH);
    assert.equal(linked.renderStatus, "passed");
    assert.equal(linked.renderStoragePath, RENDER_PATH);
    assert.equal(
      linked.renderUrl,
      `https://firebasestorage.googleapis.com/v0/b/test-bucket/o/${encodeURIComponent(RENDER_PATH)}?alt=media&token=${token}`
    );
    assert.deepEqual(linked.renderEmbedding, [0.1, 0.2, 0.3]);
    assert.ok(linked.photoQuality);
  });

  it("a rejected cutout writes only renderStatus, and the original keeps showing", async function () {
    const photoBytes = await garmentOnWhite({ r: 128, g: 0, b: 32 });
    // A 20px speck: fgFraction 0.0025, below the mask gate's 0.02 floor.
    const cutoutBytes = await garmentCutout({ r: 128, g: 0, b: 32 }, 20);
    const bucket = fakeBucket(photoBytes);
    const item = {
      name: "Black tee with red back graphic",
      photos: [{ url: "https://example.com/0-IMG_0419.jpeg", storagePath: STORAGE_PATH }],
    };
    const db = fakeDb(item);
    const result = await extractGarmentPhoto(UID, STORAGE_PATH, {
      bucket,
      db,
      apiKey: "rk-test",
      fetchImpl: fakeReplicate(cutoutBytes),
      callModel: fakeCallModelOk,
      embedFn: async () => [0.1, 0.2, 0.3],
    });
    assert.equal(result.gatePassed, false);
    assert.equal(result.gate.stage, "mask");
    // The render file is still saved (tuning evidence) with a token.
    assert.ok(bucket.saved[RENDER_PATH]);
    assert.match(bucket.saved[RENDER_PATH].opts.metadata.firebaseStorageDownloadTokens, /^[0-9a-f-]{36}$/);
    // But the photo entry points at nothing: only the status.
    assert.equal(db.updates.length, 1);
    const linked = db.updates[0].photos[0];
    assert.equal(linked.renderStatus, "rejected");
    assert.equal(linked.renderUrl, undefined);
    assert.equal(linked.renderStoragePath, undefined);
  });

  it("a parse-flow photo (no item yet) is left alone", async function () {
    const photoBytes = await garmentOnWhite({ r: 128, g: 0, b: 32 });
    const cutoutBytes = await garmentCutout({ r: 128, g: 0, b: 32 });
    const bucket = fakeBucket(photoBytes);
    const db = fakeDb({ name: "parse", photos: [] });
    const result = await extractGarmentPhoto(UID, "users/u1/outfit-photos/x.jpg", {
      bucket,
      db,
      apiKey: "rk-test",
      fetchImpl: fakeReplicate(cutoutBytes),
      callModel: fakeCallModelOk,
      embedFn: async () => [0.1, 0.2, 0.3],
    });
    assert.equal(result.gatePassed, true);
    assert.equal(db.updates.length, 0, "no item doc to link for a parse photo");
  });
});

describe("linkRenderToItem", function () {
  it("patches the matching entry, not the first one", async function () {
    const item = {
      photos: [
        { url: "https://example.com/a.jpg", storagePath: "users/u1/items/it1/0-a.jpg" },
        { url: "https://example.com/b.jpg", storagePath: STORAGE_PATH },
      ],
    };
    const db = fakeDb(item);
    await linkRenderToItem(
      { db },
      UID,
      STORAGE_PATH,
      { gatePassed: true, renderStoragePath: RENDER_PATH, uncertainty: null, photoQuality: { frameShare: 1 }, renderEmbedding: [1] },
      "https://example.com/render.png"
    );
    assert.equal(db.updates.length, 1);
    const photos = db.updates[0].photos;
    assert.equal(photos[0].renderStatus, undefined, "the other entry is untouched");
    assert.equal(photos[1].renderStatus, "passed");
    assert.equal(photos[1].renderUrl, "https://example.com/render.png");
  });

  it("does nothing without a db or for a non-item path", async function () {
    await linkRenderToItem({}, UID, STORAGE_PATH, { gatePassed: true }, "https://example.com/r.png");
    const db = fakeDb({ photos: [] });
    await linkRenderToItem({ db }, UID, "users/u1/outfit-photos/x.jpg", { gatePassed: true }, "https://example.com/r.png");
    assert.equal(db.updates.length, 0);
  });
});
