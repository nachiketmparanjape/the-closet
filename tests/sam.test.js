// PC-36: SAM provider seam. Pure selection + cutout are
// tested directly; the Replicate calls run against stub
// fetch implementations (no network).
const { test, describe } = require("node:test");
const assert = require("node:assert");
// sharp lives in functions/node_modules (the deployed
// surface); resolve it as if from a functions module.
const sharp = require("module").createRequire(
  __dirname + "/../functions/sam.js"
)("sharp");
const {
  selectInstance,
  polygonToCutout,
  ringArea,
  createSegmentation,
  getSegmentation,
  uploadInputImage,
  toSamInput,
} = require("../functions/sam");

describe("toSamInput", () => {
  test("RGBA PNG becomes RGB JPEG at the same size", async () => {
    const rgba = await sharp({
      create: { width: 40, height: 30, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } },
    })
      .png()
      .toBuffer();
    const out = await toSamInput(rgba);
    const meta = await sharp(out).metadata();
    assert.strictEqual(meta.format, "jpeg");
    assert.strictEqual(meta.channels, 3);
    assert.strictEqual(meta.width, 40);
    assert.strictEqual(meta.height, 30);
  });
  test("RGB JPEG stays RGB JPEG at the same size", async () => {
    const rgb = await sharp({
      create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 30, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    const out = await toSamInput(rgb);
    const meta = await sharp(out).metadata();
    assert.strictEqual(meta.format, "jpeg");
    assert.strictEqual(meta.channels, 3);
    assert.strictEqual(meta.width, 40);
    assert.strictEqual(meta.height, 30);
  });
});

describe("ringArea", () => {
  test("square 10x10 has area 100", () => {
    assert.strictEqual(ringArea([0, 0, 10, 0, 10, 10, 0, 10]), 100);
  });
  test("degenerate ring has area 0", () => {
    assert.strictEqual(ringArea([5, 5]), 0);
  });
});

describe("selectInstance", () => {
  test("highest score wins", () => {
    const out = {
      pred_scores: [0.5, 0.9, 0.7],
      pred_polygons: [
        [[0, 0, 10, 0, 10, 10]],
        [[0, 0, 20, 0, 20, 20]],
        [[0, 0, 5, 0, 5, 5]],
      ],
      pred_boxes: ["a", "b", "c"],
    };
    const s = selectInstance(out);
    assert.strictEqual(s.index, 1);
    assert.strictEqual(s.score, 0.9);
    assert.strictEqual(s.box, "b");
    assert.strictEqual(s.detections, 3);
  });
  test("ties break toward the larger mask", () => {
    const out = {
      pred_scores: [0.8, 0.8],
      pred_polygons: [
        [[0, 0, 10, 0, 10, 10]],
        [[0, 0, 20, 0, 20, 20]],
      ],
    };
    assert.strictEqual(selectInstance(out).index, 1);
  });
  test("no detections returns null (not an error)", () => {
    assert.strictEqual(selectInstance({ pred_scores: [], pred_polygons: [] }), null);
    assert.strictEqual(selectInstance({}), null);
  });
});

describe("polygonToCutout", () => {
  test("square polygon keeps the inside, clears the outside", async () => {
    const img = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 30, b: 30 } },
    })
      .png()
      .toBuffer();
    const cut = await polygonToCutout({
      imageBuffer: img,
      rings: [[25, 25, 75, 25, 75, 75, 25, 75]],
    });
    const meta = await sharp(cut).metadata();
    assert.strictEqual(meta.channels, 4);
    const raw = await sharp(cut).raw().toBuffer();
    const px = (x, y) => {
      const i = (y * 100 + x) * 4;
      return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]];
    };
    assert.deepStrictEqual(px(50, 50), [200, 30, 30, 255]);
    assert.strictEqual(px(5, 5)[3], 0);
  });
  test("no usable rings throws", async () => {
    const img = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await assert.rejects(polygonToCutout({ imageBuffer: img, rings: [] }));
  });
});

describe("Replicate calls (stub fetch)", () => {
  test("create resolves the version, then creates by hash", async () => {
    const calls = [];
    const stub = async (url, init) => {
      calls.push(url);
      if (url.endsWith("/models/yodagg/sam3-image-seg")) {
        return { ok: true, json: async () => ({ latest_version: { id: "abc123" } }) };
      }
      const body = JSON.parse(init.body);
      assert.strictEqual(body.version, "abc123");
      assert.strictEqual(body.input.prompt, "black jacket");
      return { ok: true, json: async () => ({ id: "pred1", status: "starting" }) };
    };
    const r = await createSegmentation({
      apiKey: "k",
      imageUrl: "https://x/file",
      prompt: "black jacket",
      fetchImpl: stub,
      sleep: () => Promise.resolve(),
    });
    assert.strictEqual(r.predictionId, "pred1");
  });
  test("429s are retried with backoff, then succeed", async () => {
    let creates = 0;
    const waits = [];
    const stub = async (url, init) => {
      if (url.includes("/models/")) {
        return { ok: true, json: async () => ({ latest_version: { id: "v" } }) };
      }
      creates++;
      if (creates <= 2) {
        return { status: 429, text: async () => JSON.stringify({ retry_after: 1 }) };
      }
      return { ok: true, json: async () => ({ id: "p2", status: "starting" }) };
    };
    const r = await createSegmentation({
      apiKey: "k",
      imageUrl: "https://x/file",
      prompt: "tee",
      fetchImpl: stub,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    assert.strictEqual(r.predictionId, "p2");
    assert.strictEqual(waits.length, 2);
  });
  test("get returns output only on succeeded", async () => {
    const stub = async () => ({
      ok: true,
      json: async () => ({ status: "succeeded", output: { pred_scores: [0.9] } }),
    });
    const r = await getSegmentation({ apiKey: "k", predictionId: "p", fetchImpl: stub });
    assert.strictEqual(r.status, "succeeded");
    assert.deepStrictEqual(r.output, { pred_scores: [0.9] });
  });
  test("upload returns the serving URL, throws without one", async () => {
    const okStub = async () => ({
      ok: true,
      json: async () => ({ urls: { get: "https://replicate.delivery/f" } }),
    });
    const url = await uploadInputImage({
      apiKey: "k",
      buffer: Buffer.from("x"),
      filename: "a.jpg",
      fetchImpl: okStub,
    });
    assert.strictEqual(url, "https://replicate.delivery/f");
    const badStub = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(
      uploadInputImage({ apiKey: "k", buffer: Buffer.from("x"), fetchImpl: badStub })
    );
  });
});
