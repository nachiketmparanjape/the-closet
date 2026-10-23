// photo.js — PC-13: outfit photo parsing.
//
// The user uploads a photo of an outfit (worn or flat-lay); the model
// identifies which wardrobe items appear in it. Matching is text-over-
// description: the photo plus the item list (names, categories, colors).
// Thumbnail-vision matching is the fallback if this proves unreliable.
//
// Trust model: the model proposes, the user confirms. Item IDs in the
// response are re-validated against the real wardrobe — a hallucinated
// id can never enter an outfit. Unknown garments are described, never
// invented as items (auto-cataloging is PC-3 territory).

const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getClient, reportUsage, MODEL_VERSION } = require("./describe");
const { codedError } = require("./errors");
const { cleanText } = require("./stylist");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function cleanConfidence(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

// Pure: build the exact model request. Exported for tests.
function buildPhotoParseRequest(imageBase64, mimeType, items) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const wardrobe = items
    .map((it, i) => {
      const colors = Array.isArray(it.colors)
        ? it.colors.map((c) => (c && c.name ? c.name : c)).filter(Boolean).join("/")
        : "";
      return (
        "[i" + (i + 1) + '] id="' + it.id + '" "' + cleanText(it.name, 60) + '" [' +
        cleanText(it.category, 20) + "]" + (colors ? " colors: " + colors : "")
      );
    })
    .join("\n");
  const prompt =
    "This photo shows an outfit. Below is the wearer's wardrobe list with ids.\n" +
    "Identify which wardrobe items appear in the photo. For each match give " +
    "the item id and your confidence 0-1. List visible garments that are NOT " +
    "in the wardrobe as short plain-text descriptions under \"unknown\" " +
    "(do not guess ids for them). If a garment is ambiguous between two " +
    "items, pick the higher-confidence one and note the ambiguity in " +
    "\"notes\".\n\n" +
    "WARDROBE:\n" + wardrobe + "\n\n" +
    'Respond with JSON only: {"matches": [{"itemId": "...", "confidence": 0.9}], "unknown": ["..."], "notes": "..."}.';
  const contents = [
    {
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
      ],
    },
  ];
  const config = {
    temperature: 0.2,
    maxOutputTokens: 1200,
    thinkingConfig: { thinkingBudget: 512 },
    responseMimeType: "application/json",
  };
  return { model, contents, config };
}

// Pure: parse + validate the model's reply against the real item ids.
// Exported for tests.
function parsePhotoParseJson(text, validIds) {
  let obj = null;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { obj = JSON.parse(match[0]); } catch (e) { obj = null; }
    }
  }
  if (!obj || typeof obj !== "object") {
    throw codedError("AI_BAD_RESPONSE", "parseOutfitPhoto: model returned non-JSON");
  }
  const valid = new Set(validIds);
  const seen = new Set();
  const matches = [];
  if (Array.isArray(obj.matches)) {
    for (const m of obj.matches) {
      const id = m && typeof m.itemId === "string" ? m.itemId : null;
      if (!id || !valid.has(id) || seen.has(id)) continue; // hallucinated or dup id: drop
      seen.add(id);
      matches.push({ itemId: id, confidence: cleanConfidence(m.confidence) });
    }
  }
  const unknown = Array.isArray(obj.unknown)
    ? obj.unknown.filter((u) => typeof u === "string").map((u) => cleanText(u, 120)).filter(Boolean).slice(0, 10)
    : [];
  return { matches, unknown, notes: cleanText(obj.notes, 300) };
}

// Handler: (uid, storagePath, db?) -> { matches, unknown, notes }.
// db injectable for tests; Storage always real (photo bytes needed).
async function parseOutfitPhoto(uid, storagePath, db, hooks) {
  if (typeof storagePath !== "string" || !storagePath.startsWith("users/" + uid + "/")) {
    throw codedError("NOT_YOUR_PHOTO", "parseOutfitPhoto: bad storage path");
  }
  db = db || getFirestore();
  const file = getStorage().bucket().file(storagePath);
  const [metadata] = await file.getMetadata().catch(() => [null]);
  if (!metadata) {
    throw codedError("BAD_IMAGE", "parseOutfitPhoto: photo not found");
  }
  if (Number(metadata.size || 0) > MAX_IMAGE_BYTES) {
    throw codedError("IMAGE_TOO_LARGE", "parseOutfitPhoto: photo too large");
  }
  const [buffer] = await file.download();

  const itemSnaps = await db.collection("users").doc(uid).collection("items").limit(500).get();
  const items = itemSnaps.docs.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }));
  if (!items.length) {
    throw codedError("EMPTY_WARDROBE", "parseOutfitPhoto: no items to match against");
  }

  const { model, contents, config } = buildPhotoParseRequest(
    buffer.toString("base64"), metadata.contentType || "image/jpeg", items
  );
  const callStart = Date.now();
  let text;
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({ model, contents, config });
    reportUsage(hooks, response, model, callStart);
    text = (response.text || "").trim();
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "parseOutfitPhoto: generateContent failed: " + (err && err.message));
  }
  if (!text) {
    throw codedError("AI_BAD_RESPONSE", "parseOutfitPhoto: model returned no text");
  }
  return parsePhotoParseJson(text, items.map((it) => it.id));
}

module.exports = { parseOutfitPhoto, buildPhotoParseRequest, parsePhotoParseJson };
