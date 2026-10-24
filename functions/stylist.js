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
const { getClient, logAiFailure, reportUsage, MODEL_VERSION } = require("./describe");
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
  const subtype = cleanText(it.subtype, 40);
  if (subtype) bits.push("subtype: " + subtype);
  const styleTags = Array.isArray(it.styleTags) ? it.styleTags.filter(Boolean) : [];
  if (styleTags.length) bits.push("style: " + styleTags.join("/"));
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
- Name the outfit like a magazine feature: a 2–4 word editorial title ("Lobby Handshake", "Harbour Luxe") plus a tagline of at most 7 words capturing its feel ("Soft center, sharp frame"). Evocative and specific to THIS outfit — never generic ("Nice Outfit"), never a list of the items.
- Add a style note: ONE sentence on the look's character — who it reads as, what it signals ("Reads polished without trying — boardroom bones, weekend ease.").
- Keep the conversational reply brief: the outfit first, then why it works.
- The user's message carries the occasion, weather, and any preferences — use all three.
- If the wardrobe honestly cannot cover the occasion (e.g. no formal wear for a wedding), say so plainly and offer the closest workable option instead of faking it.
- SCOPE: your whole job is outfits from the owned wardrobe below. Never ask the user what they want to BUY (no "looking for a new jacket?" follow-ups) — that question invites a topic you can't serve. If they ask about buying anyway, be straight in one sentence: you work with what they own; a Shop check is the right tool for buy decisions. No lecture, no apology paragraph.
- Colors marked (primary) are each garment's dominant color; reason about harmony from the color names.

${RUBRIC}

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown, no prose:
{
  "reply": "<your conversational reply, markdown, as the user sees it>",
  "outfit": {
    "reasoning": "<two sentences: what anchors the look, what ties the colors>",
    "lookName": "<2-4 word editorial title for this outfit>",
    "tagline": "<at most 7 words: the feel of the look>",
    "styleNote": "<one sentence: the character of this look>",
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
      subtype: cleanText(it.subtype, 40),
      styleTags: Array.isArray(it.styleTags)
        ? it.styleTags.filter((t) => typeof t === "string").map((t) => cleanText(t, 20)).filter(Boolean).slice(0, 3)
        : (Array.isArray(it.style_tags)
          ? it.style_tags.filter((t) => typeof t === "string").map((t) => cleanText(t, 20)).filter(Boolean).slice(0, 3)
          : []),
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

// WX-1: weather context measured client-side (Open-Meteo, no key). A short
// human string like "68°F, clear" — the model never sees lat/lng.
function sanitizeWeatherContext(value) {
  if (typeof value !== "string") return null;
  const s = cleanText(value, 200);
  return s ? s : null;
}

// PC-16: the client's latest pick, for in-chat iteration ("swap the
// shorts"). Just item ids — the server resolves them to wardrobe handles.
function sanitizePreviousPick(value) {
  if (!value || typeof value !== "object") return null;
  const ids = Array.isArray(value.itemIds)
    ? value.itemIds.filter((id) => typeof id === "string" && id).slice(0, 6)
    : [];
  if (!ids.length) return null;
  return { itemIds: ids };
}

// Founder bug (2026-10-24): today's home-screen pick is DISPLAYED
// at the top of the stylist chat but was never SENT — questions
// about it ("why this?", "make it warmer") arrived context-free
// and the model answered generically. The pick now rides along
// as structured context; ids are resolved to handles (and the
// unknown dropped) in buildStylistRequest, like previousPick.
function sanitizeTodayPick(value) {
  if (!value || typeof value !== "object") return null;
  const ids = Array.isArray(value.itemIds)
    ? value.itemIds.filter((id) => typeof id === "string" && id).slice(0, 6)
    : [];
  if (!ids.length) return null;
  return {
    itemIds: ids,
    lookName: cleanText(value.lookName, 80) || null,
    reasoning: cleanText(value.reasoning, 400) || null,
  };
}

// PC-22: @-mention references. The client sends { articleIds, outfits }
// where outfits carry their itemIds (resolved from its local cache); every
// id is re-validated against the real wardrobe here, so the model only
// ever sees items that exist. Malformed input → empty (never a 400).
function sanitizeReferences(value, items) {
  const out = { articles: [], outfits: [] };
  const valid = new Set((items || []).map((it) => it && it.id).filter(Boolean));
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value.articleIds)) {
    for (const id of value.articleIds.slice(0, 5)) {
      if (typeof id === "string" && id && valid.has(id) && !out.articles.includes(id)) {
        out.articles.push(id);
      }
    }
  }
  if (Array.isArray(value.outfits)) {
    for (const o of value.outfits.slice(0, 3)) {
      if (!o || typeof o !== "object") continue;
      const ids = Array.isArray(o.itemIds)
        ? o.itemIds.filter((id) => typeof id === "string" && id && valid.has(id))
        : [];
      if (ids.length >= 2) {
        out.outfits.push({
          id: typeof o.id === "string" ? o.id : "",
          name: cleanText(o.name, 60),
          itemIds: ids,
        });
      }
    }
  }
  return out;
}

// Sprint 13: the vibe vocabulary. Keep in sync with STYLE_TAGS in
// describe.js (the AI's tag vocabulary) — the client detects these in
// chat input and the profile learns them from wears/ratings.
const VIBE_TAGS = ["classic", "minimalist", "preppy", "streetwear", "vintage", "bohemian", "edgy", "romantic", "sporty", "rugged", "refined", "avant-garde"];

// Explicit vibe from the chat request ("dress me streetwear tonight").
// Client-side detection; the server only accepts exact vocabulary hits.
function sanitizeVibe(v) {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return VIBE_TAGS.indexOf(t) !== -1 ? t : null;
}

