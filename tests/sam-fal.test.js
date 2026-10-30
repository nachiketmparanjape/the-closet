// PC-36: fal SAM backend (founder decision 2026-10-29 —
// Replicate's cold starts are too slow). The queue HTTP
// runs against stub fetch implementations (no network);
// maskToCutout is exercised on synthetic pixels.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const sharp = require("module").createRequire(
  __dirname + "/../functions/sam.js"
)("sharp");
const {
  convertBox,
  createFalSegmentation,
  getFalSegmentation,
  fetchMaskBuffer,
} = require("../functions/sam-fal");
const sam = require("../functions/sam");

// A stub fetch that plays a canned fal conversation: storage
// upload (initiate -> PUT) -> queue submit -> IN_PROGRESS ->
// COMPLETED -> result, plus the mask download. Records every
// request for assertions.
function falStub(maskPng) {
  const seen = [];
  let polls = 0;
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    const json = (obj) => ({ ok: true, status: 200, json: async () => obj });
    if (url === "https://rest.alpha.fal.ai/storage/upload/initiate" && init && init.method === "POST") {
      return json({
        upload_url: "https://upload.example/put",
        file_url: "https://fal.media/files/input.jpg",
      });
    }
    if (url === "https://upload.example/put" && init && init.method === "PUT") {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (url.endsWith("/fal-ai/sam-3/image") && init && init.method === "POST") {
      return json({
        status: "IN_QUEUE",
        request_id: "req-1",
        status_url: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status",
        response_url: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1",
      });
    }
    if (url.includes("/requests/req-1/status")) {
      polls++;
      return json({ status: polls === 1 ? "IN_PROGRESS" : "COMPLETED", request_id: "req-1" });
    }
    if (url.includes("/requests/req-1")) {
      return json({
        masks: [{ url: "https://fal.media/mask.png", width: 100, height: 100 }],
        scores: [0.93],
        boxes: [[0.5, 0.5, 0.4, 0.6]],
      });
    }
    if (url === "https://fal.media/mask.png") {
      return { ok: true, status: 200, arrayBuffer: async () => maskPng };
    }
    throw new Error("unexpected url " + url);
  };
  return { fetchImpl, seen };
}

