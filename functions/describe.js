"use strict";

// describe.js — the one vision call behind PC-6/PC-7.
//
// Design notes (see studio plan: sprints/sprint-02/PLAN.md, PC-6/PC-7):
// - Runs ONLY on the server. The web client never sees a model key: this
//   function authenticates to Google via the project's own service account
//   (Vertex AI), so there is no API key to leak in the first place.
// - One call on the cover photo at upload time; the result is cached as
//   text on the Firestore item by the client. Chat never re-sends photos.
// - Output is a small fixed shape. Everything is a suggestion: the user
//   confirms or edits before saving, so a mediocre guess costs one tap,
//   not bad data.

const { GoogleGenAI } = require("@google/genai");

// PC-11: describe.js throws codedError for expected downstream failures
// (mapped to client-safe messages at the callable boundary) and plain
// Errors for unexpected ones (bugs, misconfiguration).
const { codedError } = require("./errors");
// Canonical color vocabulary + brand grouping key (PC-8 follow-up).
const { PALETTE_NAMES, canonicalName, brandKey } = require("./palette");

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Other"];
const PATTERNS = ["solid", "striped", "plaid", "check", "floral", "graphic", "other"];
const FITS = ["slim", "regular", "relaxed", "oversized", "unknown"];
const FORMALITIES = ["casual", "smart-casual", "formal"];
const WARMTHS = ["light", "medium", "heavy"];
const MODEL_VERSION = "gemini-3.8-flash"; // 2.5-flash retires 2026-10-20 (Google lifecycle page)

const PROMPT = `You are cataloguing one garment from its photo for a personal wardrobe app.
Look at the photo and answer with ONLY a JSON object (no markdown, no prose) with exactly these keys:

{
  "name": "short, specific name a person would use, e.g. 'Navy striped crew-neck tee' (max 6 words)",
  "description": "one plain sentence describing the garment for outfit planning (style, cut, notable details)",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "colors": ["1 to 3 dominant colors of the GARMENT itself (ignore background) — pick ONLY from this list: ${PALETTE_NAMES.join(", ")}"],
  "pattern": one of ${JSON.stringify(PATTERNS)},
  "fit": one of ${JSON.stringify(FITS)} (use 'unknown' if the photo can't tell),
  "fabric_guess": "best guess at the fabric in 1-3 words, or 'unknown' — this is a guess, be honest",
  "formality": one of ${JSON.stringify(FORMALITIES)},
  "warmth": one of ${JSON.stringify(WARMTHS)},
  "brand": "the PARENT brand in 1-3 words — strip sub-lines and collections ('Uniqlo UT' → 'Uniqlo', 'Nike SB' → 'Nike', 'H&M Conscious' → 'H&M'), or null if none is visible — best effort, never guess"
}

If the photo shows no garment, return every field as its safest value
(category "Other", fit "unknown", fabric_guess "unknown", pattern "other",
formality "casual", warmth "light", colors [], brand null, name
"Unidentified item",
description "No garment could be identified in the photo.").`;

function oneOf(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function cleanString(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

// Parse + validate the model's reply. Never throws: a bad reply degrades to
// safe defaults, and the caller can check `identified` / the raw fields.
function parseModelJson(text) {
  let obj = null;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        obj = JSON.parse(match[0]);
      } catch (e) {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== "object") obj = {};

  // Colors: constrain to the canonical palette (exact → alias → drop).
  // Anything off-palette is the model improvising — drop it rather than
  // store a name the color-theory work can't reason about.
  const colors = [];
  if (Array.isArray(obj.colors)) {
    const seen = new Set();
    for (const c of obj.colors) {
      const canon = canonicalName(c);
      if (canon && !seen.has(canon)) { seen.add(canon); colors.push(canon); }
      if (colors.length >= 3) break;
    }
  }

  const brand = cleanString(obj.brand, 40) || null;

  return {
    name: cleanString(obj.name, 60) || "Untitled item",
    description: cleanString(obj.description, 240),
    category: oneOf(obj.category, CATEGORIES, "Other"),
    colors,
    pattern: oneOf(obj.pattern, PATTERNS, "other"),
    fit: oneOf(obj.fit, FITS, "unknown"),
    fabric_guess: cleanString(obj.fabric_guess, 40) || "unknown",
    formality: oneOf(obj.formality, FORMALITIES, "casual"),
    warmth: oneOf(obj.warmth, WARMTHS, "light"),
    brand,
    brandKey: brandKey(brand), // grouping key: "UNIQLO" and "Uniqlo" → "uniqlo"
  };
}

let client = null;
function getClient() {
  if (client) return client;
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  // 2026-10-15: 3.x Gemini models serve from the *global* Vertex endpoint
  // (aiplatform.googleapis.com), not the regional ones — regional
  // publishers/google/models/<3.x> 404s. VERTEX_LOCATION still overrides.
  const location = process.env.VERTEX_LOCATION || "global";
  client = new GoogleGenAI({ vertexai: true, project, location });
  return client;
}

// imageBuffer: Buffer of JPEG/PNG/WebP bytes. photoIds: optional array of
// client photo identifiers (which photos were analyzed — hook for the
// future multi-photo garment model). Returns the validated shape plus
// analysis metadata (v2 raw cache).
async function describeImage(imageBuffer, mimeType, photoIds) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  let response;
  try {
    const ai = getClient();
    response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: imageBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });
  } catch (err) {
    // Network, auth, quota, model errors — a downstream failure, not our bug.
    throw codedError("AI_UNAVAILABLE", "describeItem: generateContent failed: " + (err && err.message));
  }
  if (!response || !response.text || !response.text.trim()) {
    logAiFailure("describeItem", response);
    throw codedError("AI_BAD_RESPONSE", "describeItem: model returned no text");
  }
  const parsed = parseModelJson(response.text);
  parsed.modelVersion = model;
  parsed.analyzedAt = new Date().toISOString();
  parsed.photoIds = Array.isArray(photoIds)
    ? photoIds.filter((p) => typeof p === "string").map((p) => p.slice(0, 120)).slice(0, 4)
    : [];
  return parsed;
}

// Log what the model actually did when a call comes back unusable —
// finishReason and token usage distinguish "thought too long" (truncated)
// from "refused" from "empty". Never throws; logging must not break the
// error path it diagnoses.
function logAiFailure(label, response) {
  try {
    const cand = response && response.candidates && response.candidates[0];
    const usage = response && response.usageMetadata;
    console.error(JSON.stringify({
      event: "ai_bad_response",
      label,
      finishReason: cand ? cand.finishReason : null,
      promptTokens: usage ? usage.promptTokenCount : null,
      outputTokens: usage ? usage.candidatesTokenCount : null,
      thoughtTokens: usage ? usage.thoughtsTokenCount : null,
      totalTokens: usage ? usage.totalTokenCount : null,
    }));
  } catch (e) { /* logging must never throw */ }
}

module.exports = { describeImage, parseModelJson, getClient, logAiFailure, MODEL_VERSION, PROMPT, CATEGORIES };
