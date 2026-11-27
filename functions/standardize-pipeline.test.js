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
// PC-106: a worn/scene photo — the garment fills most of the frame on a
// non-white background (a room, not a studio). The border is not white,
// so isAlreadyClean says "not clean" and the pipeline must run FLUX.
// The garment still dominates the median, so the PC-100 color anchor
// still reads burgundy from it. The block is 340px (not 300px): at 300px
// the median sat on the blended edge and read G=1 instead of G=0.
async function garmentOnRoom(color) {
  const block = await sharp({ create: { width: 340, height: 340, channels: 4, background: { ...color, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 120, g: 110, b: 100, alpha: 1 } } })
    .composite([{ input: block, left: 30, top: 30 }]).png().toBuffer();
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
function fakeDb(getData) {
  const updates = [];
  const txUpdates = [];
  const itemRef = {
    update: async (data) => { updates.push(data); },
    // PC-109: the pipeline re-reads the doc (grace wait + per-attempt
    // re-check). getData supplies the current doc; without it the doc
    // does not exist and the re-check finds nothing.
    get: async () => (typeof getData === "function" ? getData() : { exists: false, data: () => null }),
  };
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

function makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes, fluxNeverCompletes = false }) {
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
    if (url === "https://fal/status/flux") {
      if (fluxNeverCompletes) return json({ status: "IN_QUEUE" });
      return json({ status: "COMPLETED", response_url: "https://fal/response/flux" });
    }
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
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
    // PC-109: the inputKind persist lands before the loop, so the
    // rejected-render write is not updates[0] any more — find it.
    const rejectedUpdate = db.updates.find((u) => u["standardization.lastRejectedStoragePath"]);
    assert.ok(rejectedUpdate, "rejected render path recorded");
    assert.equal(rejectedUpdate["standardization.lastRejectedStoragePath"], "users/u1/items/it1/standardized-rejected.png");
    assert.match(rejectedUpdate["standardization.lastRejectedReason"], /color/);
  });

  it("never starts an attempt past its time budget", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
      // PC-105: with a 1ms budget the FLUX poll itself refuses to
      // start (its deadline check fires before the first poll), so
      // the timeout names the poll, not the gate. Either way the
      // run ends in a timeout and no second FLUX run starts.
      /standardization_timeout/
    );
    assert.equal(fluxSubmits.length, 1, "no second FLUX run past the budget");
  });

  it("PC-105: a slow FLUX poll ends inside the budget, not at the function cap", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes, fluxNeverCompletes: true });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    // The poll's own 40 x 5s cap is 200s; a 60ms pipeline budget must
    // end the run in ~one poll interval, with a timeout error.
    await assert.rejects(
      runStandardizationPipeline({
        db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key",
        deadlineMs: 60,
      }),
      /standardization_timeout: FLUX poll exceeded the pipeline budget/
    );
    assert.equal(fluxSubmits.length, 1, "one FLUX submit, then the poll stops");
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
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
    const originalBytes = await garmentOnRoom(BURGUNDY);
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

describe("PC-106: already-clean check lives in the pipeline", function () {
  it("marks a studio shot already_clean and runs no FLUX", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    // Studio shot: white border — clean even though a cutout exists.
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
    assert.equal(res.skipped, true);
    assert.equal(fluxSubmits.length, 0, "no FLUX run for a studio shot");
    const cleanUpdate = db.updates.find((u) => u["standardization.status"] === "already_clean");
    assert.ok(cleanUpdate, "already_clean recorded");
    assert.ok(cleanUpdate["standardization.reason"]);
  });

  it("force bypasses the clean check and runs FLUX", async function () {
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
      force: true,
    });
    assert.equal(res.pendingReview, true);
    assert.equal(fluxSubmits.length, 1, "manual Generate means run FLUX");
  });

  it("a cutout-backed worn photo still runs FLUX — the check reads the original, not the cutout", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    // Worn scene: not clean, even though the cutout itself is transparent.
    const originalBytes = await garmentOnRoom(BURGUNDY);
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
  });

  it("a studio shot with no cutout is also skipped", async function () {
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
    assert.equal(res.skipped, true);
    assert.equal(res.inputKind, "original");
    assert.equal(fluxSubmits.length, 0);
  });
});

