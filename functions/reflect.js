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
const { getClient } = require("./describe");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { codedError } = require("./errors");

function cleanText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

const REFLECT_SYSTEM = `You are the wardrobe stylist reflecting on an outfit you recommended, after the user wore it.
Be honest and brief. If your confidence was miscalibrated, say what you misread — don't flatter.
Suggest a style preference ONLY if a clear, durable preference emerges from this outcome (not a one-off mood). Phrase it as a short rule, e.g. "prefers relaxed fits for dinners".
Respond with ONLY a JSON object, no markdown, no prose:
{ "reflection": "<2-3 sentences>", "suggestedPreference": "<short phrase>" | null }`;

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
  return {
    reflection: reflection,
    suggestedPreference: cleanText(obj.suggestedPreference, 140) || null,
  };
}

// ratingId: the user's rating doc id (users/{uid}/ratings/{ratingId}).
// Returns { reflection, suggestedPreference } and persists the app's
// reflection as a sibling rating (rater: "app").
async function reflectOutfit(uid, ratingId) {
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
    return { reflection: doc.note || "", suggestedPreference: doc.suggestedPreference || null };
  }

  const outfitSnap = await db.collection("users").doc(uid).collection("outfits").doc(rating.targetId).get();
  if (!outfitSnap.exists) {
    throw codedError("INTERNAL", "reflectOutfit: outfit not found");
  }
  const outfit = outfitSnap.data();
  const itemNames = Array.isArray(outfit.itemNames) ? outfit.itemNames.join(", ") : "";

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const userMessage =
    "Outfit worn: " + itemNames + ".\n" +
    "Your original confidence: " + (outfit.appConfidence == null ? "n/a" : outfit.appConfidence + "/10") + ".\n" +
    "Your original reasoning: " + (outfit.appReasoning || "n/a") + ".\n" +
    "The user rated it " + rating.score + "/10.\n" +
    "Their note: " + (rating.note || "n/a") + ".";
  let response;
  try {
    const ai = getClient();
    response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: REFLECT_SYSTEM,
        temperature: 0.5,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "reflectOutfit: generateContent failed: " + (err && err.message));
  }
  const text = (response.text || "").trim();
  if (!text) throw codedError("AI_BAD_RESPONSE", "reflectOutfit: model returned no text");
  const parsed = parseReflectionJson(text);

  await db.collection("users").doc(uid).collection("ratings").add({
    targetKind: "outfit",
    targetId: rating.targetId,
    wearEventId: rating.wearEventId || null,
    rater: "app",
    score: null, // a reflection, not a score
    note: parsed.reflection,
    suggestedPreference: parsed.suggestedPreference,
    reflectionFor: ratingId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { reflection: parsed.reflection, suggestedPreference: parsed.suggestedPreference };
}

module.exports = { reflectOutfit };
