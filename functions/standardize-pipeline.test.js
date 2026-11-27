// PC-94 + PC-97: the diffusion pipeline, end to end with faked
// network (global fetch), faked Firestore and faked Storage, but
// the REAL quality gates.
//
// PC-94 (2026-11-26): the pipeline fed FLUX photos[0].url — the
// whole mirror photo — and the color gate compared the scene median
// against the garment median (ΔE=49.9 for a perfect burgundy render
// against the founder's mirror photo, so the gate could never pass).
// The pipeline now standardizes from the cutout render when one
// passed, and falls back to the original photo otherwise.
//
// PC-97 (2026-11-26): the pipeline retried FLUX 3x with identical
// input on a systematic gate failure (6 FLUX runs, $0.18, zero
// chance), discarded every failed render, and could run 600s
// against a 300s timeout. It now stops when the same gates fail
// twice, saves the rejected render as evidence, and never starts an
// attempt past its time budget.
// Run from hosting/: node --test functions/standardize-pipeline.test.js
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const {
  runStandardizationPipeline,
  gateSignature,
  downloadUrlForPath,
} = require("./standardize-pipeline");

const BURGUNDY = { r: 128, g: 0, b: 32 };
const GREEN = { r: 0, g: 128, b: 0 };
const ORIGINAL_URL = "https://example.com/outfit.jpg";
const FLUX_OUT_URL = "https://fal.output/flux.png";
const MASK_URL = "https://fal/mask.png";

async function garmentOnWhite(color) {
  const block = await sharp({ create: { width: 200, height: 200, channels: 4, background: { ...color, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: block, left: 100, top: 100 }]).png().toBuffer();
}
async function garmentCutout(color) {
  const block = await sharp({ create: { width: 200, height: 200, channels: 4, background: { ...color, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: block, left: 100, top: 100 }]).png().toBuffer();
}
async function maskPng() {
  const block = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: block, left: 100, top: 100 }]).png().toBuffer();
}

// --- fakes -----------------------------------------------------------------
function fakeDb() {
  const updates = [];
  const txUpdates = [];
  const itemRef = { update: async (data) => { updates.push(data); } };
  return {
    updates, txUpdates, itemRef,
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => itemRef }) }) }),
    runTransaction: async (fn) => { await fn({ update: (_ref, data) => { txUpdates.push(data); } }); },
  };
}

function fakeBucket({ token = "tok-1" } = {}) {
  const saved = {};
  const metaCalls = [];
  return {
    name: "test-bucket",
    saved, metaCalls,
    file: (path) => ({
      getMetadata: async () => [{ metadata: token ? { firebaseStorageDownloadTokens: token } : {} }],
      setMetadata: async (m) => { metaCalls.push({ path, m }); },
      save: async (buf, opts) => { saved[path] = { buffer: buf, contentType: opts && opts.contentType }; },
      makePublic: async () => {},
    }),
  };
}

function makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes }) {
  const fluxSubmits = [];
  const fetched = [];
  const json = (o) => ({ ok: true, status: 200, json: async () => o, arrayBuffer: async () => Buffer.from(JSON.stringify(o)) });
  const bytes = (b) => ({ ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => b });
  async function fakeFetch(url, opts = {}) {
    fetched.push(url);
    if (url === "https://queue.fal.run/fal-ai/flux-kontext/dev" && opts.method === "POST") {
      fluxSubmits.push(JSON.parse(opts.body));
      return json({ request_id: "req-1", status_url: "https://fal/status/flux", response_url: "https://fal/response/flux" });
    }
    if (url === "https://fal/status/flux") return json({ status: "COMPLETED", response_url: "https://fal/response/flux" });
    if (url === "https://fal/response/flux") return json({ images: [{ url: FLUX_OUT_URL }] });
    if (url === FLUX_OUT_URL) return bytes(fluxOutput);
    if (url.includes("renders")) return bytes(cutoutBytes); // encoded path: users%2Fu1%2Frenders%2Fabc.png
    if (url === ORIGINAL_URL) return bytes(originalBytes);
    if (url === "https://rest.alpha.fal.ai/storage/upload/initiate") return json({ upload_url: "https://fal.upload/put", file_url: "https://fal.storage/x.png" });
    if (url === "https://fal.upload/put") return json({});
    if (url === "https://queue.fal.run/fal-ai/sam-3/image" && opts.method === "POST") {
      return json({ request_id: "sam-1", status_url: "https://fal/status/sam", response_url: "https://fal/response/sam" });
    }
    if (url === "https://fal/status/sam") return json({ status: "COMPLETED" });
    if (url === "https://fal/response/sam") return json({ masks: [{ url: MASK_URL }], scores: [0.9], boxes: [[0.5, 0.5, 0.5, 0.5]] });
    if (url === MASK_URL) return bytes(maskBytes);
    throw new Error("unexpected fetch: " + url);
  }
  return { fetch: fakeFetch, fluxSubmits, fetched };
}

function itemWithRender() {
  return {
    name: "Burgundy yellow sweatshirt",
    category: "Tops",
    photos: [{ url: ORIGINAL_URL, storagePath: "users/u1/outfit-photos/x.jpg", renderStoragePath: "users/u1/renders/abc.png", renderStatus: "passed" }],
  };
}

let realFetch;
beforeEach(() => { realFetch = global.fetch; });
afterEach(() => { global.fetch = realFetch; });

