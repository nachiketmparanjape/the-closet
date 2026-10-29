// PC-36: parse pipeline — list parsing, prompt building,
// matching bands, and the start/advance handoff with
// fake Firestore + Storage + Replicate.
const { test, describe } = require("node:test");
const assert = require("node:assert");
// sharp lives in functions/node_modules; resolve it as if
// from a functions module.
const sharp = require("module").createRequire(
  __dirname + "/../functions/parse.js"
)("sharp");
const {
  startParse,
  advanceParse,
  retryGarment,
  parseListJson,
  buildPrompt,
  renderPathForParse,
  matchGarment,
  cosine,
} = require("../functions/parse");

// ---- minimal Firestore + Storage fakes ----

class FakeCollection {
  constructor(root, path) {
    this.root = root;
    this.path = path;
  }
  doc(id) {
    const docId = id || ("auto" + Math.random().toString(36).slice(2, 10));
    return new FakeDoc(this.root, this.path + "/" + docId, docId);
  }
  limit() {
    return this;
  }
  async get() {
    const prefix = this.path + "/";
    const docs = [];
    for (const [p, data] of Object.entries(this.root)) {
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes("/")) {
        docs.push({ exists: true, id: p.slice(prefix.length), data: () => data });
      }
    }
    return { docs };
  }
}

class FakeDoc {
  constructor(root, path, id) {
    this.root = root;
    this.path = path;
    this.id = id;
  }
  collection(name) {
    return new FakeCollection(this.root, this.path + "/" + name);
  }
  async get() {
    const d = this.root[this.path];
    return { exists: !!d, id: this.id, data: () => d };
  }
  async set(data) {
    this.root[this.path] = { ...data };
  }
  async update(data) {
    this.root[this.path] = { ...(this.root[this.path] || {}), ...data };
  }
}

class FakeDb {
  constructor() {
    this.root = {};
  }
  collection(name) {
    return new FakeCollection(this.root, name);
  }
}

class FakeBucket {
  constructor() {
    this.files = new Map();
  }
  file(path) {
    const files = this.files;
    return {
      async getMetadata() {
        if (!files.has(path)) throw new Error("not found");
        return [{ size: files.get(path).buffer.length }];
      },
      async download() {
        if (!files.has(path)) throw new Error("not found");
        return [files.get(path).buffer];
      },
      async save(buffer, opts) {
        files.set(path, { buffer, opts: opts || {} });
      },
    };
  }
}

async function redJpeg() {
  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}

describe("parseListJson", () => {
  test("parses a valid list", () => {
    const out = parseListJson(
      JSON.stringify({ garments: [{ type: "tee", colors: ["red"], detail: "graphic" }] })
    );
    assert.deepStrictEqual(out, [{ type: "tee", colors: ["red"], detail: "graphic" }]);
  });
  test("caps at 8 and skips typeless entries", () => {
    const garments = Array.from({ length: 10 }, (_, i) => ({ type: "tee" + i }));
    garments.push({ colors: ["red"] });
    const out = parseListJson(JSON.stringify({ garments }));
    assert.strictEqual(out.length, 8);
  });
  test("malformed JSON throws", () => {
    assert.throws(() => parseListJson("not json at all"));
    assert.throws(() => parseListJson(JSON.stringify({ nope: [] })));
  });
});

describe("buildPrompt", () => {
  test("colors + type + detail", () => {
    assert.strictEqual(
      buildPrompt({ type: "zip jacket", colors: ["black"], detail: "open front" }),
      "black zip jacket, open front"
    );
  });
  test("no colors, no detail", () => {
    assert.strictEqual(buildPrompt({ type: "tee", colors: [], detail: "" }), "tee");
  });
});

describe("cosine", () => {
  test("identical is 1, orthogonal is 0, zero vector is 0", () => {
    assert.strictEqual(cosine([1, 0], [1, 0]), 1);
    assert.strictEqual(cosine([1, 0], [0, 1]), 0);
    assert.strictEqual(cosine([0, 0], [1, 0]), 0);
  });
});

describe("renderPathForParse", () => {
  test("deterministic per garment", () => {
    const a = renderPathForParse("u", "p", "g0");
    assert.strictEqual(a, renderPathForParse("u", "p", "g0"));
    assert.notStrictEqual(a, renderPathForParse("u", "p", "g1"));
    assert.match(a, /^users\/u\/renders\/[0-9a-f]{32}\.png$/);
  });
});

