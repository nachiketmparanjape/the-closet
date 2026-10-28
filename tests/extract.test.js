// PC-34 (2026-10-23 package): BiRefNet/Replicate provider seam,
// orientation bake-in, the two-layer quality gate, and OBS-3a
// usage events. Image fixtures are generated with sharp at test
// time (tiny synthetic images — no binary fixtures in the repo).
const { test, describe } = require("node:test");
const assert = require("node:assert");

const sharp = require("../functions/node_modules/sharp");
const { renderPathFor, extractGarmentPhoto } = require("../functions/extract");
const { segmentImage, MODEL } = require("../functions/birefnet");
const { normalizeOrientation, alphaStats, judgeMask } = require("../functions/imagenorm");
const { parseVerdict } = require("../functions/extractcheck");
const { priceEvent, PRICING_VERSION } = require("../functions/pricing");
const { makeUsageRecorder } = require("../functions/usage");

// ---------- fixtures ----------

// A 60x40 "photo": navy with a red block at the top-left.
async function makePhotoJpeg() {
  const raw = Buffer.alloc(60 * 40 * 3);
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 60; x++) {
      const i = (y * 60 + x) * 3;
      const red = x < 20 && y < 20;
      raw[i] = red ? 200 : 20;
      raw[i + 1] = red ? 30 : 30;
      raw[i + 2] = red ? 30 : 90;
    }
  }
  return sharp(raw, { raw: { width: 60, height: 40, channels: 3 } }).jpeg().toBuffer();
}

// The same photo as a phone would store it: pixels rotated 90 CCW
// (40x60) with EXIF orientation 6 ("rotate 90 CW to display").
async function makeExifPhotoJpeg() {
  const display = await makePhotoJpeg();
  const storedPixels = await sharp(display).rotate(-90).toBuffer();
  return sharp(storedPixels).withMetadata({ orientation: 6 }).jpeg().toBuffer();
}

// A cutout PNG (default 60x40, matching the photo's aspect) with
// one centered opaque blob over transparency.
async function makeCutoutPng(width = 60, height = 40, blobs = [[15, 8, 45, 32]]) {
  const raw = Buffer.alloc(width * height * 4);
  for (const [x0, y0, x1, y1] of blobs) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        raw[i] = 20; raw[i + 1] = 30; raw[i + 2] = 90; raw[i + 3] = 255;
      }
    }
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function makeRes({ ok = true, status = 200, jsonBody = null, bytes = null, textBody = "" }) {
  return {
    ok,
    status,
    json: async () => jsonBody,
    text: async () => textBody,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

// Fake Replicate: create returns a prediction (succeeded, or
// processing-then-succeeded when `poll` is set); the output URL
// serves the cutout bytes. Records what the provider was sent.
function fakeReplicate(cutoutPng, { poll = false, predictSeconds = 2.5 } = {}) {
  const calls = [];
  const succeeded = {
    id: "pred1",
    status: "succeeded",
    output: "https://out.example/cutout.png",
    urls: { get: "https://api.replicate.com/v1/predictions/pred1" },
    metrics: { predict_time: predictSeconds },
  };
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url === "https://out.example/cutout.png") {
      return makeRes({ bytes: cutoutPng });
    }
    if (url.endsWith("/predictions/pred1")) {
      return makeRes({ jsonBody: succeeded });
    }
    if (url.includes("/models/") && url.endsWith("/predictions")) {
      assert.equal(opts.headers.Authorization, "Bearer test-key");
      const body = JSON.parse(opts.body);
      assert.ok(body.input.image.startsWith("data:image/"), "image sent as data URI");
      return makeRes({ jsonBody: poll ? { ...succeeded, status: "processing" } : succeeded });
    }
    throw new Error("unexpected fetch: " + url);
  };
  return { fetchImpl, calls };
}

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

const okChecker = async () => ({
  text: JSON.stringify({ ok: true, problems: [] }),
  usage: { promptTokenCount: 1000, candidatesTokenCount: 20, thoughtsTokenCount: 100 },
  model: "gemini-3.5-flash",
});

// ---------- renderPathFor ----------

describe("renderPathFor", () => {
  test("is deterministic and namespaced per user", () => {
    const a = renderPathFor("u1", "users/u1/photos/a.jpg");
    assert.equal(a, renderPathFor("u1", "users/u1/photos/a.jpg"));
    assert.ok(a.startsWith("users/u1/renders/"));
    assert.ok(a.endsWith(".png"));
  });

  test("differs across photos and users", () => {
    const base = renderPathFor("u1", "users/u1/photos/a.jpg");
    assert.notEqual(base, renderPathFor("u1", "users/u1/photos/b.jpg"));
    assert.notEqual(base, renderPathFor("u2", "users/u1/photos/a.jpg"));
  });
});