// 100x100 PNG: white rect (20,20)-(80,80) on black.
async function syntheticMask() {
  const svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="black"/><rect x="20" y="20" width="60" height="60" fill="white"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("convertBox", () => {
  test("fal [cx,cy,w,h] becomes pipeline [x_min,y_min,w,h]", () => {
    assert.deepStrictEqual(convertBox([0.5, 0.5, 0.4, 0.6]), [0.3, 0.2, 0.4, 0.6]);
  });
  test("clamps to the unit square", () => {
    assert.deepStrictEqual(convertBox([0.9, 0.9, 0.4, 0.4]), [0.7, 0.7, 0.4, 0.4]);
  });
  test("garbage in, null out", () => {
    assert.strictEqual(convertBox(null), null);
    assert.strictEqual(convertBox([0.5, 0.5]), null);
    assert.strictEqual(convertBox(["a", 0, 0, 0]), null);
  });
});

describe("fal queue client", () => {
  test("submit uploads the bytes to fal storage and sends Key auth", async () => {
    const { fetchImpl, seen } = falStub(await syntheticMask());
    const r = await createFalSegmentation({
      apiKey: "FALKEY",
      imageBuffer: Buffer.from([1, 2, 3]),
      filename: "p1.jpg",
      prompt: "shirt",
      fetchImpl,
    });
    assert.strictEqual(r.predictionId, "req-1");
    assert.strictEqual(r.status, "processing");
    assert.strictEqual(r.statusUrl, "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status");
    assert.strictEqual(r.responseUrl, "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1");
    // the storage initiate carries Key auth and the file metadata
    const init = seen.find((s) => s.url.includes("/storage/upload/initiate"));
    assert.strictEqual(init.init.headers.Authorization, "Key FALKEY");
    assert.deepStrictEqual(JSON.parse(init.init.body), {
      file_name: "p1.jpg",
      content_type: "image/jpeg",
    });
    // the raw bytes go to the upload URL with no auth header
    const put = seen.find((s) => s.url === "https://upload.example/put");
    assert.strictEqual(put.init.headers.Authorization, undefined);
    assert.deepStrictEqual(put.init.body, Buffer.from([1, 2, 3]));
    // the queue submit references the fal storage URL — never a
    // third-party URL (that 422'd live 2026-10-29)
    const submit = seen.find((s) => s.url.endsWith("/fal-ai/sam-3/image"));
    const body = JSON.parse(submit.init.body);
    assert.strictEqual(body.image_url, "https://fal.media/files/input.jpg");
    assert.strictEqual(body.prompt, "shirt");
    assert.strictEqual(body.include_scores, true);
    assert.strictEqual(body.include_boxes, true);
  });

  test("submit without a key fails closed", async () => {
    const { fetchImpl } = falStub(await syntheticMask());
    await assert.rejects(
      createFalSegmentation({ imageBuffer: Buffer.from([1]), prompt: "y", fetchImpl }),
      (e) => e.key === "SAM_NOT_CONFIGURED"
    );
  });

  test("submit without image bytes fails closed", async () => {
    const { fetchImpl } = falStub(await syntheticMask());
    await assert.rejects(
      createFalSegmentation({ apiKey: "FALKEY", prompt: "y", fetchImpl }),
      (e) => e.key === "SAM_FAILED"
    );
  });

  test("a failed storage upload throws loudly — never a silent fallback", async () => {
    const { uploadToFalStorage } = require("../functions/sam-fal");
    const fetchImpl = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ detail: "boom" }),
    });
    await assert.rejects(
      uploadToFalStorage({
        apiKey: "FALKEY",
        buffer: Buffer.from([1]),
        filename: "p1.jpg",
        fetchImpl,
      }),
      (e) => e.key === "SAM_FAILED" && /initiate status 500/.test(e.message)
    );
  });

  test("poll maps IN_PROGRESS then harvests COMPLETED", async () => {
    const { fetchImpl, seen } = falStub(await syntheticMask());
    const p1 = await getFalSegmentation({
      apiKey: "FALKEY",
      predictionId: "req-1",
      statusUrl: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status",
      responseUrl: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1",
      fetchImpl,
    });
    assert.strictEqual(p1.status, "processing");
    assert.strictEqual(p1.output, null);
    // the poll hits fal's own status_url, not a hand-built path
    assert.ok(seen.some((s) => s.url === "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status"));
    const p2 = await getFalSegmentation({
      apiKey: "FALKEY",
      predictionId: "req-1",
      statusUrl: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status",
      responseUrl: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1",
      fetchImpl,
    });
    assert.strictEqual(p2.status, "succeeded");
    assert.deepStrictEqual(p2.output.pred_scores, [0.93]);
    assert.deepStrictEqual(p2.output.pred_boxes, [[0.3, 0.2, 0.4, 0.6]]);
    assert.strictEqual(p2.output.pred_masks.length, 1);
    assert.strictEqual(p2.output.pred_masks[0].url, "https://fal.media/mask.png");
  });

  test("poll falls back to the constructed path without status_url", async () => {
    const { fetchImpl, seen } = falStub(await syntheticMask());
    const p1 = await getFalSegmentation({ apiKey: "FALKEY", predictionId: "req-1", fetchImpl });
    assert.strictEqual(p1.status, "processing");
    assert.ok(seen.some((s) => s.url === "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status"));
  });

  test("a failed result surfaces fal's error body", async () => {
    const fetchImpl = async (url) => {
      const json = (obj, status = 200) => ({ ok: status === 200, status, json: async () => obj });
      if (url.includes("/status")) return json({ status: "COMPLETED", request_id: "req-1" });
      return json({ detail: "image fetch failed" }, 422);
    };
    const p = await getFalSegmentation({
      apiKey: "FALKEY",
      predictionId: "req-1",
      statusUrl: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1/status",
      responseUrl: "https://queue.fal.run/fal-ai/sam-3/image/requests/req-1",
      fetchImpl,
    });
    assert.strictEqual(p.status, "failed");
    assert.ok(p.error.includes("image fetch failed"), p.error);
  });
});

