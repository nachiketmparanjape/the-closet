// reflect.js — PC-12: post-wear reflection.
//
// After the user rates an outfit, the model reflects on the delta between
// its original confidence and the user's score, and may suggest one style
// preference. The user's rating is ALWAYS written first (client-side,
// direct to Firestore) — reflection never blocks it. A failed reflection
// just means the client retries this callable with the same ratingId;
// reflectOutfit is idempotent per rating via the `reflectionFor` field.
"use strict";

const { GoogleGenAI } = require("@google/genai");
const { getClient, logAiFailure, reportUsage, MODEL_VERSION } = require("./describe");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { codedError } = require("./errors");

function cleanText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

const REFLECT_SYSTEM = `You are the wardrobe stylist reflecting on an outfit you recommended, after the user wore it.
Be honest and brief. If your confidence was miscalibrated, say what you misread — don't flatter.

You also see the user's RECENT RATINGS. Use them to distinguish three kinds of feedback:
- EXPLICIT: the user directly states a like or dislike ("I hate tucking in shirts", "love the cropped fit"). Record these immediately.
- PATTERN: 2 or more ratings point the same way (low scores whenever outfits are all-dark; high scores for earth tones). This earns a durable preference.
- ONE-OFF: a single low score with no pattern (bad mood, wrong occasion, weather surprise). Useful for this reflection, but NOT a durable rule — never suggest a preference for a one-off.

Suggest a preference ONLY for explicit statements or repeated patterns. When you do, cite the evidence: which ratings and what they show.
Respond with ONLY a JSON object, no markdown, no prose:
{ "reflection": "<2-3 sentences on this outfit>",
  "suggestedPreference": "<short rule>" | null,
  "evidence": "<which ratings support it, e.g. '3/10 and 4/10 on the two all-black outfits (Oct 12, Oct 14)'>" | null,
  "preferenceKind": "explicit" | "pattern" | null }`;

function parseReflectionJson(text) {
  let obj = null;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { obj = JSON.parse(match[0]); } catch (e) { obj = null; }
    }
  }
  if (!obj || typeof obj !== "object") {
    throw codedError("AI_BAD_RESPONSE", "reflectOutfit: model returned non-JSON");
  }
  const reflection = cleanText(obj.reflection, 600);
  if (!reflection) throw codedError("AI_BAD_RESPONSE", "reflectOutfit: model returned no reflection");
  const kind = obj.preferenceKind === "explicit" || obj.preferenceKind === "pattern"
    ? obj.preferenceKind : null;
  const suggestedPreference = cleanText(obj.suggestedPreference, 140) || null;
  return {
    reflection: reflection,
    // A preference without a kind is a malformed suggestion — drop it.
    suggestedPreference: kind && suggestedPreference ? suggestedPreference : null,
    evidence: kind && suggestedPreference ? cleanText(obj.evidence, 300) : null,
    preferenceKind: kind && suggestedPreference ? kind : null,
  };
}