describe("matchGarment", () => {
  const entry = (over) => ({
    itemId: "i1",
    itemName: "Tee",
    renderPhash: null,
    renderEmbedding: null,
    ...over,
  });
  test("pHash <= 5 proposes via phash", () => {
    const out = matchGarment(
      { renderPhash: "0000000000000000", renderEmbedding: null },
      [entry({ renderPhash: "0000000000000007" })],
      []
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].via, "phash");
    assert.strictEqual(out[0].band, "propose");
  });
  test("embedding bands: propose, possible, none", () => {
    const draft = { renderPhash: null, renderEmbedding: [1, 0] };
    const hi = matchGarment(draft, [entry({ renderEmbedding: [1, 0] })], []);
    assert.strictEqual(hi[0].band, "propose");
    const mid = matchGarment(draft, [entry({ renderEmbedding: [0.8, 0.6] })], []);
    assert.strictEqual(mid[0].band, "possible");
    const low = matchGarment(draft, [entry({ renderEmbedding: [0, 1] })], []);
    assert.strictEqual(low.length, 0);
  });
  test("a 0.97+ rejection suppresses, a weaker one does not", () => {
    const draft = { renderPhash: null, renderEmbedding: [1, 0] };
    const items = [entry({ renderEmbedding: [1, 0] })];
    const suppressed = matchGarment(draft, items, [{ itemId: "i1", embedding: [1, 0] }]);
    assert.strictEqual(suppressed.length, 0);
    const kept = matchGarment(draft, items, [{ itemId: "i1", embedding: [0.8, 0.6] }]);
    assert.strictEqual(kept.length, 1);
  });
  test("no render data means no candidates (default NEW)", () => {
    assert.deepStrictEqual(
      matchGarment({ renderPhash: null, renderEmbedding: null }, [entry({})], []),
      []
    );
  });
});