// ---------- birefnet provider ----------

describe("segmentImage (birefnet provider)", () => {
  test("missing key is a configuration error, not a call", async () => {
    await assert.rejects(
      () => segmentImage(Buffer.from("x"), "image/jpeg", null, async () => { throw new Error("must not be called"); }),
      (err) => err.key === "EXTRACT_NOT_CONFIGURED"
    );
  });

  test("succeeded prediction downloads the PNG and reports predict_time", async () => {
    const cutout = await makeCutoutPng();
    const { fetchImpl } = fakeReplicate(cutout);
    const out = await segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", fetchImpl, { sleepImpl: async () => {} });
    assert.ok(out.png.equals(cutout));
    assert.equal(out.uncertainty, null);
    assert.equal(out.predictSeconds, 2.5);
    assert.equal(MODEL, "sprited/birefnet");
  });

  test("polls a processing prediction until it succeeds", async () => {
    const cutout = await makeCutoutPng();
    const { fetchImpl, calls } = fakeReplicate(cutout, { poll: true });
    const out = await segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", fetchImpl, { sleepImpl: async () => {} });
    assert.ok(out.png.equals(cutout));
    assert.ok(calls.some((c) => c.url.endsWith("/predictions/pred1")), "polled the prediction URL");
  });

  test("an API rejection maps to EXTRACT_FAILED", async () => {
    const failing = async () => makeRes({ ok: false, status: 401, textBody: "bad token" });
    await assert.rejects(
      () => segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", failing),
      (err) => err.key === "EXTRACT_FAILED"
    );
  });

  test("a failed prediction maps to EXTRACT_FAILED", async () => {
    const failed = async () =>
      makeRes({ jsonBody: { id: "p", status: "failed", error: "boom", urls: { get: "x" } } });
    await assert.rejects(
      () => segmentImage(Buffer.from("jpeg"), "image/jpeg", "test-key", failed),
      (err) => err.key === "EXTRACT_FAILED" && /boom/.test(err.message)
    );
  });
});

// ---------- imagenorm ----------

describe("normalizeOrientation", () => {
  test("bakes EXIF orientation 6 into the pixels", async () => {
    const stored = await makeExifPhotoJpeg();
    const storedMeta = await sharp(stored).metadata();
    assert.equal(storedMeta.width, 40); // pixels really are stored sideways
    assert.equal(storedMeta.orientation, 6);

    const out = await normalizeOrientation(stored);
    assert.equal(out.width, 60);
    assert.equal(out.height, 40);
    assert.equal(out.mimeType, "image/jpeg");

    // The red block is back at the top-left in display orientation.
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => {
      const i = (y * info.width + x) * info.channels;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };
    assert.ok(px(5, 5).r > 150, "top-left is red again");
    assert.ok(px(55, 35).r < 80, "bottom-right is navy");
  });

  test("a tagless image keeps its dimensions", async () => {
    const plain = await makePhotoJpeg();
    const out = await normalizeOrientation(plain);
    assert.equal(out.width, 60);
    assert.equal(out.height, 40);
  });
});

describe("alphaStats + judgeMask", () => {
  test("one clean blob passes", async () => {
    const png = await makeCutoutPng();
    const stats = await alphaStats(png);
    assert.ok(stats.fgFraction > 0.2 && stats.fgFraction < 0.4);
    assert.equal(stats.components, 1);
    assert.equal(stats.largestShareOfFg, 1);
    assert.deepEqual(judgeMask(stats, { width: 60, height: 40 }), { pass: true, reasons: [] });
  });

  test("an empty cutout fails on foreground fraction", async () => {
    const png = await makeCutoutPng(60, 40, []);
    const stats = await alphaStats(png);
    const verdict = judgeMask(stats, { width: 60, height: 40 });
    assert.equal(verdict.pass, false);
    assert.ok(verdict.reasons.some((r) => r.startsWith("fg_fraction")));
  });

  test("two equal blobs fail as fragmented", async () => {
    const png = await makeCutoutPng(60, 40, [[2, 8, 20, 32], [40, 8, 58, 32]]);
    const stats = await alphaStats(png);
    const verdict = judgeMask(stats, { width: 60, height: 40 });
    assert.equal(verdict.pass, false);
    assert.ok(verdict.reasons.some((r) => r.startsWith("fragmented")));
  });

  test("a rotated render fails the aspect assertion", async () => {
    const png = await makeCutoutPng(40, 60, [[8, 15, 32, 45]]);
    const stats = await alphaStats(png);
    const verdict = judgeMask(stats, { width: 60, height: 40 });
    assert.equal(verdict.pass, false);
    assert.ok(verdict.reasons.some((r) => r.startsWith("aspect_mismatch")));
  });
});