describe("PC-94: diffusion input is the cutout", function () {
  it("feeds FLUX the cutout URL and records inputKind=cutout", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key",
    });
    assert.equal(res.pendingReview, true);
    assert.equal(res.inputKind, "cutout");
    assert.equal(fluxSubmits.length, 1);
    assert.equal(
      fluxSubmits[0].image_url,
      "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/users%2Fu1%2Frenders%2Fabc.png?alt=media&token=tok-1"
    );
    assert.equal(db.txUpdates[0]["standardization.inputKind"], "cutout");
    assert.equal(db.txUpdates[0]["standardization.status"], "pending_review");
  });

  it("falls back to the original photo when no passed render exists", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    const item = itemWithRender();
    delete item.photos[0].renderStoragePath;
    delete item.photos[0].renderStatus;
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item, falApiKey: "fake-key",
    });
    assert.equal(res.inputKind, "original");
    assert.equal(fluxSubmits[0].image_url, ORIGINAL_URL);
    assert.equal(db.txUpdates[0]["standardization.inputKind"], "original");
  });

  it("falls back to the original photo when the cutout URL cannot be minted", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    // A bucket whose metadata read fails: the cutout URL cannot be minted.
    bucket.file = () => ({
      getMetadata: async () => { throw new Error("storage down"); },
      setMetadata: async () => {},
      save: async (buf, opts) => { bucket.saved["x"] = { buffer: buf, contentType: opts && opts.contentType }; },
      makePublic: async () => {},
    });
    bucket.saved = {};
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key",
    });
    assert.equal(res.inputKind, "original");
    assert.equal(fluxSubmits[0].image_url, ORIGINAL_URL);
  });
});

describe("PC-97: systematic retries stop, evidence is kept, time is budgeted", function () {
  it("stops after the same gates fail twice and saves the rejected render", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    // FLUX returns a GREEN garment for a burgundy input: the color
    // gate fails identically every run (the founder's ΔE=24.3/28.0
    // pair). The old code ran this 3 times.
    const fluxOutput = await garmentOnWhite(GREEN);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    await assert.rejects(
      runStandardizationPipeline({ db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key" }),
      /systematic_gate_failure: color/
    );
    assert.equal(fluxSubmits.length, 2, "exactly two FLUX runs, not three");
    const rejected = bucket.saved["users/u1/items/it1/standardized-rejected.png"];
    assert.ok(rejected, "rejected render saved as evidence");
    assert.equal(rejected.contentType, "image/png");
    assert.ok(rejected.buffer.equals(fluxOutput), "the saved render is the failed FLUX output");
    assert.equal(db.updates[0]["standardization.lastRejectedStoragePath"], "users/u1/items/it1/standardized-rejected.png");
    assert.match(db.updates[0]["standardization.lastRejectedReason"], /color/);
  });

  it("never starts an attempt past its time budget", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    const fluxOutput = await garmentOnWhite(GREEN);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    await assert.rejects(
      runStandardizationPipeline({
        db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key",
        deadlineMs: 1, // budget already spent: attempt 2 must not start
      }),
      /standardization_timeout: color/
    );
    assert.equal(fluxSubmits.length, 1, "no second FLUX run past the budget");
  });
});

describe("gateSignature", function () {
  it("names the failing gates, in a stable order", function () {
    assert.equal(gateSignature({ results: { color: { pass: false }, geometry: { pass: true } } }), "color");
    assert.equal(gateSignature({ results: { color: { pass: false }, geometry: { pass: false } } }), "color+geometry");
    assert.equal(gateSignature({ results: { color: { pass: true }, geometry: { pass: true } } }), "");
    assert.equal(gateSignature(null), "");
  });
});

describe("downloadUrlForPath", function () {
  it("builds the token URL when the token exists", async function () {
    const bucket = fakeBucket({ token: "tok-9" });
    const url = await downloadUrlForPath(bucket, "users/u1/renders/abc.png");
    assert.equal(url, "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/users%2Fu1%2Frenders%2Fabc.png?alt=media&token=tok-9");
    assert.equal(bucket.metaCalls.length, 0);
  });

  it("creates the token metadata when the object has none", async function () {
    const bucket = fakeBucket({ token: null });
    const url = await downloadUrlForPath(bucket, "users/u1/renders/abc.png");
    assert.match(url, /token=[0-9a-f-]{36}/);
    assert.equal(bucket.metaCalls.length, 1);
    assert.match(bucket.metaCalls[0].m.metadata.firebaseStorageDownloadTokens, /^[0-9a-f-]{36}$/);
  });
});

describe("PC-100: color anchor in the FLUX prompt", function () {
  it("passes the cutout's dominant color in the prompt and fetches the input once", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits, fetched } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key",
    });
    assert.equal(res.pendingReview, true);
    // The test cutout is a solid burgundy square: its median is (128, 0, 32).
    assert.ok(fluxSubmits[0].prompt.includes("RGB(128, 0, 32)"), "prompt must carry the anchor");
    assert.ok(fluxSubmits[0].prompt.includes("Match this color EXACTLY"));
    // The input is fetched once for the anchor + gates, not once per attempt.
    assert.equal(fetched.filter((u) => u.includes("renders")).length, 1);
    assert.deepEqual(db.txUpdates[0]["standardization.colorAnchor"], [128, 0, 32]);
  });

  it("still anchors from the original photo when no cutout exists", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnWhite(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    const item = itemWithRender();
    delete item.photos[0].renderStoragePath;
    delete item.photos[0].renderStatus;
    await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item, falApiKey: "fake-key",
    });
    assert.ok(fluxSubmits[0].prompt.includes("RGB(128, 0, 32)"));
  });
});
