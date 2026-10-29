"use strict";

// PC-36 parse pipeline: one photo -> draft wardrobe
// items + outfit, with the founder confirming every AI
// claim on the review screen.
//
// Flow (see docs/sprints/sprint-25/PC-36-DESIGN.md):
//   startParse: validate + EXIF-bake the source photo,
//     store the baked bytes (the polygon coordinates
//     are measured on exactly these pixels), ask Gemini
//     for the garment list (one call per photo, capped
//     at 8), create one SAM prediction per garment.
//     Returns the parse id; the doc sits at "cutting".
//   advanceParse: the poll driver. The CLIENT calls it
//     every few seconds while the review sheet is open
//     (and again when the sheet reopens — a parse left
//     mid-flight resumes instead of restarting).
//     Newly terminal predictions are harvested the
//     moment they complete (outputs left unread get
//     pruned), cut, mask-gated, orientation-judged,
//     normalized, rendered, hashed, embedded, and
//     matched. Per-piece failure never blocks the rest:
//     a failed piece gets a status + reason, the others
//     keep flowing. When every garment is terminal the
//     parse moves to "review".
//
// Drafts live in users/{uid}/parses/{parseId} — never
// in items — so no wardrobe query can surface an
// unconfirmed piece. Confirmed pieces are created by
// the CLIENT (slice 3) from the parse doc; this module
// never creates items or outfits.
//
// Matching (propose, never merge): pHash on the render
// (PC-19's space, <= 5) first, then Vertex multimodal
// embeddings (cosine >= 0.85 proposes, 0.70-0.85 is
// "possible"). Under uncertainty the draft is NEW.
// A recorded rejection suppresses an item when a
// stored rejection embedding for it is within cosine
// 0.97 of the draft embedding (near-identical renders
// only — a lower bar would wrongly suppress true
// matches of near-duplicate garments).
//
// Rotation fields are DEGREES (the client's
// photoRotationDeg reads numbers): the orientation
// verdict becomes the photo entry's `rotation` (the
// original view's turn) while `renderRotation` is set
// explicitly to 0 — the render is baked upright, and
// leaving renderRotation unset would make the clean
// view fall back to `rotation` and double-turn it.

const crypto = require("crypto");
const sharp = require("sharp");
const { codedError } = require("./errors");
const { normalizeOrientation, alphaStats, judgeMask } = require("./imagenorm");
const { getClient, reportUsage, MODEL_VERSION } = require("./describe");
const {
  toSamInput,
  uploadInputImage,
  createSegmentation,
  getSegmentation,
  selectInstance,
  polygonToCutout,
} = require("./sam");
const { normalizeRender, ROTATION_TO_ANGLE } = require("./render");
const { renderHash, phashDistance } = require("./phash");
const { judgeOrientation } = require("./orient");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GARMENTS = 8;
const PHASH_THRESHOLD = 5;
const MATCH_PROPOSE = 0.85;
const MATCH_POSSIBLE = 0.7;
const REJECT_SUPPRESS = 0.97;
const EMBED_MODEL = "multimodalembedding@001";

function renderPathForParse(uid, parseId, garmentId) {
  const hash = crypto
    .createHash("sha256")
    .update(parseId + ":" + garmentId)
    .digest("hex")
    .slice(0, 32);
  return "users/" + uid + "/renders/" + hash + ".png";
}

function buildPrompt(garment) {
  const head = [(garment.colors || []).join(" "), garment.type]
    .filter((s) => s && s.trim())
    .join(" ");
  return garment.detail && garment.detail.trim()
    ? head + ", " + garment.detail.trim()
    : head;
}

const LIST_PROMPT = `List every distinct garment visible in this photo. A jacket and the tee visible inside it are two garments; a pair of trousers is one garment. Skip people, furniture, and background objects.

Answer with ONLY a JSON object (no markdown, no prose): {"garments": [{"type": "jacket", "colors": ["black"], "detail": "open front, tee visible inside"}]}.

type is the garment kind in plain words ("jacket", "trousers", "tee", "dress", "shoes"). colors are plain words, up to 3, the garment's own colors (not the background's). detail is one short distinguishing phrase (a print, a zip, an open front) or "" when nothing distinguishes it.`;

function parseListJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw codedError("AI_BAD_RESPONSE", "parse: garment list was empty");
  }
  let parsed;
  try {
    parsed = JSON.parse(text.trim());
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch (e2) {
        /* fall through to the throw */
      }
    }
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.garments)) {
    throw codedError("AI_BAD_RESPONSE", "parse: garment list was not JSON");
  }
  const out = [];
  for (const g of parsed.garments) {
    if (!g || typeof g.type !== "string" || !g.type.trim()) continue;
    out.push({
      type: g.type.trim(),
      colors: Array.isArray(g.colors)
        ? g.colors.filter((c) => typeof c === "string" && c.trim()).slice(0, 3)
        : [],
      detail: typeof g.detail === "string" ? g.detail.trim() : "",
    });
    if (out.length >= MAX_GARMENTS) break;
  }
  return out;
}

function buildListRequest(bakedBuffer, mimeType) {
  return {
    model: process.env.GEMINI_MODEL || MODEL_VERSION,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: bakedBuffer.toString("base64"),
            },
          },
          { text: LIST_PROMPT },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  };
}

async function listGarments({ callModel, bakedBuffer, mimeType, hooks }) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const caller = callModel || ((r) => getClient().models.generateContent(r));
  const callStart = Date.now();
  let response;
  try {
    response = await caller(buildListRequest(bakedBuffer, mimeType));
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "parse: garment list failed: " + (err && err.message));
  }
  reportUsage(hooks, response, model, callStart);
  const text = (response.text || "").trim();
  if (!text) {
    throw codedError("AI_BAD_RESPONSE", "parse: garment list was empty");
  }
  return parseListJson(text);
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// photoEntries: [{itemId, itemName, renderPhash, renderEmbedding}]
// rejections: [{itemId, embedding}]
// Returns candidates sorted propose-first, each with band.
function matchGarment({ renderPhash, renderEmbedding }, photoEntries, rejections) {
  const rejected = (itemId) => {
    if (!renderEmbedding) return false;
    return (rejections || []).some(
      (r) =>
        r.itemId === itemId &&
        Array.isArray(r.embedding) &&
        cosine(renderEmbedding, r.embedding) >= REJECT_SUPPRESS
    );
  };
  const proposed = [];
  const possible = [];
  for (const entry of photoEntries || []) {
    if (rejected(entry.itemId)) continue;
    const ph =
      renderPhash && entry.renderPhash
        ? phashDistance(renderPhash, entry.renderPhash)
        : 99;
    const emb =
      renderEmbedding && Array.isArray(entry.renderEmbedding)
        ? cosine(renderEmbedding, entry.renderEmbedding)
        : null;
    if (ph <= PHASH_THRESHOLD) {
      proposed.push({ itemId: entry.itemId, itemName: entry.itemName, via: "phash", score: ph, band: "propose" });
    } else if (emb !== null && emb >= MATCH_PROPOSE) {
      proposed.push({ itemId: entry.itemId, itemName: entry.itemName, via: "embedding", score: emb, band: "propose" });
    } else if (emb !== null && emb >= MATCH_POSSIBLE) {
      possible.push({ itemId: entry.itemId, itemName: entry.itemName, via: "embedding", score: emb, band: "possible" });
    }
  }
  proposed.sort((a, b) => {
    if (a.via === "phash" && b.via !== "phash") return -1;
    if (a.via !== "phash" && b.via === "phash") return 1;
    if (a.via === "phash") return a.score - b.score;
    return b.score - a.score;
  });
  possible.sort((a, b) => b.score - a.score);
  return proposed.concat(possible);
}

function defaultGetAccessToken() {
  // firebase-admin is a direct dependency; ADC (metadata
  // server in Cloud Functions) supplies the token. Lazy
  // require keeps unit tests from loading admin at all.
  const admin = require("firebase-admin");
  return admin
    .credential.applicationDefault()
    .getAccessToken()
    .then((t) => t.access_token);
}

// Vertex multimodal embeddings (REST — the GenAI SDK's
// embedContent does not cover this publisher model).
// The render goes in composited over white, the same
// ground as the hash. Returns the 1408-float image
// vector. Throws on failure; the caller soft-fails to
// pHash-only matching.
async function embedImage({ imageBuffer, getAccessToken, fetchImpl, project, location }) {
  const doFetch = fetchImpl || fetch;
  const proj = project || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const loc = location || process.env.VERTEX_EMBED_LOCATION || "us-central1";
  const token = await (getAccessToken || defaultGetAccessToken)();
  const flat = await sharp(imageBuffer).flatten({ background: "#ffffff" }).jpeg().toBuffer();
  const url =
    "https://" + loc + "-aiplatform.googleapis.com/v1/projects/" + proj +
    "/locations/" + loc + "/publishers/google/models/" + EMBED_MODEL + ":predict";
  const res = await doFetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      instances: [{ image: { bytesBase64Encoded: flat.toString("base64") } }],
    }),
  });
  const j = await res.json().catch(() => null);
  const vec = j && j.predictions && j.predictions[0] && j.predictions[0].imageEmbedding;
  if (!res.ok || !Array.isArray(vec)) {
    throw new Error("embed failed: " + res.status);
  }
  return vec;
}