describe("startParse -> advanceParse", () => {
  function replicateStub(pollBody) {
    return async (url, init) => {
      if (url.includes("/models/")) {
        return { ok: true, json: async () => ({ latest_version: { id: "v1" } }) };
      }
      if (url.endsWith("/files")) {
        return { ok: true, json: async () => ({ urls: { get: "https://r.delivery/f" } }) };
      }
      if (url.endsWith("/predictions") && init.method === "POST") {
        return { ok: true, json: async () => ({ id: "pred1", status: "starting" }) };
      }
      if (url.includes("/predictions/pred1")) {
        return { ok: true, json: async () => pollBody };
      }
      throw new Error("unexpected fetch: " + url);
    };
  }

  test("list -> create -> harvest -> ready", async () => {
    const db = new FakeDb();
    const bucket = new FakeBucket();
    const photo = await redJpeg();
    bucket.files.set("users/u1/photos/a.jpg", { buffer: photo });
    const listModel = async () => ({
      text: JSON.stringify({ garments: [{ type: "tee", colors: ["red"], detail: "" }] }),
    });
    const started = await startParse("u1", "users/u1/photos/a.jpg", {
      db,
      bucket,
      apiKey: "k",
      fetchImpl: replicateStub(null),
      callModel: listModel,
    });
    assert.strictEqual(started.status, "cutting");
    assert.strictEqual(started.garments.length, 1);
    assert.strictEqual(started.garments[0].prompt, "red tee");
    assert.strictEqual(started.garments[0].status, "cutting");

    const orientModel = async () => ({ text: JSON.stringify({ rotation: "none" }) });
    const advanced = await advanceParse("u1", started.parseId, {
      db,
      bucket,
      apiKey: "k",
      fetchImpl: replicateStub({
        status: "succeeded",
        output: {
          pred_scores: [0.9],
          pred_polygons: [[[50, 50, 150, 50, 150, 150, 50, 150]]],
          pred_boxes: [[50, 50, 150, 150]],
        },
      }),
      callModel: orientModel,
      embedFn: async () => [1, 0, 0],
    });
    assert.strictEqual(advanced.status, "review");
    const g = advanced.garments[0];
    assert.strictEqual(g.status, "ready");
    assert.strictEqual(g.renderStatus, "passed");
    assert.strictEqual(g.renderRotation, 0);
    assert.strictEqual(g.rotation, 0);
    assert.match(g.renderStoragePath, /^users\/u1\/renders\/[0-9a-f]{32}\.png$/);
    assert.match(g.renderPhash, /^[0-9a-f]{16}$/);
    assert.deepStrictEqual(g.matchCandidates, []);
    assert.strictEqual(g.predictionId, undefined); // stripped from the public shape
  });

  test("still processing leaves the garment cutting", async () => {
    const db = new FakeDb();
    const bucket = new FakeBucket();
    bucket.files.set("users/u1/photos/a.jpg", { buffer: await redJpeg() });
    const listModel = async () => ({
      text: JSON.stringify({ garments: [{ type: "tee", colors: [], detail: "" }] }),
    });
    const started = await startParse("u1", "users/u1/photos/a.jpg", {
      db,
      bucket,
      apiKey: "k",
      fetchImpl: replicateStub(null),
      callModel: listModel,
    });
    const advanced = await advanceParse("u1", started.parseId, {
      db,
      bucket,
      apiKey: "k",
      fetchImpl: replicateStub({ status: "processing" }),
      callModel: async () => ({ text: "{}" }),
      embedFn: async () => [1],
    });
    assert.strictEqual(advanced.status, "cutting");
    assert.strictEqual(advanced.garments[0].status, "cutting");
  });

  test("retry re-creates a failed garment and reopens polling", async () => {
    const db = new FakeDb();
    const bucket = new FakeBucket();
    const baked = await redJpeg();
    const parseRef = db.collection("users").doc("u1").collection("parses").doc("p9");
    await parseRef.set({
      bakedStoragePath: "users/u1/parses/p9/source-baked.jpg",
      sourceWidth: 200,
      sourceHeight: 200,
      status: "review",
      garments: [
        { id: "g0", type: "tee", prompt: "red tee", predictionId: "old", status: "failed", error: "SAM failed" },
      ],
    });
    bucket.files.set("users/u1/parses/p9/source-baked.jpg", { buffer: baked });
    const fetchImpl = async (url, init) => {
      if (url.includes("/models/")) {
        return { ok: true, json: async () => ({ latest_version: { id: "v1" } }) };
      }
      if (url.endsWith("/files")) {
        return { ok: true, json: async () => ({ urls: { get: "https://r.delivery/f" } }) };
      }
      if (url.endsWith("/predictions") && init.method === "POST") {
        return { ok: true, json: async () => ({ id: "pred2", status: "starting" }) };
      }
      throw new Error("unexpected fetch: " + url);
    };
    const out = await retryGarment("u1", "p9", "g0", { db, bucket, apiKey: "k", fetchImpl });
    assert.strictEqual(out.status, "cutting");
    assert.strictEqual(out.garment.status, "cutting");
    assert.strictEqual(out.garment.predictionId, undefined); // public shape strips it
    const after = await parseRef.get();
    assert.strictEqual(after.data().status, "cutting");
    assert.strictEqual(after.data().garments[0].status, "cutting");
    assert.strictEqual(after.data().garments[0].predictionId, "pred2");
    assert.strictEqual(after.data().garments[0].error, null);
  });

  test("retry refuses a garment that is not failed or not-found", async () => {
    const db = new FakeDb();
    const bucket = new FakeBucket();
    const parseRef = db.collection("users").doc("u1").collection("parses").doc("p9");
    await parseRef.set({
      bakedStoragePath: "users/u1/parses/p9/source-baked.jpg",
      status: "cutting",
      garments: [{ id: "g0", type: "tee", prompt: "tee", predictionId: "p", status: "cutting" }],
    });
    await assert.rejects(
      retryGarment("u1", "p9", "g0", { db, bucket, apiKey: "k", fetchImpl: async () => ({}) }),
      /not retryable/
    );
  });

  test("zero detections marks not-found", async () => {
    const db = new FakeDb();
    const bucket = new FakeBucket();
    bucket.files.set("users/u1/photos/a.jpg", { buffer: await redJpeg() });
    const listModel = async () => ({
      text: JSON.stringify({ garments: [{ type: "tee", colors: [], detail: "" }] }),
    });
    const started = await startParse("u1", "users/u1/photos/a.jpg", {
      db,
      bucket,
      apiKey: "k",
      fetchImpl: replicateStub(null),
      callModel: listModel,
    });
    const advanced = await advanceParse("u1", started.parseId, {
      db,
      bucket,
      apiKey: "k",
      fetchImpl: replicateStub({ status: "succeeded", output: { pred_scores: [], pred_polygons: [] } }),
      callModel: async () => ({ text: "{}" }),
      embedFn: async () => [1],
    });
    assert.strictEqual(advanced.status, "review");
    assert.strictEqual(advanced.garments[0].status, "not-found");
  });
});