// Learned vibe profile, read server-side from users/{uid}.vibeProfile
// (best-effort like styleProfile). Shape: {tags: {tag: 0..1}, evidence:
// {tag: n}}. Returns {tags, confidence} or null when unusable.
function sanitizeVibeProfile(vp) {
  if (!vp || typeof vp !== "object") return null;
  const tags = {};
  const raw = vp.tags && typeof vp.tags === "object" ? vp.tags : {};
  for (const t of VIBE_TAGS) {
    const s = Number(raw[t]);
    if (Number.isFinite(s)) tags[t] = Math.min(1, Math.max(0, s));
  }
  if (!Object.keys(tags).length) return null;
  let evidence = 0;
  const ev = vp.evidence && typeof vp.evidence === "object" ? vp.evidence : {};
  for (const t of VIBE_TAGS) {
    const n = Number(ev[t]);
    if (Number.isFinite(n) && n > 0) evidence += n;
  }
  return { tags: tags, confidence: Math.min(1, evidence / 40) };
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
    // Accept "[i1]" (as the prompt shows them) and bare "i1".
    const m = /^\[?i(\d+)\]?$/.exec(String(h || "").trim().toLowerCase());
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

function parseStylistJson(text, todayStr) {
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
      // DESIGN-LOOK-1 (§10 A3): every pick is a named feature.
      lookName: cleanText(raw.lookName, 48),
      tagline: cleanText(raw.tagline, 80),
      // DESIGN-NOTE-1 (§10 A4): the sheet's style-note card.
      styleNote: cleanText(raw.styleNote, 140),
      scores: scores,
    };
  }
  // Sprint 17: optional pin proposal — the model may surface one durable
  // fact per message. Sanitized; the client confirms before saving.
  const proposal = sanitizePinProposal(obj.pinProposal, todayStr);
  return { reply: reply, outfit: outfit, pinProposal: proposal };
}

// Sprint 17 (CONTEXT PINS): stored current facts the user confirmed.
// Server-side best-effort read; malformed entries drop.
function sanitizePins(raw) {
  if (!Array.isArray(raw)) return [];
  const kinds = { location: 1, weather: 1, preference: 1 };
  const out = [];
  for (const p of raw.slice(0, 20)) {
    if (!p || typeof p !== "object") continue;
    const kind = typeof p.kind === "string" ? p.kind : "";
    if (!kinds[kind]) continue;
    const label = cleanText(p.label || "", 80);
    if (!label) continue;
    const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(p.validUntil || "") ? p.validUntil : "";
    out.push({
      kind: kind,
      label: label,
      detail: cleanText(p.detail || "", 200),
      weatherSummary: cleanText(p.weatherSummary || "", 200),
      validUntil: validUntil,
      tripId: typeof p.tripId === "string" ? cleanText(p.tripId, 100) : "",
    });
  }
  return out;
}

// Sprint 17: a proposed pin — from the JSON contract (normal chat) or
// the pinContext tool call (trip mode). Returns the sanitized proposal
// or null. The client always confirms before saving: propose, never
// append.
function sanitizePinProposal(obj, todayStr) {
  if (!obj || typeof obj !== "object") return null;
  const kinds = { location: 1, weather: 1, preference: 1 };
  const kind = typeof obj.kind === "string" ? obj.kind : "";
  if (!kinds[kind]) return null;
  const label = cleanText(obj.label || "", 80);
  if (!label) return null;
  // Sprint 17 fix buffer: the model resolves relative dates itself and
  // can hallucinate (a "2024" validUntil shipped once — a pin born dead).
  // A past expiry date is always a fumble: drop it so the pin still
  // works and can be removed later by hand or by chat.
  let validUntil = /^\d{4}-\d{2}-\d{2}$/.test(obj.validUntil || "") ? obj.validUntil : "";
  if (validUntil && todayStr && validUntil < todayStr) validUntil = "";
  // Sprint 17 fix buffer: proposals can retract as well as save. "remove"
  // targets a pin the user says no longer holds (cancelled plans, back
  // early) — the client always confirms before deleting.
  const action = obj.action === "remove" ? "remove" : "save";
  return {
    action: action,
    kind: kind,
    label: label,
    detail: cleanText(obj.detail || "", 200),
    weatherSummary: cleanText(obj.weatherSummary || "", 200),
    validUntil: validUntil,
  };
}

// Sprint 17: the propose-a-pin tool (trip mode). Propose-only — the
// client shows a confirm card; nothing is ever written by the model.
// PC-37: outfit ideas for the trip, proposed WITHOUT touching the
// packing plan. The founder's model of trip chat is a full stylist
// room: ask for more outfits → get saveable outfit cards; saving one
// adds it to the trip and to the Outfits list with the trip tag.
const SUGGEST_TRIP_OUTFITS_DECL = {
  name: "suggestTripOutfits",
  description: "Propose outfit combinations built from the pieces in the current packing plan, WITHOUT changing the plan. Call when the user asks for outfit ideas, suggestions, or more outfits for this trip.",
  parameters: {
    type: "OBJECT",
    properties: {
      outfits: {
        type: "ARRAY",
        description: "Up to 4 outfit combinations, each genuinely different from the plan's outfits and from anything already suggested in this chat.",
        items: {
          type: "OBJECT",
          properties: {
            handles: { type: "ARRAY", items: { type: "STRING" }, description: "Wardrobe handles like [i3] — only pieces in the current packing plan" },
            reasoning: { type: "STRING", description: "Why this combination works for the trip" },
            lookName: { type: "STRING", description: "A 2-4 word editorial title for this outfit, like a magazine feature" },
            tagline: { type: "STRING", description: "At most 7 words capturing the feel of the look" },
            styleNote: { type: "STRING", description: "One sentence on the character of this look" },
          },
          required: ["handles"],
        },
      },
    },
    required: ["outfits"],
  },
};

const PIN_CONTEXT_DECL = {
  name: "pinContext",
  description: "Propose saving a durable current fact about the user (location, weather they'll be in, or a lasting preference). The user confirms before anything is saved — proposing is all you do.",
  parameters: {
    type: "OBJECT",
    properties: {
      action: { type: "STRING", description: "\"save\" to remember a fact, \"remove\" when the user says a pinned fact no longer holds (cancelled plans, back early)" },
      kind: { type: "STRING", description: "One of: location, weather, preference" },
      label: { type: "STRING", description: "Short label, e.g. 'Tahoe' — for \"remove\", the label of the existing pin from CURRENT CONTEXT" },
      detail: { type: "STRING", description: "What it means, e.g. 'visiting, back Sunday'" },
      weatherSummary: { type: "STRING", description: "Weather for this fact, if relevant, e.g. '28–34°F, snowing'" },
      validUntil: { type: "STRING", description: "Expiry as YYYY-MM-DD, if the fact has an end date" },
    },
    required: ["kind", "label"],
  },
};

