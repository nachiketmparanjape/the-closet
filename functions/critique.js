// critique.js — PC-27: "Score my outfit" AI critique.
//
// A separate prompt path from the pick rubric (stylist.js), by design:
// the pick rubric is optimized to CHOOSE and rationalizes its own
// selection (scores run hot); a critique needs the opposite stance —
// adversarial honesty toward a fixed outfit. One prompt cannot do both.
//
// Honest-but-kind tone per founder 2026-10-17 (never brutal). Scoped to
// manual/photo outfits only: critiquing a stylist pick would be the model
// second-guessing its own scores — noise, not signal.
//
// The critique is persisted as an app-rater rating with
// ratingKind: "critique", reusing the ratings machinery. Provenance is
// explicit: it never enters the reflection path ("reflection") and never
// pollutes pick calibration (predicted confidence vs USER scores only).

const { getFirestore } = require("firebase-admin/firestore");
const { getClient, reportUsage, MODEL_VERSION } = require("./describe");
const { codedError } = require("./errors");
const { parseScores, confidenceFromScores, itemLine } = require("./stylist");

const SCORE_KEYS = ["color", "formality", "weather", "proportion", "occasion"];

function cleanText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

// Pure: build the exact model request. Exported for tests.
function buildCritiqueRequest(outfit, items, styleProfile) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const lines = items.map((it, i) => itemLine(it, i));
  const prefs = Array.isArray(styleProfile) && styleProfile.length
    ? "The wearer's stated preferences: " + styleProfile.join("; ") + "."
    : "No stated style preferences on file.";
  const system =
    "You are an honest, kind wardrobe critic. You did NOT pick this outfit — " +
    "a person assembled it themselves. Your job is a candid second opinion, " +
    "not flattery and not cruelty. Score each dimension 0-10, then write 2-3 " +
    "sentences of critique: name the weakest link specifically and suggest " +
    "one concrete fix if you see one. Be direct about what doesn't work; " +
    "stay warm about the person. Respond with JSON only: " +
    '{"scores": {"color": n, "formality": n, "weather": n, "proportion": n, "occasion": n}, "critique": "..."}.';
  const contents = [
    {
      role: "user",
      parts: [{
        text:
          "Outfit to critique:\n" + lines.join("\n") + "\n\n" +
          (outfit.occasion ? "Occasion: " + outfit.occasion + ".\n" : "") +
          (outfit.weather ? "Weather: " + outfit.weather + ".\n" : "") +
          prefs + "\n\n" +
          "Critique this outfit.",
      }],
    },
  ];
  const config = {
    systemInstruction: system,
    temperature: 0.4,
    maxOutputTokens: 1200,
    thinkingConfig: { thinkingBudget: 512 },
    responseMimeType: "application/json",
  };
  return { model, contents, config };
}

// Pure: parse the model's JSON reply. Exported for tests.
function parseCritiqueJson(text) {
  let obj = null;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { obj = JSON.parse(match[0]); } catch (e) { obj = null; }
    }
  }
  if (!obj || typeof obj !== "object") {
    throw codedError("AI_BAD_RESPONSE", "critiqueOutfit: model returned non-JSON");
  }
  const scores = parseScores(obj.scores);
  if (!scores) {
    throw codedError("AI_BAD_RESPONSE", "critiqueOutfit: missing valid scores");
  }
  const critique = cleanText(obj.critique, 600);
  if (!critique) {
    throw codedError("AI_BAD_RESPONSE", "critiqueOutfit: missing critique text");
  }
  return { scores, critique };
}

// Handler: (uid, outfitId, db?) -> { scores, critique, ratingId }.
// Writes the critique as an app-rater rating (ratingKind "critique").
// Idempotent: an existing critique for the outfit is returned as-is.
// db is injectable for tests; defaults to the real Firestore.
async function critiqueOutfit(uid, outfitId, db, hooks) {
  db = db || getFirestore();
  const outfitSnap = await db.collection("users").doc(uid).collection("outfits").doc(outfitId).get();
  if (!outfitSnap.exists) {
    throw codedError("INTERNAL", "critiqueOutfit: outfit not found");
  }
  const outfit = outfitSnap.data();
  if (outfit.source === "stylist") {
    throw codedError("BAD_REQUEST", "critiqueOutfit: stylist picks already carry scores");
  }

  const existing = await db.collection("users").doc(uid).collection("ratings")
    .where("rater", "==", "app")
    .where("ratingKind", "==", "critique")
    .where("targetId", "==", outfitId)
    .limit(1).get();
  if (!existing.empty) {
    const d = existing.docs[0].data();
    return { scores: d.scores || null, critique: d.note || "", ratingId: existing.docs[0].id, cached: true };
  }

  const itemIds = Array.isArray(outfit.itemIds) ? outfit.itemIds : [];
  const itemSnaps = await Promise.all(
    itemIds.map((id) => db.collection("users").doc(uid).collection("items").doc(id).get())
  );
  const items = itemSnaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }));
  if (!items.length) {
    throw codedError("INTERNAL", "critiqueOutfit: outfit has no resolvable items");
  }

  let prefs = [];
  try {
    const sp = await db.collection("users").doc(uid).collection("style_profile").doc(uid).get();
    if (sp.exists && Array.isArray(sp.data().preferences)) {
      prefs = sp.data().preferences.map((p) => p && p.text).filter(Boolean);
    }
  } catch (e) { prefs = []; }

  const { model, contents, config } = buildCritiqueRequest(outfit, items, prefs);
  const ai = getClient();
  const callStart = Date.now();
  let text;
  try {
    const response = await ai.models.generateContent({ model, contents, config });
    reportUsage(hooks, response, model, callStart);
    text = (response.text || "").trim();
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "critiqueOutfit: generateContent failed: " + (err && err.message));
  }
  if (!text) {
    throw codedError("AI_BAD_RESPONSE", "critiqueOutfit: model returned no text");
  }
  const { scores, critique } = parseCritiqueJson(text);

  const ref = db.collection("users").doc(uid).collection("ratings").doc();
  await ref.set({
    targetKind: "outfit",
    targetId: outfitId,
    wearEventId: null,
    rater: "app",
    ratingKind: "critique",
    scores: scores,
    score: confidenceFromScores(scores),
    note: critique,
    createdAt: new Date(),
  });
  return { scores, critique, ratingId: ref.id, cached: false };
}

module.exports = { critiqueOutfit, buildCritiqueRequest, parseCritiqueJson };
