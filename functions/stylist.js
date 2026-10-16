"use strict";

// stylist.js — the conversational outfit recommender behind PC-10.
//
// Text-only reasoning over the cached wardrobe descriptions. The client
// sends its own item list (it already holds the whole catalogue in memory);
// this function never sees photos. Auth is mandatory; the model key lives
// server-side via Vertex AI, same trust boundary as describe.js (PC-6).
//
// The anti-hallucination design: every reply is grounded on the exact item
// list in the prompt, and the system instruction forbids naming anything
// not listed. At a few hundred items the whole catalogue fits in context.
//
// PC-12: the model now returns structured JSON — the conversational reply
// PLUS a machine-readable outfit (item names, confidence, reasoning). The
// server maps names back to item IDs (dropping misses); fewer than two
// validated IDs means no structured outfit (text-only reply).

const { GoogleGenAI } = require("@google/genai");
const { getClient, logAiFailure, MODEL_VERSION } = require("./describe");
const { codedError } = require("./errors");

const MAX_ITEMS = 500;
const MAX_MESSAGES = 20;
const MAX_TEXT = 2000;
const MAX_PREFERENCES = 50;

function cleanText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function cleanList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const v of value) {
    if (out.length >= maxItems) break;
    const s = cleanText(v, maxLen).toLowerCase();
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

// One compact grounding line per item. Names are the recommender's
// vocabulary (research: LLMs reason about color harmony from words).
function itemLine(it) {
  const name = cleanText(it.name, 80) || "Untitled item";
  const category = cleanText(it.category, 20) || "Other";
  const colors = cleanList(it.colors, 3, 30);
  const bits = [
    "pattern: " + (cleanText(it.pattern, 20) || "other"),
    "fit: " + (cleanText(it.fit, 20) || "unknown"),
    "fabric: " + (cleanText(it.fabric, 40) || "unknown"),
    "formality: " + (cleanText(it.formality, 20) || "casual"),
    "warmth: " + (cleanText(it.warmth, 20) || "light"),
  ];
  const desc = cleanText(it.description, 200);
  let line = '- "' + name + '" [' + category + "] — colors: " +
    (colors.length ? colors.join(", ") : "unknown") + "; " + bits.join("; ") + ".";
  if (desc) line += " " + desc;
  return line;
}

const SYSTEM = `You are a personal wardrobe stylist helping the user pick an outfit from the clothes they actually own, listed below.

RULES — follow them strictly:
- Recommend ONLY items from the list. Never invent, assume, or name an item that is not listed — not even "a plain white tee" unless it appears below.
- Refer to each recommended piece by its exact listed name in quotes.
- Suggest one complete outfit per reply: a top and a bottom, plus shoes, outerwear, or accessories where the wardrobe has them and the occasion calls for them.
- Keep it conversational and brief: the outfit first, then one or two sentences on why it works (color harmony, formality match, weather).
- The user's message carries the occasion, weather, and any preferences — use all three.
- If the wardrobe honestly cannot cover the occasion (e.g. no formal wear for a wedding), say so plainly and offer the closest workable option instead of faking it.
- The colors listed are the garment's own colors as catalogued; reason about harmony from the color names.

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown, no prose:
{
  "reply": "<your conversational reply, markdown, as the user sees it>",
  "outfit": {
    "items": ["<exact listed item name>", ...],
    "confidence": <0-10 integer: how confident you are this outfit works>,
    "reasoning": "<one or two sentences on why it works>"
  }
}
Set "outfit" to null when you did NOT recommend a specific combination
(e.g. the wardrobe can't cover the occasion, or the user only asked a
question). The "items" names must be copied EXACTLY from the wardrobe
list, letter for letter.`;

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).map((it) => {
    if (!it || typeof it !== "object") return null;
    return {
      id: cleanText(it.id, 100), // PC-12: lets the server map outfit names back to IDs
      name: cleanText(it.name, 80),
      category: cleanText(it.category, 20),
      colors: cleanList(it.colors, 3, 30),
      pattern: cleanText(it.pattern, 20),
      fit: cleanText(it.fit, 20),
      fabric: cleanText(it.fabric, 40),
      formality: cleanText(it.formality, 20),
      warmth: cleanText(it.warmth, 20),
      description: cleanText(it.description, 200),
    };
  }).filter(Boolean);
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "model" ? "model" : "user";
    const text = cleanText(m.text, MAX_TEXT);
    if (!text) continue;
    out.push({ role, text });
  }
  return out;
}