function parsesCollection(db, uid) {
  return db.collection("users").doc(uid).collection("parses");
}

function publicGarment(g) {
  const { predictionId, ...rest } = g;
  return rest;
}

// The photo-to-draft estimate, in minutes, for the current SAM
// backend (community build, measured ~11 min end to end
// 2026-10-28). The client shows remaining time from it; update
// it when the backend changes (fal) — and keep the client's
// toast constant in step.
const PARSE_ETA_MINUTES = 10;

// listParses: the drafts list. Parses a user can return to —
// still listing, still cutting, sitting at review unsaved, or
// failed. Saved ("done") parses are already wardrobe data, so
// only they are excluded. Failed parses ARE listed: a passive
// flow must surface failure, never swallow it — the card
// carries the retry. One card per photo: a retry re-parses
// the same upload, so the newest parse for a photo replaces
// its failed predecessor. Public fields only: no prediction
// ids, no embeddings, no boxes.
async function listParses(uid, deps) {
  const snap = await parsesCollection(deps.db, uid)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  const out = [];
  const seenPhotos = new Set();
  for (const s of snap.docs) {
    if (!s.exists) continue;
    const d = s.data();
    if (d.status !== "listing" && d.status !== "cutting" && d.status !== "review" && d.status !== "failed") continue;
    const storagePath = d.sourcePhoto && d.sourcePhoto.storagePath ? d.sourcePhoto.storagePath : null;
    if (storagePath) {
      if (seenPhotos.has(storagePath)) continue;
      seenPhotos.add(storagePath);
    }
    const garments = d.garments || [];
    out.push({
      parseId: s.id,
      status: d.status,
      createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null,
      storagePath,
      garmentCount: garments.length,
      readyCount: garments.filter((g) => g.status === "ready").length,
    });
  }
  return { parses: out, etaMinutes: PARSE_ETA_MINUTES };
}

async function startParse(uid, sourceStoragePath, deps) {
  const db = deps.db;
  const bucket = deps.bucket;
  if (!deps.apiKey) {
    throw codedError("SAM_NOT_CONFIGURED", "REPLICATE_API_TOKEN is not set");
  }
  if (
    typeof sourceStoragePath !== "string" ||
    !sourceStoragePath.startsWith("users/" + uid + "/")
  ) {
    throw codedError("NOT_YOUR_PHOTO", "parse: bad storage path");
  }
  const parseRef = parsesCollection(db, uid).doc();
  const parseId = parseRef.id;
  const file = bucket.file(sourceStoragePath);
  const [metadata] = await file.getMetadata().catch(() => [null]);
  if (!metadata) {
    throw codedError("BAD_IMAGE", "parse: photo not found");
  }
  if (Number(metadata.size || 0) > MAX_IMAGE_BYTES) {
    throw codedError("IMAGE_TOO_LARGE", "parse: photo too large");
  }
  const [buffer] = await file.download();
  const baked = await normalizeOrientation(buffer);
  const ext =
    baked.mimeType === "image/png" ? "png" : baked.mimeType === "image/webp" ? "webp" : "jpg";
  const bakedStoragePath = "users/" + uid + "/parses/" + parseId + "/source-baked." + ext;
  await bucket.file(bakedStoragePath).save(baked.buffer, {
    contentType: baked.mimeType,
  });
  const { FieldValue } = require("firebase-admin/firestore");
  await parseRef.set({
    sourcePhoto: { storagePath: sourceStoragePath },
    bakedStoragePath,
    sourceWidth: baked.width,
    sourceHeight: baked.height,
    status: "listing",
    garments: [],
    createdAt: FieldValue.serverTimestamp(),
  });
  try {
    const listed = await listGarments({
      callModel: deps.callModel,
      bakedBuffer: baked.buffer,
      mimeType: baked.mimeType,
      hooks: deps.hooks,
    });
    if (!listed.length) {
      await parseRef.update({ status: "review", garments: [] });
      return {
        parseId,
        status: "review",
        garments: [],
        sourceWidth: baked.width,
        sourceHeight: baked.height,
      };
    }
    // SAM gets the flattened RGB copy, never the stored
    // baked bytes (RGBA PNGs fail inside the model).
    const samInput = await toSamInput(baked.buffer);
    const fileUrl = await uploadInputImage({
      apiKey: deps.apiKey,
      buffer: samInput,
      filename: parseId + ".jpg",
      contentType: "image/jpeg",
      fetchImpl: deps.fetchImpl,
    });
    const garments = [];
    for (let i = 0; i < listed.length; i++) {
      const g = listed[i];
      const prompt = buildPrompt(g);
      const created = await createSegmentation({
        apiKey: deps.apiKey,
        imageUrl: fileUrl,
        prompt,
        fetchImpl: deps.fetchImpl,
      });
      garments.push({
        id: "g" + i,
        type: g.type,
        colors: g.colors,
        detail: g.detail,
        prompt,
        predictionId: created.predictionId,
        status: "cutting",
      });
    }
    await parseRef.update({ status: "cutting", garments });
    return {
      parseId,
      status: "cutting",
      garments: garments.map(publicGarment),
      sourceWidth: baked.width,
      sourceHeight: baked.height,
    };
  } catch (err) {
    await parseRef.update({ status: "failed", error: String((err && err.message) || err) }).catch(() => {});
    throw err;
  }
}