// Sprint 16 (TRIPCHAT-1): trip chat context. The client sends the trip
// + its current packing; everything is length-clamped and the packing
// ids are just strings here — the client re-validates them against the
// real wardrobe when it executes the tool call. Malformed → null.
function sanitizeTripContext(value) {
  if (!value || typeof value !== "object") return null;
  const tripId = typeof value.tripId === "string" ? cleanText(value.tripId, 100) : "";
  if (!tripId) return null;
  const legIn = value.leg && typeof value.leg === "object" ? value.leg : {};
  const leg = {
    location: cleanText(legIn.location || "", 120),
    resolvedName: cleanText(legIn.resolvedName || "", 180),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(legIn.startDate || "") ? legIn.startDate : "",
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(legIn.endDate || "") ? legIn.endDate : "",
  };
  const packingIn = value.packing && typeof value.packing === "object" ? value.packing : null;
  let packing = null;
  if (packingIn) {
    const ids = Array.isArray(packingIn.articleIds)
      ? packingIn.articleIds.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 100).slice(0, 30)
      : [];
    const reasons = {};
    if (packingIn.articleReasons && typeof packingIn.articleReasons === "object") {
      for (const k of Object.keys(packingIn.articleReasons).slice(0, 30)) {
        if (typeof packingIn.articleReasons[k] === "string") {
          reasons[k.slice(0, 100)] = cleanText(packingIn.articleReasons[k], 140);
        }
      }
    }
    const outfits = Array.isArray(packingIn.outfits)
      ? packingIn.outfits.slice(0, 5).map((o) => ({
          itemIds: o && Array.isArray(o.itemIds)
            ? o.itemIds.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 100).slice(0, 10)
            : [],
          reasoning: o && typeof o.reasoning === "string" ? cleanText(o.reasoning, 200) : "",
          lookName: o && typeof o.lookName === "string" ? cleanText(o.lookName, 48) : "",
          tagline: o && typeof o.tagline === "string" ? cleanText(o.tagline, 80) : "",
          styleNote: o && typeof o.styleNote === "string" ? cleanText(o.styleNote, 140) : "",
        })).filter((o) => o.itemIds.length >= 2)
      : [];
    packing = { articleIds: ids, articleReasons: reasons, outfits: outfits };
  }
  // PC-37: combinations already suggested in this chat thread, so a
  // repeat ask produces new outfits instead of the same ones again.
  const suggestedOutfits = Array.isArray(value.suggestedOutfits)
    ? value.suggestedOutfits.slice(0, 12).map((set) => (Array.isArray(set)
        ? set.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 100).slice(0, 10)
        : [])).filter((s) => s.length >= 2)
    : [];
  return {
    tripId: tripId,
    tripName: cleanText(value.tripName || "", 120),
    suggestedOutfits: suggestedOutfits,
    leg: leg,
    notes: cleanText(value.notes || "", 500),
    weatherSummary: value.weatherSummary ? cleanText(value.weatherSummary, 500) : null,
    packing: packing,
  };
}

// Sprint 16 (TRIPCHAT-1): the tool the model calls to rewrite a trip's
// packing. Handles, not ids — the server maps handles → ids before the
// payload reaches the client, and the client re-validates on execute.
const UPDATE_TRIP_PACKING_DECL = {
  name: "updateTripPacking",
  description: "Replace the trip's packing plan with the full revised plan. Call ONLY when the user asks for packing changes.",
  parameters: {
    type: "OBJECT",
    properties: {
      articles: {
        type: "ARRAY",
        description: "The complete revised packing list — every piece the user should pack for this trip. Any wardrobe piece may be included, not only pieces already packed.",
        items: {
          type: "OBJECT",
          properties: {
            handle: { type: "STRING", description: "The wardrobe handle, exactly like [i3] — nothing else in this field" },
            reason: { type: "STRING", description: "Why this piece earns its place on this trip" },
          },
          required: ["handle"],
        },
      },
      outfits: {
        type: "ARRAY",
        description: "2–3 outfits built ONLY from the articles list above.",
        items: {
          type: "OBJECT",
          properties: {
            handles: { type: "ARRAY", items: { type: "STRING" }, description: "Wardrobe handles forming the outfit" },
            reasoning: { type: "STRING" },
            lookName: { type: "STRING", description: "A 2-4 word editorial title for this outfit" },
            tagline: { type: "STRING", description: "At most 7 words capturing the feel of the look" },
            styleNote: { type: "STRING", description: "One sentence on the character of this look" },
          },
          required: ["handles"],
        },
      },
      whatChanged: {
        type: "STRING",
        description: "One plain sentence saying what changed versus the previous packing plan.",
      },
    },
    required: ["articles", "whatChanged"],
  },
};

// Pure: pull ALL function calls out of a generateContent response,
// tolerating both the SDK's functionCalls getter and the raw parts
// shape. Trip mode can legitimately call two tools in one turn
// (updateTripPacking + pinContext), so callers must not stop at one.
function extractToolCalls(response) {
  const calls = [];
  try {
    const fcs = response && response.functionCalls;
    if (Array.isArray(fcs) && fcs.length) {
      for (const fc of fcs) {
        if (fc && typeof fc.name === "string") calls.push({ name: fc.name, args: fc.args || {} });
      }
      if (calls.length) return calls;
    }
    const cands = (response && response.candidates) || [];
    for (const c of cands) {
      const parts = (c && c.content && c.content.parts) || [];
      for (const p of parts) {
        if (p && p.functionCall && typeof p.functionCall.name === "string") {
          calls.push({ name: p.functionCall.name, args: p.functionCall.args || {} });
        }
      }
    }
  } catch (e) { /* fall through — no calls */ }
  return calls;
}

// Pure: the first function call, kept for callers that only need one.
function extractToolCall(response) {
  const calls = extractToolCalls(response);
  return calls.length ? calls[0] : null;
}