describe("selectInstance with fal output", () => {
  test("picks the mask image by score", () => {
    const inst = sam.selectInstance({
      pred_scores: [0.4, 0.93],
      pred_boxes: [
        [0, 0, 0.1, 0.1],
        [0.3, 0.2, 0.4, 0.6],
      ],
      pred_masks: [{ url: "https://a/m.png" }, { url: "https://b/m.png" }],
    });
    assert.strictEqual(inst.score, 0.93);
    assert.strictEqual(inst.maskUrl, "https://b/m.png");
    assert.deepStrictEqual(inst.box, [0.3, 0.2, 0.4, 0.6]);
    assert.deepStrictEqual(inst.rings, []);
  });
  test("empty masks is not-found", () => {
    assert.strictEqual(
      sam.selectInstance({ pred_scores: [], pred_boxes: [], pred_masks: [] }),
      null
    );
  });
});

describe("maskToCutout", () => {
  test("mask becomes the alpha channel at image resolution", async () => {
    const image = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 200, g: 30, b: 30 } },
    })
      .png()
      .toBuffer();
    const mask = await syntheticMask(); // 100x100, white rect (20,20)-(80,80)
    const cut = await sam.maskToCutout({ imageBuffer: image, maskBuffer: mask });
    const { data, info } = await sharp(cut).raw().toBuffer({ resolveWithObject: true });
    assert.strictEqual(info.channels, 4);
    // Mask rect scales 100x100 -> 200x150 (fill): rect (40,30)-(160,120).
    const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
    assert.strictEqual(alphaAt(100, 75), 255); // inside the rect
    assert.strictEqual(alphaAt(5, 5), 0); // outside the rect
    assert.strictEqual(alphaAt(195, 145), 0);
  });

  test("mostly-white mask is treated as inverted", async () => {
    const image = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 200, g: 30, b: 30 } },
    })
      .png()
      .toBuffer();
    const allWhite = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();
    const cut = await sam.maskToCutout({ imageBuffer: image, maskBuffer: allWhite });
    const { data, info } = await sharp(cut).raw().toBuffer({ resolveWithObject: true });
    assert.strictEqual(data[(20 * info.width + 20) * 4 + 3], 0);
  });
});

describe("samBackend router", () => {
  test("fal without FAL_API_KEY fails closed", async () => {
    process.env.SAM_BACKEND = "fal";
    delete process.env.FAL_API_KEY;
    try {
      await assert.rejects(
        sam.createSegmentation({ imageUrl: "x", prompt: "y", fetchImpl: async () => ({}) }),
        (e) => e.key === "SAM_NOT_CONFIGURED"
      );
    } finally {
      delete process.env.SAM_BACKEND;
    }
  });

  test("fal routes to the queue client when the key is set", async () => {
    process.env.SAM_BACKEND = "fal";
    process.env.FAL_API_KEY = "FALKEY";
    const { fetchImpl } = falStub(await syntheticMask());
    try {
      const r = await sam.createSegmentation({
        imageBuffer: Buffer.from([1, 2, 3]),
        filename: "p1.jpg",
        prompt: "shirt",
        fetchImpl,
      });
      assert.strictEqual(r.predictionId, "req-1");
    } finally {
      delete process.env.SAM_BACKEND;
      delete process.env.FAL_API_KEY;
    }
  });

  test("default routes to Replicate", async () => {
    delete process.env.SAM_BACKEND;
    const fetchImpl = async (url, init) => {
      if (url.includes("/models/")) {
        return { ok: true, json: async () => ({ latest_version: { id: "v1" } }) };
      }
      return { ok: true, json: async () => ({ id: "p1", status: "starting" }) };
    };
    const r = await sam.createSegmentation({
      apiKey: "k",
      imageUrl: "https://x/in.jpg",
      prompt: "shirt",
      fetchImpl,
      sleep: async () => {},
    });
    assert.strictEqual(r.predictionId, "p1");
  });
});

describe("fetchMaskBuffer", () => {
  test("downloads the mask bytes", async () => {
    const mask = await syntheticMask();
    const { fetchImpl } = falStub(mask);
    const buf = await fetchMaskBuffer({ url: "https://fal.media/mask.png", fetchImpl });
    assert.ok(buf.equals(mask));
  });
});