describe("PC-109: the pipeline input follows the cutout", function () {
  function freshItemNoRender() {
    return {
      name: "Navy crew-neck t-shirt",
      category: "Tops",
      createdAt: new Date().toISOString(),
      photos: [{ url: ORIGINAL_URL, storagePath: "users/u1/outfit-photos/x.jpg" }],
    };
  }
  function oldItemNoRender() {
    const item = freshItemNoRender();
    item.createdAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    return item;
  }
  function withRender(item) {
    const copy = JSON.parse(JSON.stringify(item));
    copy.photos[0].renderStoragePath = "users/u1/renders/abc.png";
    copy.photos[0].renderStatus = "passed";
    return copy;
  }
  const CUTOUT_URL = "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/users%2Fu1%2Frenders%2Fabc.png?alt=media&token=tok-1";

  it("grace wait: a fresh item's cutout lands during the wait, attempt 1 uses it", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    // The doc has no render at first; the first sleep (grace-wait
    // poll) flips it to the rendered doc, as extractGarment landing.
    const item = freshItemNoRender();
    let doc = item;
    const db = fakeDb(() => ({ exists: true, data: () => doc }));
    const bucket = fakeBucket();
    let sleeps = 0;
    const sleepMs = async () => { sleeps++; doc = withRender(item); };
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item, falApiKey: "fake-key", sleepMs,
    });
    assert.ok(sleeps >= 1, "the grace wait polled");
    assert.equal(res.pendingReview, true);
    assert.equal(res.inputKind, "cutout");
    assert.equal(fluxSubmits[0].image_url, CUTOUT_URL);
    assert.ok(db.updates.some((u) => u["standardization.inputKind"] === "cutout"), "inputKind cutout persisted");
  });

  it("grace wait: no cutout appears, the run proceeds with the original", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const item = freshItemNoRender();
    const db = fakeDb(() => ({ exists: true, data: () => item }));
    const bucket = fakeBucket();
    let sleeps = 0;
    const sleepMs = async () => { sleeps++; }; // instant: the 60s wait spins 12 polls and gives up
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item, falApiKey: "fake-key", sleepMs,
    });
    assert.ok(sleeps >= 1, "the grace wait polled and gave up");
    assert.equal(res.pendingReview, true);
    assert.equal(res.inputKind, "original");
    assert.equal(fluxSubmits[0].image_url, ORIGINAL_URL);
  });

  it("grace wait is skipped for an old item — the run starts at once", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
    const fluxOutput = await garmentOnWhite(BURGUNDY);
    const maskBytes = await maskPng();
    const { fetch } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const item = oldItemNoRender();
    const db = fakeDb(() => ({ exists: true, data: () => item }));
    const bucket = fakeBucket();
    let sleeps = 0;
    const sleepMs = async () => { sleeps++; };
    const res = await runStandardizationPipeline({
      db, bucket, uid: "u1", itemId: "it1", item, falApiKey: "fake-key", sleepMs,
    });
    assert.equal(sleeps, 0, "no grace wait for an old item");
    assert.equal(res.inputKind, "original");
  });

  it("cutout lands before attempt 2: attempt 2 uses it and the stop comparison resets", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
    // FLUX draws GREEN for a burgundy input: every attempt fails the
    // color gate. Attempt 1 runs on the original; the cutout lands
    // before attempt 2, so attempt 2 runs on it — and because the
    // input changed, the systematic stop must NOT fire on attempt 2
    // (the failure is not "the same failure" on a new input).
    const fluxOutput = await garmentOnWhite(GREEN);
    const maskBytes = await maskPng();
    const { fetch, fluxSubmits } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const item = oldItemNoRender();
    // The re-check before attempt 2 is the first get() call — by then
    // the cutout has landed, so the doc carries the render.
    const db = fakeDb(() => ({ exists: true, data: () => withRender(item) }));
    const bucket = fakeBucket();
    await assert.rejects(
      runStandardizationPipeline({
        db, bucket, uid: "u1", itemId: "it1", item, falApiKey: "fake-key",
        sleepMs: async () => {},
      }),
      /systematic_gate_failure: color/
    );
    assert.equal(fluxSubmits.length, 3, "attempt 2 must run on the new input, attempt 3 stops");
    assert.equal(fluxSubmits[0].image_url, ORIGINAL_URL);
    assert.equal(fluxSubmits[1].image_url, CUTOUT_URL);
    assert.equal(fluxSubmits[2].image_url, CUTOUT_URL);
    assert.ok(db.updates.some((u) => u["standardization.inputKind"] === "cutout"), "inputKind cutout persisted on switch");
  });

  it("inputKind is persisted even when the run fails", async function () {
    const cutoutBytes = await garmentCutout(BURGUNDY);
    const originalBytes = await garmentOnRoom(BURGUNDY);
    const fluxOutput = await garmentOnWhite(GREEN);
    const maskBytes = await maskPng();
    const { fetch } = makeFetch({ fluxOutput, cutoutBytes, originalBytes, maskBytes });
    global.fetch = fetch;
    const db = fakeDb();
    const bucket = fakeBucket();
    await assert.rejects(
      runStandardizationPipeline({
        db, bucket, uid: "u1", itemId: "it1", item: itemWithRender(), falApiKey: "fake-key",
        sleepMs: async () => {},
      }),
      /systematic_gate_failure/
    );
    assert.ok(db.updates.some((u) => u["standardization.inputKind"] === "cutout"), "a failed run still records its input");
  });
});
