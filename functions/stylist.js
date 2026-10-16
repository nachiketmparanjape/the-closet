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
// Sprint 5: each line carries a stable handle ([i1], [i2], ...) — the model
// returns handles, never names (duplicate names can't be told apart).
function itemLine(it, idx) {
  const handle = "i" + (idx + 1);
  const name = cleanText(it.name, 80) || "Untitled item";
  const category = cleanText(it.category, 20) || "Other";
  const colors = describeColors(it.colors);
  const bits = [
    "pattern: " + (cleanText(it.pattern, 20) || "other"),
    "fit: " + (cleanText(it.fit, 20) || "unknown"),
    "fabric: " + (cleanText(it.fabric, 40) || "unknown"),
    "formality: " + (cleanText(it.formality, 20) || "casual"),
    "warmth: " + (cleanText(it.warmth, 20) || "light"),
  ];
  const desc = cleanText(it.description, 200);
  let line = "[" + handle + '] "' + name + '" [' + category + "] — colors: " +
    colors + "; " + bits.join("; ") + ".";
  if (desc) line += " " + desc;
  return line;
}

// Colors arrive as string[] (legacy) or [{name, family, primary}].
// Render the canonical family, marking the dominant color — the rubric
// reasons about dominant-vs-accent from these marks.
function describeColors(colors) {
  if (!Array.isArray(colors) || !colors.length) return "unknown";
  const parts = colors.slice(0, 3).map((c) => {
    if (typeof c === "string") return cleanText(c, 30) || null;
    if (c && typeof c === "object") {
      const n = cleanText(c.family || c.name, 30);
      return n ? n + (c.primary ? " (primary)" : "") : null;
    }
    return null;
  }).filter(Boolean);
  return parts.length ? parts.join(", ") : "unknown";
}

// Sprint 5: the versioned styling rubric. Guides the model's judgment —
// it is not a set of rigid rules. An intentional clash can be the right
// call, but the model must explain why. Bump the version when edited;
// the benchmark re-runs against every version.
const RUBRIC_VERSION = "2026-10-15-v1";
const RUBRIC = `STYLING RUBRIC ${RUBRIC_VERSION} — judge every outfit by these dimensions.
The rubric guides; it does not dictate. An intentional clash, an unexpected
accent, or a deliberate imbalance can be the right call — but you must explain
why it works instead of reciting that the colors are "harmonious".

COLOR (0-10):
- Palette relationship: are the colors tonal (same family), analogous
  (neighbors), complementary (opposites), neutral-based (anchored by
  black/white/grey/navy/cream), or intentionally contrasting? Name it.
- Lightness: is there balance between light and dark pieces, or is the
  outfit unintentionally flat (all mid-tones)?
- Saturation: do vivid and muted colors work together on purpose, or does
  one piece scream while the rest whisper?
- Temperature: do warm and cool colors complement each other, or fight?
- Dominant vs accent: is there a clear primary color with supporting colors
  (the "(primary)" marks help), or are pieces competing for attention?
- Pattern interaction: at most one bold pattern per outfit unless you can
  justify the pairing. Stripes + plaid with no common color is a clash.

FORMALITY (0-10): every piece at the same formality level as the occasion?
One casual piece in a business-casual outfit caps this at 5.

WEATHER (0-10): every piece's warmth suits the stated weather? A heavy layer
on a hot day, or shorts in the cold, fails outright.

PROPORTION (0-10): do the silhouettes work together? Two oversized pieces
with no intent is a fail.

OCCASION (0-10): is this what someone would actually wear there? When in
doubt, slightly overdressed beats underdressed.

Score meanings: 10 = wear it as is; 7 = good; 5 = works with a flaw;
3 or less = clear clash or mismatch.`;

