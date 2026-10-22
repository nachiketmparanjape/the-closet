// PC-34: garment extraction. Pure path derivation, the Photoroom
// provider seam (fake fetch), and the orchestration invariants —
// the original is read-only, foreign paths are refused, and the
// render lands at the deterministic path.
const { test, describe } = require("node:test");
const assert = require("node:assert");

const { renderPathFor, extractGarmentPhoto } = require("../functions/extract");
const { segmentImage } = require("../functions/photoroom");

describe("renderPathFor", () => {
  test("is deterministic and namespaced per user", () => {
    const a = renderPathFor("u1", "users/u1/photos/a.jpg");
    const b = renderPathFor("u1", "users/u1/photos/a.jpg");
    assert.equal(a, b);
    assert.ok(a.startsWith("users/u1/renders/"));
    assert.ok(a.endsWith(".png"));
  });

  test("differs across photos and users", () => {
    const base = renderPathFor("u1", "users/u1/photos/a.jpg");
    assert.notEqual(base, renderPathFor("u1", "users/u1/photos/b.jpg"));
    assert.notEqual(base, renderPathFor("u2", "users/u1/photos/a.jpg"));
  });
});

function fakeFetchOk(score) {
  return async (url, opts) => {
    assert.equal(url, "https://sdk.photoroom.com/v1/segment");
    assert.equal(opts.headers["x-api-key"], "test-key");
    return {
      ok: true,
      status: 200,
      headers: { get: (n) => (n === "x-uncertainty-score" ? score : null) },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    };
  };
}

describe("segmentImage (photoroom provider)", () => {
  test("missing key is a configuration error, not a call", async () => {
    await assert.rejects(
      () => segmentImage(Buffer.from("x"), "image/jpeg", null, fakeFetchOk("0.1")),
      (err) => err.key === "EXTRACT_NOT_CONFIGURED"
    );
  });

  test("returns the png bytes and parses the uncertainty score", async () => {
    const out = await segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", fakeFetchOk("0.25"));
    assert.equal(out.png.length, 4);
    assert.equal(out.uncertainty, 0.25);
  });

  test("a missing score header yields null, not NaN", async () => {
    const out = await segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", fakeFetchOk(null));
    assert.equal(out.uncertainty, null);
  });

  test("a provider failure maps to EXTRACT_FAILED", async () => {
    const failing = async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
      text: async () => "rate limited",
    });
    await assert.rejects(
      () => segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", failing),
      (err) => err.key === "EXTRACT_FAILED"
    );
  });
});

function fakeBucket(photoBytes) {
  const saved = {};
  return {
    saved,
    file(p) {
      return {
        async getMetadata() {
          return [{ size: photoBytes.length, contentType: "image/jpeg" }];
        },
        async download() {
          return [photoBytes];
        },
        async save(bytes, opts) {
          saved[p] = { bytes, opts };
        },
      };
    },
  };
}

describe("extractGarmentPhoto", () => {
  test("refuses a path outside the caller's prefix", async () => {
    await assert.rejects(
      () =>
        extractGarmentPhoto("u1", "users/u2/photos/a.jpg", {
          bucket: fakeBucket(Buffer.from("x")),
          apiKey: "k",
          fetchImpl: fakeFetchOk("0.1"),
        }),
      (err) => err.key === "NOT_YOUR_PHOTO"
    );
  });

  test("saves the render at the deterministic path and returns it", async () => {
    const bucket = fakeBucket(Buffer.from("jpeg-bytes"));
    const out = await extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
      bucket,
      apiKey: "test-key",
      fetchImpl: fakeFetchOk("0.05"),
    });
    const expected = renderPathFor("u1", "users/u1/photos/a.jpg");
    assert.equal(out.renderStoragePath, expected);
    assert.equal(out.uncertainty, 0.05);
    assert.equal(out.provider, "photoroom");
    assert.ok(bucket.saved[expected], "render was saved");
    assert.equal(bucket.saved[expected].opts.contentType, "image/png");
  });

  test("no key configured fails before touching storage", async () => {
    const bucket = fakeBucket(Buffer.from("x"));
    await assert.rejects(
      () =>
        extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
          bucket,
          apiKey: null,
          fetchImpl: fakeFetchOk("0.1"),
        }),
      (err) => err.key === "EXTRACT_NOT_CONFIGURED"
    );
  });
});