async function advanceParse(uid, parseId, deps) {
  const db = deps.db;
  const bucket = deps.bucket;
  const parseRef = parsesCollection(db, uid).doc(parseId);
  const snap = await parseRef.get();
  if (!snap.exists) {
    throw codedError("PARSE_NOT_FOUND", "parse: no such parse");
  }
  const doc = snap.data();
  if (doc.status === "review" || doc.status === "done" || doc.status === "failed") {
    return {
      parseId,
      status: doc.status,
      garments: (doc.garments || []).map(publicGarment),
      sourceWidth: doc.sourceWidth || null,
      sourceHeight: doc.sourceHeight || null,
    };
  }
  const garments = doc.garments || [];
  const cutting = garments.filter((g) => g.status === "cutting");
  if (!cutting.length) {
    return {
      parseId,
      status: doc.status,
      garments: garments.map(publicGarment),
      sourceWidth: doc.sourceWidth || null,
      sourceHeight: doc.sourceHeight || null,
    };
  }
  // Matching inputs: every photo entry carrying a render
  // hash or embedding. Absent until the slice-4 backfill
  // — then candidates are simply empty and every draft
  // reads New, which is the correct default.
  const photoEntries = [];
  try {
    const itemSnaps = await db
      .collection("users")
      .doc(uid)
      .collection("items")
      .limit(500)
      .get();
    for (const s of itemSnaps.docs) {
      if (!s.exists) continue;
      const it = s.data();
      for (const p of it.photos || []) {
        if (p.renderPhash || p.renderEmbedding) {
          photoEntries.push({
            itemId: s.id,
            itemName: it.name || "an item",
            renderPhash: p.renderPhash || null,
            renderEmbedding: p.renderEmbedding || null,
          });
        }
      }
    }
  } catch (e) {
    /* matching inputs are best-effort; cutting proceeds */
  }
  let rejections = [];
  try {
    const rejSnaps = await db
      .collection("users")
      .doc(uid)
      .collection("match_rejections")
      .get();
    rejections = rejSnaps.docs
      .filter((s) => s.exists)
      .map((s) => s.data())
      .filter((r) => r.itemId && Array.isArray(r.embedding));
  } catch (e) {
    /* same: best-effort */
  }
  let bakedBuffer = null;
  try {
    const [b] = await bucket.file(doc.bakedStoragePath).download();
    bakedBuffer = b;
  } catch (e) {
    await parseRef.update({ status: "failed", error: "baked source missing" });
    throw codedError("BAD_IMAGE", "parse: baked source missing");
  }
  for (const garment of garments) {
    if (garment.status !== "cutting") continue;
    try {
      const seg = await getSegmentation({
        apiKey: deps.apiKey,
        predictionId: garment.predictionId,
        fetchImpl: deps.fetchImpl,
      });
      if (seg.status === "starting" || seg.status === "processing") continue;
      if (seg.status !== "succeeded" || !seg.output) {
        garment.status = "failed";
        garment.error = seg.error || ("SAM " + seg.status);
        continue;
      }
      // Harvested the moment it completed — never read later.
      const inst = selectInstance(seg.output);
      if (!inst) {
        garment.status = "not-found";
        continue;
      }
      const cut = await polygonToCutout({ imageBuffer: bakedBuffer, rings: inst.rings });
      const stats = await alphaStats(cut);
      const gate = judgeMask(stats);
      if (!gate.pass) {
        garment.status = "failed";
        garment.error = "mask: " + gate.reasons.join("; ");
        continue;
      }
      const orient = await judgeOrientation({
        callModel: deps.callModel,
        cutoutBuffer: cut,
        hooks: deps.hooks,
      });
      const angle = ROTATION_TO_ANGLE[orient.rotation] ?? 0;
      const norm = await normalizeRender(cut, angle);
      const renderPath = renderPathForParse(uid, parseId, garment.id);
      await bucket.file(renderPath).save(norm.png, {
        contentType: "image/png",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      const ph = await renderHash(norm.png);
      let emb = null;
      try {
        emb = await (deps.embedFn || embedImage)({
          imageBuffer: norm.png,
          getAccessToken: deps.getAccessToken,
          fetchImpl: deps.fetchImpl,
          project: deps.project,
          location: deps.location,
        });
      } catch (e) {
        emb = null; // soft fail: pHash-only matching
      }
      garment.status = "ready";
      garment.box = inst.box;
      garment.score = inst.score;
      garment.renderStoragePath = renderPath;
      garment.renderStatus = "passed";
      garment.rotation = angle;
      garment.renderRotation = 0; // baked upright; explicit, else the clean view falls back to rotation and double-turns
      garment.renderPhash = ph;
      garment.renderEmbedding = emb;
      garment.orientationChecked = orient.checked;
      garment.matchCandidates = matchGarment(
        { renderPhash: ph, renderEmbedding: emb },
        photoEntries,
        rejections
      );
    } catch (err) {
      garment.status = "failed";
      garment.error = String((err && err.message) || err).slice(0, 300);
    }
  }
  const allTerminal = garments.every((g) =>
    ["ready", "failed", "not-found"].includes(g.status)
  );
  const status = allTerminal ? "review" : doc.status;
  await parseRef.update({ garments, status });
  return {
    parseId,
    status,
    garments: garments.map(publicGarment),
    sourceWidth: doc.sourceWidth || null,
    sourceHeight: doc.sourceHeight || null,
  };
}

// Retry one garment: re-upload the stored baked bytes
// and create a fresh SAM prediction with the same
// prompt. Only failed / not-found garments retry —
// cutting ones are already in flight, ready ones are
// done. The parse returns to "cutting" so polling
// resumes (a "review" parse with a retried garment is
// cutting again, not done).
async function retryGarment(uid, parseId, garmentId, deps) {
  const parseRef = parsesCollection(deps.db, uid).doc(parseId);
  const snap = await parseRef.get();
  if (!snap.exists) {
    throw codedError("PARSE_NOT_FOUND", "parse: no such parse");
  }
  const doc = snap.data();
  const garments = doc.garments || [];
  const garment = garments.find((g) => g.id === garmentId);
  if (!garment) {
    throw codedError("BAD_REQUEST", "parse: no such garment");
  }
  if (garment.status !== "failed" && garment.status !== "not-found") {
    throw codedError("BAD_REQUEST", "parse: garment is not retryable");
  }
  if (!deps.apiKey) {
    throw codedError("SAM_NOT_CONFIGURED", "REPLICATE_API_TOKEN is not set");
  }
  const [bakedBuffer] = await deps.bucket.file(doc.bakedStoragePath).download();
  const samInput = await toSamInput(bakedBuffer);
  const fileUrl = await uploadInputImage({
    apiKey: deps.apiKey,
    buffer: samInput,
    filename: parseId + "-" + garmentId + ".jpg",
    contentType: "image/jpeg",
    fetchImpl: deps.fetchImpl,
  });
  const created = await createSegmentation({
    apiKey: deps.apiKey,
    imageUrl: fileUrl,
    prompt: garment.prompt,
    fetchImpl: deps.fetchImpl,
  });
  garment.predictionId = created.predictionId;
  garment.status = "cutting";
  garment.error = null;
  garment.renderStoragePath = null;
  garment.renderStatus = null;
  await parseRef.update({ garments, status: "cutting" });
  return { parseId, status: "cutting", garment: publicGarment(garment) };
}

module.exports = {
  startParse,
  advanceParse,
  retryGarment,
  listParses,
  PARSE_ETA_MINUTES,
  parseListJson,
  buildPrompt,
  buildListRequest,
  renderPathForParse,
  matchGarment,
  cosine,
  embedImage,
  EMBED_MODEL,
  MAX_GARMENTS,
  MATCH_PROPOSE,
  MATCH_POSSIBLE,
  REJECT_SUPPRESS,
};
