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

const { GoogleGenAI } = require("@google/genai");
const { getClient } = require("./describe");

const MAX_ITEMS = 500;
const MAX_MESSAGES = 20;
const MAX_TEXT = 2000;

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
- The colors listed are the garment's own colors as catalogued; reason about harmony from the color names.`;

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).map((it) => {
    if (!it || typeof it !== "object") return null;
    return {
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

// items: sanitized array. messages: sanitized [{role, text}]. Returns {reply}.
async function askStylist(items, messages) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ai = getClient();
  const wardrobe = items.map(itemLine).join("\n");
  const contents = [
    { role: "user", parts: [{ text: "WARDROBE (pick only from these items):\n" + wardrobe }] },
  ];
  for (const m of messages) {
    contents.push({ role: m.role, parts: [{ text: m.text }] });
  }
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  });
  const reply = (response.text || "").trim();
  if (!reply) throw new Error("empty model reply");
  return { reply };
}

module.exports = { askStylist, sanitizeItems, sanitizeMessages, itemLine, SYSTEM };