// ---------- extractcheck verdict parsing ----------

describe("parseVerdict", () => {
  test("explicit ok passes", () => {
    assert.deepEqual(parseVerdict('{"ok": true, "problems": []}'), { ok: true, problems: [] });
  });

  test("ok:false keeps its problems", () => {
    const v = parseVerdict('{"ok": false, "problems": ["bag strap included"]}');
    assert.equal(v.ok, false);
    assert.deepEqual(v.problems, ["bag strap included"]);
  });

  test("garbage and empties are check errors, never passes", () => {
    assert.equal(parseVerdict("the cutout looks fine").checkError, true);
    assert.equal(parseVerdict("").checkError, true);
    assert.equal(parseVerdict('{"ok": "true"}').ok, false);
  });
});

// ---------- pricing + usage (OBS-3a) ----------

describe("priceEvent", () => {
  test("vertex tokens price at the stamped rates, thinking as output", () => {
    const cost = priceEvent({
      provider: "vertex", model: "gemini-3.5-flash",
      tokensIn: 1_000_000, tokensOut: 1_000_000, tokensThinking: 500_000,
    });
    assert.equal(cost, 1.5 + 9.0 * 1.5);
  });

  test("replicate prices predict seconds", () => {
    const cost = priceEvent({ provider: "replicate", model: "sprited/birefnet", predictSeconds: 10 });
    assert.ok(Math.abs(cost - 0.00225) < 1e-9);
  });

  test("unknown models and missing units price as null", () => {
    assert.equal(priceEvent({ provider: "vertex", model: "nope", tokensIn: 5 }), null);
    assert.equal(priceEvent({ provider: "replicate", model: "sprited/birefnet" }), null);
    assert.equal(priceEvent({ provider: "vertex", model: "gemini-3.5-flash" }), null);
    assert.ok(PRICING_VERSION.length > 0);
  });
});

describe("makeUsageRecorder", () => {
  test("writes a priced, versioned event and never throws", async () => {
    const written = [];
    const db = { collection: (name) => ({ add: async (doc) => { assert.equal(name, "ai_usage"); written.push(doc); } }) };
    const record = makeUsageRecorder(db);
    await record({ feature: "extractGarment.check", provider: "vertex", model: "gemini-3.5-flash", tokensIn: 2000, outcome: "success" });
    assert.equal(written.length, 1);
    assert.equal(written[0].pricingVersion, PRICING_VERSION);
    assert.ok(written[0].costUsd > 0);

    const broken = makeUsageRecorder({ collection: () => ({ add: async () => { throw new Error("firestore down"); } }) });
    await broken({ feature: "x", provider: "vertex" }); // must resolve, not reject
  });
});

// ---------- orchestration ----------