// "[i3]" → items index 2, or -1. Pure. Tolerant by design: the
// prompt itself shows handles embedded in lines ("[i36] "Name" —
// …"), and the model answers in kind — handle with the name
// attached, brackets dropped, prose around it. The original
// anchored match rejected every such article, the plan mapped to
// zero pieces, and the trip reply fell through to the "came back
// empty" fallback (founder report 2026-10-21; the rejection had
// already fired 7× in the logs since Oct 19, near-deterministic
// once the wardrobe hit 69 pieces). Prefer a bracketed handle
// anywhere in the string; fall back to a bare iN token.
function handleIndex(handle, items) {
  if (typeof handle !== "string") return -1;
  const m = handle.match(/\[i(\d+)\]/) || handle.match(/\bi(\d+)\b/);
  if (!m) return -1;
  const idx = Number(m[1]) - 1;
  return idx >= 0 && idx < items.length ? idx : -1;
}

// items: sanitized array. messages: sanitized [{role, text}].
// styleProfile: sanitized preference strings (may be empty).
// previousPick: sanitized {itemIds} from sanitizePreviousPick, or null.
// references: sanitized {articles, outfits} from sanitizeReferences, or null.
// vibe: sanitized explicit vibe tag from sanitizeVibe, or null.
// vibeProfile: sanitized {tags, confidence} from sanitizeVibeProfile, or null.
// Build the exact model request askStylist sends. Exported so the
// benchmark runner (tests/benchmark) exercises the real prompt —
// prompt changes and benchmark stay in sync by construction.
function buildStylistRequest(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins, today, todayPick) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const wardrobe = items.map((it, i) => itemLine(it, i)).join("\n");
  let system = SYSTEM;
  const prefs = Array.isArray(styleProfile) ? styleProfile.filter(Boolean) : [];
  if (prefs.length) {
    system += "\n\nSTYLE PROFILE — the user's confirmed preferences. Honor them when recommending:\n" +
      prefs.map((p) => "- " + p).join("\n");
  }
  // WX-1: measured local weather. The user's stated weather always wins;
  // this fills the WEATHER sub-score when they haven't mentioned any.
  if (weatherContext) {
    system += "\n\nCURRENT WEATHER — measured at the user's location just now: " +
      weatherContext + ".\n" +
      "- Use it for the WEATHER sub-score and layering choices when the user hasn't stated different weather.\n" +
      "- If the user states weather explicitly, theirs wins.\n" +
      "- ACTIVE-WEATHER RULE: if the conversation contains user-stated weather or a different location " +
      "(e.g. \"I'm in Tahoe this weekend, snowing\"), THAT is the active weather for the rest of this " +
      "conversation — score against it and ignore the measured value above until they state something new.";
  }
  // Founder bug (2026-10-24): TODAY'S PICK — the outfit on the
  // user's home screen right now, also shown at the top of this
  // chat. It was displayed but never sent, so questions about
  // it arrived context-free. When there is no in-chat pick to
  // iterate on, today's pick IS the iteration base below.
  const iterBase = previousPick || (todayPick && todayPick.itemIds.length ? { itemIds: todayPick.itemIds } : null);
  const iterBaseIsToday = !previousPick && !!iterBase;
  if (todayPick && Array.isArray(todayPick.itemIds) && todayPick.itemIds.length) {
    const tpHandles = todayPick.itemIds.map((id) => {
      const idx = items.findIndex((it) => it && it.id === id);
      if (idx === -1) return null;
      return "[i" + (idx + 1) + '] "' + cleanText(items[idx].name, 60) + '"';
    }).filter(Boolean);
    if (tpHandles.length) {
      system += "\n\nTODAY'S PICK — the outfit on the user's home screen today, shown at the top of this chat: " +
        tpHandles.join(", ") +
        (todayPick.lookName ? '. It is named "' + todayPick.lookName + '"' : "") +
        (todayPick.reasoning ? ". Why it was picked: " + todayPick.reasoning : "") +
        ".\n" +
        "- If the user's message refers to \"this\", \"it\", today's outfit, or asks a follow-up with no new subject, they mean THIS pick: answer about it directly (why it works, whether it fits the weather, what to change).\n" +
        "- A change request (\"warmer\", \"swap the shoes\") iterates from THIS pick — same rules as ITERATION below.";
    }
  }
  // PC-16: iteration. The user is refining the previous pick, not starting
  // over — resolve its ids to wardrobe handles so the model can address
  // slots ("swap the shorts") precisely.
  if (iterBase && Array.isArray(iterBase.itemIds) && iterBase.itemIds.length) {
    const prevHandles = iterBase.itemIds.map((id) => {
      const idx = items.findIndex((it) => it && it.id === id);
      if (idx === -1) return null;
      return "[i" + (idx + 1) + '] "' + cleanText(items[idx].name, 60) + '"';
    }).filter(Boolean);
    if (prevHandles.length) {
      system += "\n\nITERATION — the user is refining " + (iterBaseIsToday ? "today's pick (above)" : "your previous pick") + ", not starting over.\n" +
        "Previous pick: " + prevHandles.join(", ") + ".\n" +
        "- \"swap/change the X\" → replace only that slot's item; keep the rest.\n" +
        "- \"something warmer/cooler/dressier/…\" → adjust the pick in that direction, keeping what still works.\n" +
        "- \"another option\" / \"try again\" → pick a fully different outfit; avoid reusing previous items unless the wardrobe gives no alternative.\n" +
        "- Always return the COMPLETE new outfit (all slots), scored fresh against the rubric.";
    }
  }
  // PC-22: explicit @-references outrank the implicit previousPick — the
  // user pointed at these deliberately. Resolved to wardrobe handles so
  // the model addresses exact pieces.
  function refHandle(id) {
    const idx = items.findIndex((it) => it && it.id === id);
    if (idx === -1) return null;
    return "[i" + (idx + 1) + '] "' + cleanText(items[idx].name, 60) + '"';
  }
  if (references && (references.articles.length || references.outfits.length)) {
    const lines = [];
    const artHandles = references.articles.map(refHandle).filter(Boolean);
    if (artHandles.length) lines.push("Pointed-at PIECES: " + artHandles.join(", "));
    for (const o of references.outfits) {
      const parts = o.itemIds.map(refHandle).filter(Boolean);
      if (parts.length) lines.push('Pointed-at OUTFIT "' + (o.name || "Outfit") + '": ' + parts.join(", "));
    }
    if (lines.length) {
      system += "\n\nEXPLICIT REFERENCES — the user @-mentioned these; they outrank the previous pick.\n" +
        lines.join("\n") + "\n" +
        "- Referenced PIECES: build the outfit around them; keep all of them unless the request says otherwise.\n" +
        "- Referenced OUTFIT: treat the request as an iteration on that outfit " +
        "(\"warmer version of this\", \"dress this up\"); return the COMPLETE new outfit, scored fresh.\n" +
        "- Both present: the outfit is the base, the pieces are must-keeps.";
    }
  }
  const contents = [
    { role: "user", parts: [{ text: "WARDROBE (pick only from these items):\n" + wardrobe }] },
  ];
  // Sprint 13: explicit vibe outranks everything. The user named it — honor
  // it strongly and say so in the reply.
  if (vibe) {
    system += "\n\nREQUESTED VIBE — the user asked for \"" + vibe + "\" outfits.\n" +
      "- Strongly prefer items carrying the \"" + vibe + "\" style tag.\n" +
      "- Name the vibe you honored in your reply (e.g. \"Went " + vibe + ":\").\n" +
      "- This overrides the wearer vibe profile below when they conflict.";
  }
  // Sprint 13: learned vibe profile — a soft prior, only when confident,
  // and only when no explicit vibe was requested.
  if (!vibe && vibeProfile && vibeProfile.confidence >= 0.3) {
    const top = Object.keys(vibeProfile.tags)
      .map((t) => ({ tag: t, score: vibeProfile.tags[t] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((e) => e.tag + " " + e.score.toFixed(1))
      .join(", ");
    system += "\n\nWEARER VIBE PROFILE (confidence " + vibeProfile.confidence.toFixed(1) +
      ") — learned from what this person wears and rates: " + top + ".\n" +
      "- With no explicit vibe requested, gently favor items matching these tags.\n" +
      "- A bias, never a filter: a great non-matching outfit still beats a mediocre matching one.\n" +
      "- You may acknowledge it at most once per conversation; never lecture about it.";
  }
  // Sprint 17 (CONTEXT PINS): the user's confirmed current facts.
  // Outrank the measured weather; conversation-stated weather still
  // outranks them. Expired pins are ignored here (cleanup is quiet).
  // The client's local date wins over the server clock — evening in
  // California is already tomorrow in UTC.
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(today || "")
    ? today
    : new Date().toISOString().slice(0, 10);
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(todayStr + "T12:00:00Z").getUTCDay()];
  system += "\n\nTODAY is " + weekday + ", " + todayStr + ". " +
    "Resolve every relative date the user gives (\"until Sunday\", \"next week\", \"back Friday\") " +
    "against TODAY — never guess a year.";
  // Threads scoping (founder 2026-10-19): inside a trip conversation,
  // global location/weather pins do NOT apply — the trip's own
  // destination and packing weather are the context there. Preference
  // pins and pins scoped to this trip still do.
  let activePins = (Array.isArray(pins) ? pins : []).filter(
    (p) => !p.validUntil || p.validUntil >= todayStr
  );
  if (tripContext) {
    activePins = activePins.filter(
      (p) => p.kind === "preference" || p.tripId === tripContext.tripId
    );
  }
  if (activePins.length) {
    const pinLines = activePins.map((p) => {
      let line = "- [" + p.kind + "] " + p.label;
      if (p.detail) line += " — " + p.detail;
      if (p.weatherSummary) line += " (weather: " + p.weatherSummary + ")";
      if (p.validUntil) line += " [until " + p.validUntil + "]";
      return line;
    });
    system += "\n\nCURRENT CONTEXT — durable facts the user confirmed. " +
      "Treat them as true for the whole conversation unless the user says otherwise.\n" +
      pinLines.join("\n") + "\n" +
      "- An active location/weather pin is the DEFAULT weather and location for scoring — " +
      "it outranks the measured CURRENT WEATHER above. Conversation-stated weather still outranks it.";
  }
  // Sprint 17: pin proposals. The user states durable facts in chat
  // ("I'm in Tahoe until Sunday", "I run cold"); surface them as
  // proposals — the client always confirms before saving.
  if (!tripContext) {
    system += "\n\nCONTEXT PIN PROPOSAL — you may return at most one \"pinProposal\" in the JSON alongside reply/outfit:\n" +
      "{ \"action\": \"save|remove\", \"kind\": \"location|weather|preference\", \"label\": \"<short>\", \"detail\": \"<what it means>\",\n" +
      "  \"weatherSummary\": \"<if relevant>\", \"validUntil\": \"<YYYY-MM-DD if it ends>\" }.\n" +
      "- \"save\": propose ONLY for NEW durable facts the user just stated and that are NOT already in CURRENT CONTEXT above.\n" +
      "- \"remove\": if a fact in CURRENT CONTEXT no longer holds — the user says plans were cancelled, they're back " +
      "early, or the fact changed — propose \"remove\" with that pin's kind and label from CURRENT CONTEXT. " +
      "If it changed to something new, propose the replacement as \"save\" instead.\n" +
      "- Location/weather: where they'll be / what weather they'll be in. Preference: lasting facts " +
      "(runs cold, leans casual, loves earth tones, never suggest X, packing style, owns ski gear).\n" +
      "- Extract end dates from speech (\"until Sunday\" → that date). Skip trivia and one-off requests.\n" +
      "- Never propose on your own initiative — only when the user states the fact or its end. Propose, never append.";
  }
  for (const m of messages) {
    contents.push({ role: m.role, parts: [{ text: m.text }] });
  }
  // Sprint 16 (TRIPCHAT-1): trip mode. The model gets the trip + the
  // current packing (as handles) and one tool to rewrite the plan.
  if (tripContext) {
    const leg = tripContext.leg || {};
    const where = leg.resolvedName || leg.location || "the destination";
    const when = leg.startDate
      ? " (" + leg.startDate + (leg.endDate && leg.endDate !== leg.startDate ? " → " + leg.endDate : "") + ")"
      : "";
    system += "\n\nTRIP MODE — you are the stylist for the trip \"" +
      (tripContext.tripName || "Trip") + "\" to " + where + when + ".";
    if (tripContext.notes) system += "\nTrip notes from the user: " + tripContext.notes;
    if (tripContext.weatherSummary) system += "\nPacking weather: " + tripContext.weatherSummary;
    const pk = tripContext.packing;
    if (pk && pk.articleIds.length) {
      const byId = new Map(items.map((it, i) => [it.id, i]));
      const lines = [];
      for (const id of pk.articleIds) {
        const idx = byId.get(id);
        if (idx === undefined) continue;
        const reason = pk.articleReasons && pk.articleReasons[id] ? " — " + pk.articleReasons[id] : "";
        lines.push("- [i" + (idx + 1) + "] \"" + cleanText(items[idx].name, 60) + "\"" + reason);
      }
      if (lines.length) {
        system += "\n\nCURRENT PACKING PLAN — these pieces are currently going:\n" + lines.join("\n");
        const outfitLines = [];
        pk.outfits.forEach((o, oi) => {
          const parts = o.itemIds.map((id) => {
            const idx = byId.get(id);
            return idx === undefined ? null : "[i" + (idx + 1) + "]";
          }).filter(Boolean);
          if (parts.length >= 2) {
            outfitLines.push("Outfit " + (oi + 1) + ": " + parts.join(", ") +
              (o.reasoning ? " — " + o.reasoning : ""));
          }
        });
        if (outfitLines.length) system += "\n" + outfitLines.join("\n");
        const sugLines = [];
        (tripContext.suggestedOutfits || []).forEach((set) => {
          const parts = (set || []).map((id) => {
            const idx = byId.get(id);
            return idx === undefined ? null : "[i" + (idx + 1) + "]";
          }).filter(Boolean);
          if (parts.length >= 2) sugLines.push(parts.join(", "));
        });
        if (sugLines.length) {
          system += "\nAlready suggested in this chat — do not repeat these combinations: " + sugLines.join(" | ");
        }
      }
    } else {
      system += "\n\nNo packing plan exists yet for this trip.";
    }
    // Founder ask (2026-10-21): trip chat must reach the WHOLE wardrobe,
    // not only the current plan — "add the black hoodie" names a piece
    // that isn't packed yet. The plumbing always allowed it (handle
    // mapping and client validation both run against all items); the
    // prompt never said so and the unpacked pieces had no nearby
    // inventory. List them, by handle, next to the plan.
    const packedIdSet = new Set(pk && Array.isArray(pk.articleIds) ? pk.articleIds : []);
    const restLines = [];
    items.forEach((it, i) => {
      if (!it || packedIdSet.has(it.id)) return;
      restLines.push("- [i" + (i + 1) + "] \"" + cleanText(it.name, 60) + "\"");
    });
    if (restLines.length) {
      system += "\n\nREST OF THE WARDROBE — not packed yet, but the user can ask for any of these by name and you can add them to the plan:\n" +
        restLines.slice(0, 200).join("\n");
    }
    system += "\n\nYOU HAVE A TOOL: updateTripPacking.\n" +
      "- Call it ONLY when the user asks for a packing change (\"keep the blue sweater\", \"drop the boots\", \"pack warmer\", \"add a dinner outfit\").\n" +
      "- The payload is the COMPLETE new packing plan — include pieces they didn't mention if those still belong.\n" +
      "- \"keep X\" is a hard constraint: X stays no matter what. \"drop/remove X\": X leaves the plan.\n" +
      "- articles: every piece they should pack, each with a short reason. outfits: 2–3, built ONLY from those articles, 2+ pieces each.\n" +
      "- ADDING: the user can add ANY wardrobe piece by name — packed or not (\"add the black hoodie\", \"also pack my trail shoes\"). Put it in articles with a reason, like everything else.\n" +
      "- In prose you may talk about any wardrobe piece by name, not only the packed ones.\n" +
      "- whatChanged: one plain sentence describing what changed versus the current plan above.\n" +
      "- After calling, say the whatChanged line in prose too, briefly.\n" +
      "- Questions about the trip (weather, plans, \"will I need a coat?\") → answer in prose. NO tool call.\n" +
      "- WEATHER DEFAULT: score everything against the packing weather above. If the user states different weather " +
      "for this trip, that wins going forward.\n" +
      "- PIN PROPOSAL: if the user states a durable fact (a location they'll be in, weather they'll face, a lasting " +
      "preference), call the pinContext tool to PROPOSE saving it (action \"save\"). If a fact in CURRENT CONTEXT no " +
      "longer holds — plans cancelled, back early — call pinContext with action \"remove\" and that pin's kind + label. " +
      "The user confirms before anything changes — you only propose, and only when they state the fact or its end. " +
      "Never propose on your own initiative.\n" +
      "- BOTH TOOLS: if one message asks for a packing change AND states a lasting preference (\"pack light — I always " +
      "pack light\"), call updateTripPacking for the change AND pinContext for the preference in the same response.\n" +
      "- Each article in updateTripPacking is an object like {\"handle\": \"[i3]\", \"reason\": \"...\"} — the handle ALONE in that exact form, no name or other text attached to it.\n" +
      "- If the user asks for outfit ideas, suggestions, or more outfits for the trip, call suggestTripOutfits with up to 4 outfits built ONLY from the pieces in the current packing plan. Each must be a genuinely different combination — never repeat the plan's outfits or a combination already suggested in this chat. Do NOT call updateTripPacking just to suggest outfits; suggesting leaves the plan untouched.\n" +
      "- ALWAYS include a short prose reply in the same response as any tool call — never send a tool call with no text. " +
      "Say what changed in one sentence; the client shows that line as your answer.";
  }
  const config = {
    systemInstruction: system,
    temperature: 0.3,
    // Trip mode rewrites the whole packing plan per call — the biggest
    // output in the app; 2500 truncated tool calls (2026-10-19), and
    // 4000 still crowded a full re-plan over a 69-piece wardrobe
    // (2026-10-21) — the thinking budget draws from the same pool.
    maxOutputTokens: tripContext ? 7000 : 2500,
    thinkingConfig: { thinkingBudget: 1024 },
  };
  if (tripContext) {
    // Function calling is incompatible with a forced JSON mime type —
    // trip mode answers in prose and/or the tool call instead.
    config.tools = [{ functionDeclarations: [UPDATE_TRIP_PACKING_DECL, SUGGEST_TRIP_OUTFITS_DECL, PIN_CONTEXT_DECL] }];
  } else {
    config.responseMimeType = "application/json";
  }
  return { model, contents, config };
}

async function callStylistModel(ai, model, contents, config, label, todayStr, hooks) {
  const callStart = Date.now();
  let response;
  try {
    response = await ai.models.generateContent({ model, contents, config });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", label + ": generateContent failed: " + (err && err.message));
  }
  reportUsage(hooks, response, model, callStart);
  const text = (response.text || "").trim();
  if (!text) {
    logAiFailure(label, response);
    throw codedError("AI_BAD_RESPONSE", label + ": model returned no text");
  }
  return parseStylistJson(text, todayStr);
}

// Sprint 16 (TRIPCHAT-1): trip-mode call. A tool-only response has no
// text — that is fine as long as a function call came through.
async function callStylistModelTrip(ai, model, contents, config, hooks) {
  const callStart = Date.now();
  let response;
  try {
    response = await ai.models.generateContent({ model, contents, config });
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "askStylist(trip): generateContent failed: " + (err && err.message));
  }
  reportUsage(hooks, response, model, callStart);
  const toolCalls = extractToolCalls(response);
  const text = (response.text || "").trim();
  if (!toolCalls.length && !text) {
    logAiFailure("askStylist-trip", response);
    throw codedError("AI_BAD_RESPONSE", "askStylist(trip): model returned no text and no tool call");
  }
  return { text: text, toolCalls: toolCalls };
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
// previousPick: sanitized {itemIds} or null (PC-16 iteration).
// references: sanitized {articles, outfits} or null (PC-22 @-mentions).
// vibe: sanitized explicit vibe tag or null (Sprint 13).
// vibeProfile: sanitized {tags, confidence} or null (Sprint 13).
// Returns { reply, outfit: { itemIds, confidence, reasoning, scores, lookName, tagline } | null }.
// tripContext: sanitized trip context from sanitizeTripContext, or null.
// In trip mode the model may call updateTripPacking instead of (or in
// addition to) answering in prose — handles are mapped to real item ids
// Pure: map an updateTripPacking tool call's args to real wardrobe ids
// (the client re-validates on execute). Returns the mapped call or null
// when nothing survived (e.g. the model sent non-[iN] handles).
function mapUpdateTripPacking(raw, items) {
  const args = raw && typeof raw === "object" ? raw : {};
  const seen = new Set();
  const articles = [];
  for (const a of (Array.isArray(args.articles) ? args.articles : [])) {
    // Entries may be objects ({handle, reason}) or bare strings,
    // and the handle may ride under handle/id/item. If no handle
    // parses, a bare string that exactly names a piece still
    // resolves — the model sometimes answers with names.
    const rawHandle = typeof a === "string" ? a : (a && (a.handle || a.id || a.item));
    let idx = handleIndex(rawHandle, items);
    if (idx < 0 && typeof rawHandle === "string") {
      const want = rawHandle.trim().toLowerCase();
      idx = items.findIndex((it) => (it.name || "").trim().toLowerCase() === want);
    }
    if (idx < 0 || seen.has(items[idx].id)) continue;
    seen.add(items[idx].id);
    articles.push({ id: items[idx].id, reason: cleanText((a && a.reason) || "", 140) });
  }
  const outfits = [];
  for (const o of (Array.isArray(args.outfits) ? args.outfits : [])) {
    const ids = ((o && Array.isArray(o.handles)) ? o.handles : [])
      .map((h) => handleIndex(h, items))
      .filter((idx) => idx >= 0 && seen.has(items[idx].id))
      .map((idx) => items[idx].id);
    if (ids.length >= 2) {
      outfits.push({
        itemIds: ids,
        reasoning: cleanText((o && o.reasoning) || "", 200),
        lookName: cleanText((o && o.lookName) || "", 48),
        tagline: cleanText((o && o.tagline) || "", 80),
        styleNote: cleanText((o && o.styleNote) || "", 140),
      });
    }
  }
  if (!articles.length) return null;
  return {
    name: "updateTripPacking",
    articles: articles,
    outfits: outfits,
    whatChanged: cleanText(args.whatChanged || "", 160),
  };
}

// PC-37: map a suggestTripOutfits call to id-based outfit
// suggestions. Pure. Rules: handles resolve tolerantly (handleIndex);
// an outfit needs 2+ distinct pieces; when the plan's article ids
// are known, every piece must be in the plan (suggestions are built
// from what's packed); identical combinations dedupe; cap 4.
function mapSuggestTripOutfits(raw, items, planIds) {
  const args = raw && typeof raw === "object" ? raw : {};
  const plan = new Set(Array.isArray(planIds) ? planIds : []);
  const seenSets = new Set();
  const out = [];
  for (const o of (Array.isArray(args.outfits) ? args.outfits : [])) {
    const ids = ((o && Array.isArray(o.handles)) ? o.handles : [])
      .map((h) => handleIndex(h, items))
      .filter((idx) => idx >= 0)
      .map((idx) => items[idx].id);
    const uniq = [...new Set(ids)];
    if (uniq.length < 2) continue;
    if (plan.size && !uniq.every((id) => plan.has(id))) continue;
    const key = uniq.slice().sort().join(",");
    if (seenSets.has(key)) continue;
    seenSets.add(key);
    out.push({
      itemIds: uniq,
      reasoning: cleanText((o && o.reasoning) || "", 200),
      lookName: cleanText((o && o.lookName) || "", 48),
      tagline: cleanText((o && o.tagline) || "", 80),
      styleNote: cleanText((o && o.styleNote) || "", 140),
    });
    if (out.length >= 4) break;
  }
  return out;
}

// OBS-1: rejected trip-tool args, WITH a sample of the raw values —
// keys/types alone left the 2026-10-21 failure undiagnosable beyond
// "structurally complete, mapped to zero."
function logTripArgsRejected(stage, args) {
  try {
    console.error(JSON.stringify({
      event: "trip_tool_args_rejected",
      label: "askStylist-tripToolArgs",
      stage: stage,
      argsKeys: Object.keys(args || {}),
      articlesType: Array.isArray(args && args.articles) ? "array" : typeof (args && args.articles),
      articlesSample: JSON.stringify((args && args.articles) || []).slice(0, 600),
    }));
  } catch (e) { /* logging must never throw */ }
}

// Trip mode drops the JSON mime type, but the model sometimes still
// answers in the non-trip JSON envelope ({"reply": ..., "outfit":
// null}) as raw text — the client then renders the envelope itself
// (founder screenshot, 2026-10-21). Unwrap it: the words are the
// reply. A JSON-shaped outfit in trip mode is not actionable here —
// trip outfits travel via updateTripPacking.
function unwrapJsonReply(text) {
  if (!text) return text;
  const t = String(text).trim();
  if (!t.startsWith("{")) return text;
  try {
    const obj = JSON.parse(t);
    if (obj && typeof obj.reply === "string" && obj.reply.trim()) return obj.reply;
  } catch (e) { /* not the envelope — leave the text alone */ }
  return text;
}

// here; the client re-validates on execute.
async function askStylist(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins, today, hooks, todayPick) {
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(today || "")
    ? today
    : new Date().toISOString().slice(0, 10);
  const { model, contents, config } = buildStylistRequest(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins, todayStr, todayPick);
  const ai = getClient();
  if (tripContext) {
    // Trip mode: the tools are independent — a packing change and a
    // preference pin can land in the same turn. Process both.
    let { text, toolCalls } = await callStylistModelTrip(ai, model, contents, config, hooks);
    const updCall = toolCalls.find((c) => c.name === "updateTripPacking");
    const pinCall = toolCalls.find((c) => c.name === "pinContext");
    const sugCall = toolCalls.find((c) => c.name === "suggestTripOutfits");
    let outfitSuggestions = sugCall
      ? mapSuggestTripOutfits(sugCall.args, items, (tripContext.packing && tripContext.packing.articleIds) || [])
      : [];
    let mappedCall = updCall ? mapUpdateTripPacking(updCall.args, items) : null;
    let retrySawUpd = false;
    if (updCall && !mappedCall) {
      // The model tried to update the packing but its args didn't
      // survive mapping — log it (OBS-1) and re-ask once with a hint.
      logTripArgsRejected("first", updCall.args);
      const retryContents = contents.concat([{
        role: "user",
        parts: [{ text: "Your packing update didn't go through — the articles didn't match the wardrobe. Call updateTripPacking again using the EXACT [iN] handles from the wardrobe list above (e.g. [i3]), every piece with a reason, and include a short sentence of prose saying what changed." }],
      }]);
      const retry = await callStylistModelTrip(ai, model, retryContents, config, hooks);
      text = retry.text || text;
      for (const c of retry.toolCalls) {
        if (!mappedCall && c.name === "updateTripPacking") {
          retrySawUpd = true;
          mappedCall = mapUpdateTripPacking(c.args, items);
          if (!mappedCall) logTripArgsRejected("retry", c.args);
        }
        if (!pinCall && c.name === "pinContext") {
          toolCalls.push(c);
        }
        if (!outfitSuggestions.length && c.name === "suggestTripOutfits") {
          outfitSuggestions = mapSuggestTripOutfits(c.args, items, (tripContext.packing && tripContext.packing.articleIds) || []);
        }
      }
    }
    const pinProposal = toolCalls.some((c) => c.name === "pinContext")
      ? sanitizePinProposal((toolCalls.find((c) => c.name === "pinContext") || {}).args, todayStr)
      : null;
    text = unwrapJsonReply(text);
    // The user always gets words, never an empty bubble — and the
    // words must describe what actually happened. A plan that
    // arrived but couldn't be applied is not an "empty" reply.
    const planFailed = !mappedCall && (updCall || retrySawUpd);
    if (!text) {
      text = mappedCall
        ? ("Packing updated — " + (mappedCall.whatChanged || "got it."))
        : (pinProposal ? "Got it."
          : outfitSuggestions.length
            ? "A few outfit ideas from your packing — tap Save on any you'd like to keep."
            : planFailed
              ? "I drafted a plan but couldn't apply it cleanly — your packing is unchanged. Mind asking once more?"
              : "Hmm — that came back empty on my end. Try again?");
    }
    return { reply: text, toolCall: mappedCall, pinProposal: pinProposal, outfitSuggestions: outfitSuggestions };
  }
  let parsed = await callStylistModel(ai, model, contents, config, "askStylist", todayStr, hooks);

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
      parsed = await callStylistModel(ai, model, repairContents, config, "askStylist-repair", todayStr, hooks);
      mapped = parsed.outfit ? mapHandlesToIds(parsed.outfit, items) : null;
      problem = parsed.outfit ? validateSlots(mapped || [], items) : null;
    } catch (e) {
      // Repair failed — fall through to text-only below.
      problem = problem || "repair failed";
    }
  }

  if (!parsed.outfit || !mapped || problem) {
    return { reply: parsed.reply, outfit: null, pinProposal: parsed.pinProposal || null };
  }
  return {
    reply: parsed.reply,
    outfit: {
      itemIds: mapped.map((m) => m.id),
      itemNames: mapped.map((m) => m.name),
      confidence: confidenceFromScores(parsed.outfit.scores),
      reasoning: parsed.outfit.reasoning,
      lookName: parsed.outfit.lookName || null,
      tagline: parsed.outfit.tagline || null,
      styleNote: parsed.outfit.styleNote || null,
      scores: parsed.outfit.scores,
    },
    pinProposal: parsed.pinProposal || null,
  };
}

module.exports = { askStylist, buildStylistRequest, parseStylistJson, sanitizeItems, sanitizeMessages, sanitizePreviousPick, sanitizeTodayPick, sanitizeReferences, sanitizeStyleProfile, sanitizeVibe, sanitizeVibeProfile, sanitizeWeatherContext, sanitizeTripContext, sanitizePins, sanitizePinProposal, extractToolCall, extractToolCalls, mapUpdateTripPacking, mapSuggestTripOutfits, handleIndex, unwrapJsonReply, mapHandlesToIds, validateSlots, parseScores, confidenceFromScores, describeColors, itemLine, cleanText, RUBRIC_VERSION, SYSTEM, VIBE_TAGS };