// ratingId: the user's rating doc id (users/{uid}/ratings/{ratingId}).
// Returns { reflection, suggestedPreference } and persists the app's
// reflection as a sibling rating (rater: "app").
async function reflectOutfit(uid, ratingId, hooks) {
  const db = getFirestore();
  const ratingRef = db.collection("users").doc(uid).collection("ratings").doc(ratingId);
  const ratingSnap = await ratingRef.get();
  if (!ratingSnap.exists) {
    throw codedError("INTERNAL", "reflectOutfit: rating not found");
  }
  const rating = ratingSnap.data();
  if (rating.rater !== "user" || rating.targetKind !== "outfit") {
    throw codedError("INTERNAL", "reflectOutfit: rating is not a user outfit rating");
  }

  // Idempotent retry: an existing reflection for this rating is returned
  // instead of calling the model again.
  const existing = await db.collection("users").doc(uid).collection("ratings")
    .where("reflectionFor", "==", ratingId).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0].data();
    return {
      reflection: doc.note || "",
      suggestedPreference: doc.suggestedPreference || null,
      evidence: doc.preferenceEvidence || null,
      preferenceKind: doc.preferenceKind || null,
    };
  }

  const outfitSnap = await db.collection("users").doc(uid).collection("outfits").doc(rating.targetId).get();
  if (!outfitSnap.exists) {
    throw codedError("INTERNAL", "reflectOutfit: outfit not found");
  }
  const outfit = outfitSnap.data();
  const itemNames = Array.isArray(outfit.itemNames) ? outfit.itemNames.join(", ") : "";

  // Sprint 5: history-aware reflection. Pull the user's recent outfit
  // ratings so the model can tell an explicit preference or a repeated
  // pattern from a one-off reaction.
  const historySnap = await db.collection("users").doc(uid).collection("ratings")
    .where("rater", "==", "user")
    .where("targetKind", "==", "outfit")
    .orderBy("createdAt", "desc")
    .limit(8)
    .get();
  const historyDocs = historySnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.id !== ratingId && typeof r.score === "number");
  const outfitSnaps = await Promise.all(
    historyDocs.map((r) => db.collection("users").doc(uid).collection("outfits").doc(r.targetId).get())
  );
  const historyLines = historyDocs.map((r, i) => {
    const o = outfitSnaps[i].exists ? outfitSnaps[i].data() : null;
    const names = o && Array.isArray(o.itemNames) ? o.itemNames.join(", ") : r.targetId;
    const predicted = o && o.appConfidence != null ? " (app predicted " + o.appConfidence + "/10)" : "";
    const note = r.note ? ' Note: "' + String(r.note).slice(0, 120) + '"' : "";
    const when = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString().slice(0, 10) : "";
    return "- " + when + ": \"" + names + "\" — user " + r.score + "/10" + predicted + "." + note;
  });

  // Sprint 5 (D3): calibration signal. The model's 0-10 is an uncalibrated
  // self-report; log predicted vs actual so it can be reweighted later.
  try {
    console.error(JSON.stringify({
      event: "reflection_calibration",
      predicted: outfit.appConfidence != null ? outfit.appConfidence : null,
      actual: rating.score,
      outfitId: rating.targetId,
    }));
  } catch (e) { /* logging must never throw */ }

  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const userMessage =
    "Outfit worn: " + itemNames + ".\n" +
    "Your original confidence: " + (outfit.appConfidence == null ? "n/a" : outfit.appConfidence + "/10") + ".\n" +
    "Your original reasoning: " + (outfit.appReasoning || "n/a") + ".\n" +
    "The user rated it " + rating.score + "/10.\n" +
    "Their note: " + (rating.note || "n/a") + "." +
    (historyLines.length
      ? "\n\nRECENT RATINGS (newest first) — distinguish explicit preferences and repeated patterns from one-offs:\n" + historyLines.join("\n")
      : "\n\nNo earlier ratings yet — treat this as a single data point, not a pattern.");
  const callStart = Date.now();
  let response;
  try {
    const ai = getClient();
    response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: REFLECT_SYSTEM,
        temperature: 0.3,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 512 },
        responseMimeType: "application/json",
      },
    });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "reflectOutfit: generateContent failed: " + (err && err.message));
  }
  reportUsage(hooks, response, model, callStart);
  const text = (response.text || "").trim();
  if (!text) {
    logAiFailure("reflectOutfit", response);
    throw codedError("AI_BAD_RESPONSE", "reflectOutfit: model returned no text");
  }
  const parsed = parseReflectionJson(text);

  await db.collection("users").doc(uid).collection("ratings").add({
    targetKind: "outfit",
    targetId: rating.targetId,
    wearEventId: rating.wearEventId || null,
    rater: "app",
    score: null, // a reflection, not a score
    note: parsed.reflection,
    suggestedPreference: parsed.suggestedPreference,
    preferenceEvidence: parsed.evidence,
    preferenceKind: parsed.preferenceKind,
    reflectionFor: ratingId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    reflection: parsed.reflection,
    suggestedPreference: parsed.suggestedPreference,
    evidence: parsed.evidence,
    preferenceKind: parsed.preferenceKind,
  };
}

module.exports = { reflectOutfit, parseReflectionJson };
