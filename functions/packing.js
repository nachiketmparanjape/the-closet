"use strict";

// packing.js — Sprint 15 (PC-29 Phase 1): one-call trip packing.
//
// The client sends the trip leg (destination + dates + resolved geocode),
// a weather summary string (or null when the forecast is out of range),
// and free-text notes. The model returns ranked articles with one-line
// reasons plus 2–3 outfits assembled ONLY from packed articles.
// Reuses the stylist's handle machinery (itemLine/mapHandlesToIds) so the
// model reasons over the same grounded vocabulary.

const { getClient, logAiFailure, reportUsage, MODEL_VERSION } = require("./describe");
const { codedError } = require("./errors");
const { itemLine, mapHandlesToIds, cleanText, sanitizeItems, sanitizeVibeProfile } = require("./stylist");

const PACKING_VERSION = "packing-v1";

// --- sanitizers -----------------------------------------------------------

function sanitizeLeg(leg) {
  if (!leg || typeof leg !== "object") return null;
  const location = cleanText(leg.location, 120);
  const resolvedName = cleanText(leg.resolvedName, 120) || location;
  const lat = Number(leg.lat);
  const lng = Number(leg.lng);
  if (!location || !isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const startDate = cleanText(leg.startDate, 10); // YYYY-MM-DD
  const endDate = cleanText(leg.endDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "")) return null;
  if (endDate < startDate) return null;
  return { location, resolvedName, lat, lng, startDate, endDate };
}

function sanitizeTripInput(data) {
  const d = data || {};
  return {
    leg: sanitizeLeg(d.leg),
    weatherSummary: cleanText(d.weatherSummary, 300) || null,
    notes: cleanText(d.notes, 500) || "",
  };
}

// --- prompt ----------------------------------------------------------------

const SYSTEM = `You are a packing assistant helping the user pack for a trip from the clothes they actually own, listed below.

RULES — follow them strictly:
- Recommend ONLY items from the list, referenced by their HANDLE ([i1], [i2], ...). Never invent, assume, or name an item that is not listed.
- Rank the articles by packing priority: most essential first. Think in outfits, not items — every packed piece should work in at least one outfit with other packed pieces. No orphans.
- Pack light but complete: cover the weather range and the trip notes (occasions mentioned), with one spare top. Do not pack the whole wardrobe.
- Then suggest 2–3 complete outfits assembled ONLY from packed articles: exactly one top and exactly one bottom each; add outerwear only where the weather calls for it.
- One-line reason per article ("covers the cold nights", "dresses up for dinners"). Keep the conversational reply brief.
- If the weather summary says the forecast is unavailable, pack from typical weather for the destination and month — say so honestly in the reply.

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown, no prose:
{
  "reply": "<your conversational reply, markdown, as the user sees it>",
  "articles": [{"handle": "<handle>", "reason": "<one line>"}],
  "outfits": [{"items": ["<handle>", ...], "reasoning": "<one sentence>"}]
}`;

function buildPackingRequest(items, leg, weatherSummary, notes, vibeProfile) {
  const wardrobe = items.map((it, idx) => itemLine(it, idx)).join("\n");
  let system = SYSTEM;
  if (vibeProfile && vibeProfile.confidence >= 0.3) {
    const top = Object.keys(vibeProfile.tags || {})
      .map((t) => ({ tag: t, score: vibeProfile.tags[t] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((e) => e.tag)
      .join(", ");
    if (top) {
      system += `\n\nWEARER VIBE PROFILE — learned from what this person wears: ${top}. A bias, never a filter.`;
    }
  }
  const days = Math.round(
    (new Date(leg.endDate) - new Date(leg.startDate)) / 86400000
  ) + 1;
  const contents = [
    {
      role: "user",
      parts: [
        {
          text:
            `TRIP: ${leg.resolvedName} (${leg.startDate} → ${leg.endDate}, ${days} days)\n` +
            `WEATHER: ${weatherSummary || "forecast unavailable — use typical weather for this destination and month"}\n` +
            `NOTES: ${notes || "(none)"}\n\n` +
            `WARDROBE (pack only from these items):\n${wardrobe}`,
        },
      ],
    },
  ];
  const config = {
    systemInstruction: system,
    temperature: 0.3,
    maxOutputTokens: 2500,
    thinkingConfig: { thinkingBudget: 1024 },
    responseMimeType: "application/json",
  };
  return { model: MODEL_VERSION, contents, config };
}

// --- parsing / validation ---------------------------------------------------

function parsePackingJson(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw codedError("AI_BAD_RESPONSE", "planPacking: model did not return JSON");
  }
  return obj;
}

// items: sanitized wardrobe array (for handle mapping).
// Returns { reply, articles: [{id, reason}], outfits: [{itemIds, reasoning}] }.
function planPackingResult(parsed, items) {
  const byIdx = new Map(items.map((it, i) => ["i" + (i + 1), it]));
  const articles = [];
  const seen = new Set();
  const rawArticles = Array.isArray(parsed.articles) ? parsed.articles : [];
  for (const a of rawArticles.slice(0, 40)) {
    const m = /^\[?i(\d+)\]?$/.exec(String((a && a.handle) || "").trim().toLowerCase());
    if (!m) continue;
    const key = "i" + m[1];
    const it = byIdx.get(key);
    if (!it || !it.id || seen.has(key)) continue;
    seen.add(key);
    articles.push({ id: it.id, reason: cleanText(a.reason, 120) || "" });
  }
  const packedIds = new Set(articles.map((a) => a.id));
  const outfits = [];
  const rawOutfits = Array.isArray(parsed.outfits) ? parsed.outfits : [];
  for (const o of rawOutfits.slice(0, 5)) {
    const mapped = mapHandlesToIds(o, items);
    if (!mapped || mapped.length < 2) continue;
    // Outfits must come from packed articles (drop stragglers, keep the rest).
    const ids = mapped.map((x) => x.id).filter((id) => packedIds.has(id));
    if (ids.length < 2) continue;
    outfits.push({ itemIds: ids, reasoning: cleanText(o.reasoning, 200) || "" });
  }
  return {
    reply: cleanText(parsed.reply, 1000) || "",
    articles,
    outfits,
  };
}

async function planPacking(items, leg, weatherSummary, notes, vibeProfile, hooks) {
  const { model, contents, config } = buildPackingRequest(items, leg, weatherSummary, notes, vibeProfile);
  const ai = getClient();
  const callStart = Date.now();
  let response;
  try {
    response = await ai.models.generateContent({ model, contents, config });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "planPacking: generateContent failed: " + (err && err.message));
  }
  reportUsage(hooks, response, model, callStart);
  const text = (response.text || "").trim();
  if (!text) {
    logAiFailure("planPacking", response);
    throw codedError("AI_BAD_RESPONSE", "planPacking: model returned no text");
  }
  const parsed = parsePackingJson(text);
  const result = planPackingResult(parsed, items);
  if (!result.articles.length) {
    throw codedError("AI_BAD_RESPONSE", "planPacking: model packed nothing");
  }
  return result;
}

module.exports = {
  planPacking,
  buildPackingRequest,
  parsePackingJson,
  planPackingResult,
  sanitizeLeg,
  sanitizeTripInput,
  PACKING_VERSION,
};