describe("extractGarmentPhoto", () => {
  test("refuses a path outside the caller's prefix", async () => {
    const photo = await makePhotoJpeg();
    const cutout = await makeCutoutPng();
    await assert.rejects(
      () =>
        extractGarmentPhoto("u1", "users/u2/photos/a.jpg", {
          bucket: fakeBucket(photo),
          apiKey: "k",
          fetchImpl: fakeReplicate(cutout).fetchImpl,
        }),
      (err) => err.key === "NOT_YOUR_PHOTO"
    );
  });

  test("no key configured fails before touching storage", async () => {
    const photo = await makePhotoJpeg();
    await assert.rejects(
      () =>
        extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
          bucket: fakeBucket(photo),
          apiKey: null,
          fetchImpl: async () => { throw new Error("must not be called"); },
        }),
      (err) => err.key === "EXTRACT_NOT_CONFIGURED"
    );
  });

  test("happy path: render saved, gate passes, both usage events land", async () => {
    const photo = await makeExifPhotoJpeg(); // sideways pixels + EXIF 6
    const cutout = await makeCutoutPng();
    const { fetchImpl, calls } = fakeReplicate(cutout);
    const bucket = fakeBucket(photo);
    const usageEvents = [];
    const out = await extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
      bucket,
      apiKey: "test-key",
      fetchImpl,
      callModel: okChecker,
      correlationId: "req_test",
      recordUsage: async (f) => usageEvents.push(f),
    });

    const expected = renderPathFor("u1", "users/u1/photos/a.jpg");
    assert.equal(out.renderStoragePath, expected);
    assert.equal(out.provider, "birefnet");
    assert.equal(out.gatePassed, true);
    assert.equal(out.gate.stage, "vision");
    assert.ok(bucket.saved[expected], "render saved at the deterministic path");
    assert.equal(bucket.saved[expected].opts.contentType, "image/png");

    // The provider received the orientation-baked image (60x40,
    // not the stored 40x60): decode what was actually sent.
    const createCall = calls.find((c) => c.url.includes("/models/"));
    const sent = JSON.parse(createCall.opts.body).input.image;
    const sentMeta = await sharp(Buffer.from(sent.split(",")[1], "base64")).metadata();
    assert.equal(sentMeta.width, 60);
    assert.equal(sentMeta.height, 40);

    assert.equal(usageEvents.length, 2);
    const providerEvent = usageEvents.find((e) => e.feature === "extractGarment.provider");
    assert.equal(providerEvent.outcome, "success");
    assert.equal(providerEvent.predictSeconds, 2.5);
    assert.equal(providerEvent.correlationId, "req_test");
    const checkEvent = usageEvents.find((e) => e.feature === "extractGarment.check");
    assert.equal(checkEvent.outcome, "success");
    assert.equal(checkEvent.tokensIn, 1000);
    assert.equal(checkEvent.tokensThinking, 100);
  });

  test("vision rejection: render saved but gatePassed false, outcome gate_rejected", async () => {
    const photo = await makePhotoJpeg();
    const cutout = await makeCutoutPng();
    const { fetchImpl } = fakeReplicate(cutout);
    const bucket = fakeBucket(photo);
    const usageEvents = [];
    const rejectingChecker = async () => ({
      text: JSON.stringify({ ok: false, problems: ["extra object included"] }),
      usage: { promptTokenCount: 900, candidatesTokenCount: 15, thoughtsTokenCount: 50 },
      model: "gemini-3.5-flash",
    });
    const out = await extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
      bucket,
      apiKey: "test-key",
      fetchImpl,
      callModel: rejectingChecker,
      recordUsage: async (f) => usageEvents.push(f),
    });
    assert.equal(out.gatePassed, false);
    assert.equal(out.gate.stage, "vision");
    assert.deepEqual(out.gate.problems, ["extra object included"]);
    assert.ok(bucket.saved[out.renderStoragePath], "rejected render still saved as evidence");
    const checkEvent = usageEvents.find((e) => e.feature === "extractGarment.check");
    assert.equal(checkEvent.outcome, "gate_rejected");
  });

  test("mask failure short-circuits before the vision check", async () => {
    const photo = await makePhotoJpeg();
    const emptyCutout = await makeCutoutPng(60, 40, []); // fully transparent
    const { fetchImpl } = fakeReplicate(emptyCutout);
    let checkerCalled = false;
    const out = await extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
      bucket: fakeBucket(photo),
      apiKey: "test-key",
      fetchImpl,
      callModel: async () => { checkerCalled = true; return okChecker(); },
      recordUsage: async () => {},
    });
    assert.equal(out.gatePassed, false);
    assert.equal(out.gate.stage, "mask");
    assert.equal(checkerCalled, false);
  });

  test("provider failure throws and records an error usage event", async () => {
    const photo = await makePhotoJpeg();
    const usageEvents = [];
    const failing = async () => makeRes({ ok: false, status: 500, textBody: "replicate down" });
    await assert.rejects(
      () =>
        extractGarmentPhoto("u1", "users/u1/photos/a.jpg", {
          bucket: fakeBucket(photo),
          apiKey: "test-key",
          fetchImpl: failing,
          callModel: okChecker,
          recordUsage: async (f) => usageEvents.push(f),
        }),
      (err) => err.key === "EXTRACT_FAILED"
    );
    assert.equal(usageEvents.length, 1);
    assert.equal(usageEvents[0].feature, "extractGarment.provider");
    assert.equal(usageEvents[0].outcome, "error:EXTRACT_FAILED");
  });
});