// User-confirmed style preferences (PC-12). Plain strings, capped.
function sanitizeStyleProfile(prefs) {
  if (!Array.isArray(prefs)) return [];
  return prefs
    .map((p) => cleanText(p, 140))
    .filter(Boolean)
    .slice(0, MAX_PREFERENCES);
}

// Map the model's outfit (item NAMES) back to real item IDs. Drops misses;
// fewer than two validated IDs means no structured outfit.
function mapOutfitToIds(outfit, items) {
  if (!outfit || !Array.isArray(outfit.items)) return null;
  const byName = new Map();
  for (const it of items) {
    const key = (it.name || "").trim().toLowerCase();
    if (key && it.id && !byName.has(key)) byName.set(key, it.id);
  }
  const itemIds = [];
  for (const n of outfit.items) {
    const id = byName.get(String(n || "").trim().toLowerCase());
    if (id && itemIds.indexOf(id) === -1) itemIds.push(id);
  }
  if (itemIds.length < 2) return null;
  const confidence = Math.max(0, Math.min(10, Math.round(Number(outfit.confidence))));
  return {
    itemIds: itemIds,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reasoning: cleanText(outfit.reasoning, 300),
  };
}

function parseStylistJson(text) {
  let obj = null;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { obj = JSON.parse(match[0]); } catch (e) { obj = null; }
    }
  }
  if (!obj || typeof obj !== "object") {
    throw codedError("AI_BAD_RESPONSE", "askStylist: model returned non-JSON");
  }
  const reply = cleanText(obj.reply, 2000);
  if (!reply) throw codedError("AI_BAD_RESPONSE", "askStylist: model returned no reply");
  return { reply: reply, outfit: obj.outfit && typeof obj.outfit === "object" ? obj.outfit : null };
}

// items: sanitized array. messages: sanitized [{role, text}].
// styleProfile: sanitized preference strings (may be empty).
// Returns { reply, outfit: { itemIds, confidence, reasoning } | null }.
// Build the exact model request askStylist sends. Exported so the
// benchmark runner (tests/benchmark) exercises the real prompt —
// prompt changes and benchmark stay in sync by construction.
function buildStylistRequest(items, messages, styleProfile) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const wardrobe = items.map(itemLine).join("\n");
  let system = SYSTEM;
  const prefs = Array.isArray(styleProfile) ? styleProfile.filter(Boolean) : [];
  if (prefs.length) {
    system += "\n\nSTYLE PROFILE — the user's confirmed preferences. Honor them when recommending:\n" +
      prefs.map((p) => "- " + p).join("\n");
  }
  const contents = [
    { role: "user", parts: [{ text: "WARDROBE (pick only from these items):\n" + wardrobe }] },
  ];
  for (const m of messages) {
    contents.push({ role: m.role, parts: [{ text: m.text }] });
  }
  const config = {
    systemInstruction: system,
    temperature: 0.3,
    maxOutputTokens: 2500,
    thinkingConfig: { thinkingBudget: 1024 },
    responseMimeType: "application/json",
  };
  return { model, contents, config };
}

async function askStylist(items, messages, styleProfile) {
  const { model, contents, config } = buildStylistRequest(items, messages, styleProfile);
  const ai = getClient();
  let response;
  try {
    response = await ai.models.generateContent({ model, contents, config });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "askStylist: generateContent failed: " + (err && err.message));
  }
  const text = (response.text || "").trim();
  if (!text) {
    logAiFailure("askStylist", response);
    throw codedError("AI_BAD_RESPONSE", "askStylist: model returned no text");
  }
  const parsed = parseStylistJson(text);
  return { reply: parsed.reply, outfit: mapOutfitToIds(parsed.outfit, items) };
}

module.exports = { askStylist, buildStylistRequest, sanitizeItems, sanitizeMessages, sanitizeStyleProfile, mapOutfitToIds, itemLine, SYSTEM };