const SYSTEM = `You are a personal wardrobe stylist helping the user pick an outfit from the clothes they actually own, listed below.

RULES — follow them strictly:
- Recommend ONLY items from the list, referenced by their HANDLE ([i1], [i2], ...). Never invent, assume, or name an item that is not listed — not even "a plain white tee" unless it appears below.
- Suggest one complete outfit per reply: exactly one top and exactly one bottom. Add shoes, outerwear, or accessories only where the wardrobe has them AND the occasion calls for them — never force shoes into an answer that didn't ask for them.
- Use the STYLING RUBRIC to judge the outfit. Write your reasoning FIRST (two sentences: what anchors the look, what ties the colors together), then score it.
- Keep the conversational reply brief: the outfit first, then why it works.
- The user's message carries the occasion, weather, and any preferences — use all three.
- If the wardrobe honestly cannot cover the occasion (e.g. no formal wear for a wedding), say so plainly and offer the closest workable option instead of faking it.
- Colors marked (primary) are each garment's dominant color; reason about harmony from the color names.

${RUBRIC}

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown, no prose:
{
  "reply": "<your conversational reply, markdown, as the user sees it>",
  "outfit": {
    "reasoning": "<two sentences: what anchors the look, what ties the colors>",
    "items": ["<handle>", ...],
    "scores": {"color": 0, "formality": 0, "weather": 0, "proportion": 0, "occasion": 0}
  }
}
Set "outfit" to null when you did NOT recommend a specific combination
(e.g. the wardrobe can't cover the occasion, or the user only asked a
question). The "items" handles must be copied EXACTLY from the wardrobe
list ([i1], [i2], ...).`;

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).map((it) => {
    if (!it || typeof it !== "object") return null;
    // Colors: string[] (legacy) or [{name, family, primary}] (rich).
    const colors = Array.isArray(it.colors) ? it.colors.slice(0, 3).map((c) => {
      if (typeof c === "string") return cleanText(c, 30);
      if (c && typeof c === "object") {
        return {
          name: cleanText(c.name, 30),
          family: cleanText(c.family, 30),
          primary: !!c.primary,
        };
      }
      return null;
    }).filter(Boolean) : [];
    return {
      id: cleanText(it.id, 100),
      name: cleanText(it.name, 80),
      category: cleanText(it.category, 20),
      colors: colors,
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

// Map the model's outfit (HANDLES like "i1") back to real item IDs.
// Handles are prompt-local and unambiguous — duplicate names can't collide.
// Drops invalid handles and dedupes; fewer than two validated IDs means
// no structured outfit.
function mapHandlesToIds(outfit, items) {
  if (!outfit || !Array.isArray(outfit.items)) return null;
  const mapped = [];
  const seen = new Set();
  for (const h of outfit.items) {
    const m = /^i(\d+)$/.exec(String(h || "").trim().toLowerCase());
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    if (idx < 0 || idx >= items.length || seen.has(idx)) continue;
    const it = items[idx];
    if (!it || !it.id) continue;
    seen.add(idx);
    mapped.push({ id: it.id, name: it.name || "Untitled item" });
  }
  if (mapped.length < 2) return null;
  return mapped;
}

// Slot validation: the server enforces what the prompt promises.
// Returns null when valid, else a short problem description for the
// one repair call. Shoes are allowed but never required.
function validateSlots(mapped, items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const cats = mapped.map((m) => (byId.get(m.id) || {}).category || "Other");
  const hasTop = cats.indexOf("Tops") !== -1;
  const hasBottom = cats.indexOf("Bottoms") !== -1;
  if (!hasTop) return "the outfit has no top — include exactly one top";
  if (!hasBottom) return "the outfit has no bottom — include exactly one bottom";
  const counts = {};
  for (const c of cats) counts[c] = (counts[c] || 0) + 1;
  for (const c of Object.keys(counts)) {
    if (counts[c] > 1 && c !== "Accessories") {
      return "the outfit has two " + c.toLowerCase() + " — keep at most one per slot";
    }
  }
  return null;
}

const SCORE_KEYS = ["color", "formality", "weather", "proportion", "occasion"];

// Sub-scores 0-10. All five required — a partial scorecard is a malformed
// response, not a low score.
function parseScores(o) {
  if (!o || typeof o !== "object") return null;
  const out = {};
  for (const k of SCORE_KEYS) {
    const v = Number(o[k]);
    if (!Number.isFinite(v)) return null;
    out[k] = Math.max(0, Math.min(10, Math.round(v)));
  }
  return out;
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
  const raw = obj.outfit && typeof obj.outfit === "object" ? obj.outfit : null;
  let outfit = null;
  if (raw) {
    const scores = parseScores(raw.scores);
    if (!scores) throw codedError("AI_BAD_RESPONSE", "askStylist: outfit missing valid scores");
    outfit = {
      items: Array.isArray(raw.items) ? raw.items : [],
      reasoning: cleanText(raw.reasoning, 300),
      scores: scores,
    };
  }
  return { reply: reply, outfit: outfit };
}

// items: sanitized array. messages: sanitized [{role, text}].
// styleProfile: sanitized preference strings (may be empty).
// Build the exact model request askStylist sends. Exported so the
// benchmark runner (tests/benchmark) exercises the real prompt —
// prompt changes and benchmark stay in sync by construction.
function buildStylistRequest(items, messages, styleProfile) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const wardrobe = items.map((it, i) => itemLine(it, i)).join("\n");
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

async function callStylistModel(ai, model, contents, config, label) {
  let response;
  try {
    response = await ai.models.generateContent({ model, contents, config });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", label + ": generateContent failed: " + (err && err.message));
  }
  const text = (response.text || "").trim();
  if (!text) {
    logAiFailure(label, response);
    throw codedError("AI_BAD_RESPONSE", label + ": model returned no text");
  }
  return parseStylistJson(text);
}

// Confidence is computed IN CODE from the sub-score mean — never taken
// from the model directly. Reweightable against user ratings later
// without touching the prompt.
function confidenceFromScores(scores) {
  const vals = SCORE_KEYS.map((k) => scores[k]);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// items: sanitized array. messages: sanitized [{role, text}].
// styleProfile: sanitized preference strings (may be empty).
// Returns { reply, outfit: { itemIds, confidence, reasoning, scores } | null }.
async function askStylist(items, messages, styleProfile) {
  const { model, contents, config } = buildStylistRequest(items, messages, styleProfile);
  const ai = getClient();
  let parsed = await callStylistModel(ai, model, contents, config, "askStylist");

  // Slot validation with ONE repair attempt. The repair shows the model
  // its own answer plus what's wrong with it.
  let mapped = parsed.outfit ? mapHandlesToIds(parsed.outfit, items) : null;
  let problem = parsed.outfit ? validateSlots(mapped || [], items) : null;
  if (parsed.outfit && (problem || !mapped)) {
    const repairContents = contents.concat([
      { role: "model", parts: [{ text: JSON.stringify(parsed.outfit) }] },
      { role: "user", parts: [{ text: "That outfit doesn't work: " + (problem || "the handles didn't match the wardrobe") + ". Choose again using only wardrobe handles, following all rules." }] },
    ]);
    try {
      parsed = await callStylistModel(ai, model, repairContents, config, "askStylist-repair");
      mapped = parsed.outfit ? mapHandlesToIds(parsed.outfit, items) : null;
      problem = parsed.outfit ? validateSlots(mapped || [], items) : null;
    } catch (e) {
      // Repair failed — fall through to text-only below.
      problem = problem || "repair failed";
    }
  }

  if (!parsed.outfit || !mapped || problem) {
    return { reply: parsed.reply, outfit: null };
  }
  return {
    reply: parsed.reply,
    outfit: {
      itemIds: mapped.map((m) => m.id),
      itemNames: mapped.map((m) => m.name),
      confidence: confidenceFromScores(parsed.outfit.scores),
      reasoning: parsed.outfit.reasoning,
      scores: parsed.outfit.scores,
    },
  };
}

module.exports = { askStylist, buildStylistRequest, parseStylistJson, sanitizeItems, sanitizeMessages, sanitizeStyleProfile, mapHandlesToIds, validateSlots, parseScores, confidenceFromScores, describeColors, itemLine, RUBRIC_VERSION, SYSTEM };
