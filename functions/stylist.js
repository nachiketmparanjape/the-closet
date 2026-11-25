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
const { codedError, logEvent } = require("./errors");

const MAX_ITEMS = 500;
// UX-18 W5 (decision 7): the reading window is the last 50 messages
// of the conversation — per conversation, stated honestly in-app when
// a thread first passes it (the client adds the note; the doc's
// windowNoted flag keeps it to once).
const MAX_MESSAGES = 50;
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
// UX-18 W5 (decision 5): the who-wins table as ONE stated block in
// the brief — the same table CURRENT-STATE.md carries and
// CONTEXT-MODEL.md specifies. Per-feature prose elsewhere in the
// brief explains mechanics; when anything conflicts, this block is
// the rule. One rulebook for every caller (decision 9).
const PRECEDENCE = `WHO WINS — when instructions conflict, the higher line wins:
1. The user's confirmed style notes (the STYLE PROFILE) beat everything else.
2. A style word the user named for this conversation beats the learned taste profile.
3. Pieces or outfits the user pointed at (@-references) beat the previous pick as the outfit being changed.
4. Weather the user states in this conversation beats a pinned location/weather fact; a pinned fact beats the measured weather.
5. An attached today's pick is the iteration base only when this conversation has no pick of its own yet.`;

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
- MORE THAN ONE (PC-88): if the user asks for more than one outfit ("three outfits", "a few options", "several looks"), return up to 3 in an "outfits" array — each with the same shape as "outfit" (reasoning, lookName, tagline, styleNote, items, scores) and a genuinely different combination, never the same set twice. Set "outfit" to null in that case.
- Use the STYLING RUBRIC to judge the outfit. Write your reasoning FIRST (two sentences: what anchors the look, what ties the colors together), then score it.
- Name the outfit like a magazine feature: a 2–4 word editorial title ("Lobby Handshake", "Harbour Luxe") plus a tagline of at most 7 words capturing its feel ("Soft center, sharp frame"). Evocative and specific to THIS outfit — never generic ("Nice Outfit"), never a list of the items.
- Add a style note: ONE sentence on the look's character — who it reads as, what it signals ("Reads polished without trying — boardroom bones, weekend ease.").
- Keep the conversational reply brief: the outfit first, then why it works. The card carries the answer, so the prose adds only what the card does not say — two sentences at most, and fresh wording every reply. Never reuse a stock phrase or intensifier from an earlier reply in this conversation ("effortless", "cool-toned", "incredibly", "timeless, quiet luxury" all count).
- SAME OUTFIT, SAME IDENTITY (PC-65): if the combination you are about to propose is the EXACT same set of pieces as an outfit you already proposed earlier in this conversation, it is the SAME outfit — never give it a new lookName or different scores. Keep the original name and scores, say plainly in the reply that it's the same core outfit, and offer a variation instead (swap one piece, add a layer, change the shoes). Re-skinning the same pieces as a new discovery is the one move that breaks trust here.
- The user's message carries the occasion, weather, and any preferences — use all three.
- If the wardrobe honestly cannot cover the occasion (e.g. no formal wear for a wedding), say so plainly and offer the closest workable option instead of faking it.
- SCOPE: your whole job is outfits from the owned wardrobe below. Never ask the user what they want to BUY (no "looking for a new jacket?" follow-ups) — that question invites a topic you can't serve. If they ask about buying anyway, be straight in one sentence: you work with what they own; a Shop check is the right tool for buy decisions. No lecture, no apology paragraph. Exception (PC-83): when the user attached a shop item to this conversation on purpose to ask about it, judge it (what it pairs with, whether it duplicates something owned, buy or pass) instead of deflecting. The deflection above does not apply to an attached item.
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
question). When the user asked for more than one outfit, return them in
"outfits": [ <same shape as "outfit", up to 3> ] and set "outfit" to
null. Each outfit must be a genuinely different combination. The "items" handles must be copied EXACTLY from the wardrobe
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
    // Role: the server's model role is "model". Clients may send
    // "assistant" (the OpenAI-style name) — normalize it here so a
    // client that uses the other name does not silently flip the
    // assistant's turns into user turns.
    const role = (m.role === "model" || m.role === "assistant") ? "model" : "user";
    // Text: "text" is the contract (the main chat sends it). "content"
    // is accepted as a fallback — a client that sends the other field
    // name must not silently lose every message (PC-41, 2026-11-05:
    // the follow-up sheet sent "content" and every message was
    // dropped, failing the call with an empty-messages error).
    const text = cleanText(m.text || m.content, MAX_TEXT);
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

// PC-71: outfits the user rejected ("Not for me"), with a reason.
// The client builds the list from thread messages carrying
// outfitFeedback; ids are re-validated against the wardrobe,
// like previousPick. At most 8 ride one request.
const REJECT_REASONS = ["too-plain", "wrong-vibe", "not-that-piece", "wrong-weather"];
function sanitizeRejectedOutfits(value, items) {
  if (!Array.isArray(value)) return null;
  const valid = new Set((items || []).map((it) => it && it.id).filter(Boolean));
  const out = [];
  for (const r of value) {
    if (!r || typeof r !== "object") continue;
    if (REJECT_REASONS.indexOf(r.reason) === -1) continue;
    const ids = Array.isArray(r.itemIds)
      ? r.itemIds.filter((id) => typeof id === "string" && valid.has(id)).slice(0, 6)
      : [];
    if (!ids.length) continue;
    out.push({ itemIds: ids, reason: r.reason });
  }
  return out.length ? out.slice(0, 8) : null;
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

// Shop attach (founder, 2026-10-24): a shop-check item the user is
// deciding about, attached to the conversation explicitly so
// follow-ups ("would it go with my navy blazer?") have the facts.
// It is NOT a wardrobe piece — no ids, no handles; the brief marks
// it as under consideration and outfits stay wardrobe-only.
function sanitizeShopItem(value) {
  if (!value || typeof value !== "object") return null;
  const name = cleanText(value.name, 60);
  if (!name) return null;
  return {
    name: name,
    category: cleanText(value.category, 40) || null,
    colors: cleanList(value.colors, 6, 30),
    note: cleanText(value.note, 200) || null,
    score: typeof value.score === "number" && isFinite(value.score) ? value.score : null,
    verdict: cleanText(value.verdict, 300) || null,
    reasons: cleanList(value.reasons, 6, 160),
  };
}

// PC-38: reference PHOTOS attached to a chat message — vision
// context for that turn only. Distinct from PC-22's references
// (wardrobe pointers): these are images the user is aiming for,
// never wardrobe items. Hard caps: at most 4, known image MIME
// types only, each payload a plausible base64 image (the client
// downscales to ≤1024px JPEG, ~200KB; the ceiling here is the
// abuse guard, not the expectation). Malformed → dropped.
const REF_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
function sanitizeRefImages(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value.slice(0, 4)) {
    if (!v || typeof v !== "object") continue;
    if (!REF_IMAGE_MIMES.has(v.mimeType)) continue;
    if (typeof v.data !== "string" || v.data.length < 100 || v.data.length > 2000000) continue;
    out.push({ mimeType: v.mimeType, data: v.data });
  }
  return out;
}

// PC-67: photo-check verdicts — the client's garment matcher ran
// on a photo the user sent in chat and reported, per piece,
// whether it is already in the wardrobe. The stylist grounds its
// logged/unlogged claims in these instead of assuming. Strict
// shape; malformed entries drop.
function sanitizePhotoVerdicts(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value.slice(0, 8)) {
    if (!v || typeof v !== "object") continue;
    if (v.status !== "matched" && v.status !== "unmatched" && v.status !== "ambiguous") continue;
    out.push({
      label: cleanText(v.label, 60),
      status: v.status,
      matchedName: cleanText(v.matchedName, 60),
      altName: cleanText(v.altName, 60),
    });
  }
  return out;
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
// PC-84: the keep floor — an iteration that is not an explicit
// fresh pick must keep at least half of the iteration base's
// pieces, counted, not judged. (Sprint 33 said only "keep MOST",
// and the model judged every slot of a casual base "must change"
// for formal — Round 2: 0 of 4 kept.) Returns the problem string
// when the floor is missed, else null. "Another option" / "try
// again" explicitly want a fresh pick, so the floor does not
// apply to them. A base under 2 pieces has no meaningful floor.
function iterationKeepProblem(mappedIds, baseIds, lastUserText) {
  if (!Array.isArray(baseIds) || baseIds.length < 2) return null;
  if (!Array.isArray(mappedIds) || !mappedIds.length) return null;
  if (/\b(another option|try again|something else|different outfit|start over|start fresh)\b/i.test(String(lastUserText || ""))) return null;
  const kept = mappedIds.filter((id) => baseIds.indexOf(id) !== -1).length;
  const floor = Math.ceil(baseIds.length / 2);
  if (kept >= floor) return null;
  return "kept only " + kept + " of " + baseIds.length + " pieces from the previous pick — keep at least " + floor + " (change only the slots that must change for the direction)";
}

// #139: canonical outfit identity — the same combination under
// a new name is still the same outfit. The exact set (order- and
// duplicate-insensitive) and the base (top + bottom only):
// changing only the shoes or accessories is not a new look
// (tester clarification 2026-11-05).
function canonicalOutfitKey(itemIds) {
  if (!Array.isArray(itemIds)) return "";
  return Array.from(new Set(itemIds.filter(Boolean))).sort().join("|");
}
function baseOutfitKey(itemIds, items) {
  if (!Array.isArray(itemIds)) return "";
  const byId = new Map((items || []).map((it) => [it.id, it]));
  const core = itemIds.filter((id) => {
    const c = (byId.get(id) || {}).category;
    return c === "Tops" || c === "Bottoms";
  });
  return Array.from(new Set(core)).sort().join("|");
}
// #139: assemble the recent history a Today generation must not
// repeat. wearEvents are the windowed wear records (articleIds
// survive even if the saved outfit doc was deleted); dailyPicks
// are the day's saved picks, oldest day first. Worn and suggested
// stay distinct lists — a worn outfit outranks a merely suggested
// one in the brief. Entries are { ids, key, baseKey, date, kind }.
function assembleTodayHistory(wearEvents, dailyPicks) {
  const worn = [];
  const suggested = [];
  const seenWorn = new Set();
  (Array.isArray(wearEvents) ? wearEvents : []).forEach((w) => {
    const ids = Array.isArray(w && w.articleIds) ? w.articleIds.filter(Boolean) : [];
    if (ids.length < 2) return;
    const key = canonicalOutfitKey(ids);
    if (!key || seenWorn.has(key)) return;
    seenWorn.add(key);
    worn.push({ ids: Array.from(new Set(ids)).sort(), key: key, baseKey: "", date: w.date || null, kind: "worn" });
  });
  const seenSuggested = new Set();
  (Array.isArray(dailyPicks) ? dailyPicks : []).forEach((day) => {
    (Array.isArray(day && day.picks) ? day.picks : []).forEach((wrap) => {
      const ids = wrap && wrap.outfit && Array.isArray(wrap.outfit.itemIds)
        ? wrap.outfit.itemIds.filter(Boolean) : [];
      if (ids.length < 2) return;
      const key = canonicalOutfitKey(ids);
      if (!key || seenSuggested.has(key)) return;
      seenSuggested.add(key);
      suggested.push({ ids: Array.from(new Set(ids)).sort(), key: key, baseKey: "", date: day.date || null, kind: "suggested" });
    });
  });
  return { worn: worn, suggested: suggested };
}
// Fill a history's baseKeys once the wardrobe (with categories)
// is known. Kept separate so assembleTodayHistory stays pure
// over ids alone and testable without items.
function withBaseKeys(history, items) {
  if (!history) return history;
  ["worn", "suggested"].forEach((list) => {
    (history[list] || []).forEach((e) => { e.baseKey = baseOutfitKey(e.ids, items); });
  });
  return history;
}
// #139: does the wardrobe offer a different base outfit from the
// one returned? A base is a top + bottom pair; another pair exists
// exactly when there is another top or another bottom to swap in.
// A one-top-one-bottom wardrobe has no alternative — the repeat is
// allowed (bounded fallback, not a loop).
function todayHasAlternative(items) {
  const tops = (items || []).filter((it) => it && it.category === "Tops").length;
  const bottoms = (items || []).filter((it) => it && it.category === "Bottoms").length;
  return tops * bottoms > 1;
}
// #139: the repeat problem — a repair trigger, not a rejection.
// An exact repeat, or the same top + bottom with different shoes
// or accessories, is a repeat when a different base exists. Null
// when there is no history, no repeat, or no alternative.
function todayRepeatProblem(mappedIds, history, items) {
  if (!history) return null;
  const key = canonicalOutfitKey(mappedIds);
  const baseKey = baseOutfitKey(mappedIds, items);
  if (!key && !baseKey) return null;
  if (!todayHasAlternative(items)) return null;
  const all = (history.worn || []).concat(history.suggested || []);
  for (const e of all) {
    if (key && e.key === key) {
      return "this exact outfit was " + (e.kind === "worn" ? "worn" : "suggested") + " recently — pick a different top or bottom, not a new name for the same outfit";
    }
  }
  for (const e of all) {
    if (baseKey && e.baseKey && e.baseKey === baseKey) {
      return "this top + bottom pair was " + (e.kind === "worn" ? "worn" : "suggested") + " recently — changing only the shoes or accessories is not a new outfit; change at least one of the top or bottom";
    }
  }
  return null;
}
// #139: the last N local dates (YYYY-MM-DD), newest first,
// by pure calendar arithmetic on the date string — no clock,
// no DST edge (a date is a date).
function lastNDates(todayStr, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayStr || "");
  if (!m) return [];
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base - i * 86400000);
    const p = (x) => (x < 10 ? "0" : "") + x;
    out.push(d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()));
  }
  return out;
}
// #139: sanitize the client's 7-local-day window ({start, end}
// ISO timestamps of local midnights). Malformed, reversed, or
// wider than 8 days → a UTC window derived from the Today date,
// so history still loads degraded rather than failing.
function sanitizeTodayWindow(value, todayStr) {
  const startMs = Date.parse(value && value.start);
  const endMs = Date.parse(value && value.end);
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && endMs - startMs <= 8 * 86400000) {
    return { start: new Date(startMs), end: new Date(endMs) };
  }
  const dates = lastNDates(todayStr, 7);
  const first = dates.length ? dates[dates.length - 1] : todayStr;
  return { start: new Date(first + "T00:00:00Z"), end: new Date(todayStr + "T00:00:00Z") };
}
// #139: load the history for a Today generation from Firestore
// (server-side, so it works across devices and after a local
// clear). db is the Firestore handle (injected for tests).
// Wear events come from the windowed query; daily picks from the
// per-day docs. A failed read throws — the caller treats it as
// degraded and generates without history.
async function loadTodayHistory(db, uid, todayStr, window) {
  const dates = lastNDates(todayStr, 7);
  const wearSnap = await db.collection("users").doc(uid).collection("wear_events")
    .where("wornAt", ">=", window.start).where("wornAt", "<", window.end).limit(50).get();
  const wearEvents = wearSnap.docs.map((d) => {
    const w = d.data() || {};
    // No per-event date: the window already bounds these to the
    // last 7 local days, and the server has no timezone to turn
    // a Timestamp into the user's local date (a UTC date here
    // would mislabel wears near midnight). Daily picks carry
    // exact local dates via their doc ids.
    return { articleIds: Array.isArray(w.articleIds) ? w.articleIds : [], date: null };
  });
  const pickSnaps = await Promise.all(dates.map((date) =>
    db.collection("users").doc(uid).collection("today_picks").doc(date).get()));
  const dailyPicks = pickSnaps.map((snap, i) => {
    if (!snap.exists) return null;
    const d = snap.data() || {};
    return { date: dates[i], picks: Array.isArray(d.picks) ? d.picks : [] };
  }).filter(Boolean);
  return assembleTodayHistory(wearEvents, dailyPicks);
}

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

// One outfit object from the JSON contract — validated the same way
// for the single "outfit" field and for each entry of "outfits".
// Returns null when the entry is malformed (no valid scores).
function parseOneOutfit(raw) {
  if (!raw || typeof raw !== "object") return null;
  const scores = parseScores(raw.scores);
  if (!scores) return null;
  return {
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
    outfit = parseOneOutfit(raw);
    if (!outfit) throw codedError("AI_BAD_RESPONSE", "askStylist: outfit missing valid scores");
  }
  // PC-88: a multi-outfit reply — each entry validated the same
  // way; a malformed entry drops instead of failing the reply.
  // "outfit" is the first entry, so single-outfit consumers keep
  // working unchanged.
  let outfits = null;
  if (Array.isArray(obj.outfits)) {
    outfits = obj.outfits.slice(0, 3).map(parseOneOutfit).filter(Boolean);
    if (!outfits.length) outfits = null;
  }
  if (outfits && !outfit) outfit = outfits[0];
  // Sprint 17: optional pin proposal — the model may surface one durable
  // fact per message. Sanitized; the client confirms before saving.
  let proposal = sanitizePinProposal(obj.pinProposal, todayStr);
  // PC-52: an attach proposal is a single literal — the model may
  // propose attaching today's pick, nothing else. Anything else
  // the model invents in this field drops here.
  const attachProposal = obj.attachProposal === "todayPick" ? "todayPick" : null;
  // PC-66: an add-to-wardrobe proposal is likewise a single
  // literal — the model may propose adding the pictured items,
  // nothing else. The gate in askStylist decides whether it
  // survives (the turn must have carried reference photos).
  const addProposal = obj.addProposal === "photoItems" ? "photoItems" : null;
  // PC-68: a worn proposal is likewise a single literal — the
  // model may propose logging the discussed outfit as worn.
  // The gate in askStylist decides whether it survives (an
  // outfit must actually be under discussion).
  const wornProposal = obj.wornProposal === "worn" ? "worn" : null;
  // PC-33: a trip proposal — a destination plus real future
  // timing, sanitized hard (a steering card with a wrong date is
  // worse than none). Suppression lives here too: when a reply
  // carries a trip proposal, a location/weather pin proposal
  // for the same fact drops — the user never sees two competing
  // cards for one fact (proposal §3). Preferences survive.
  const tripProposal = sanitizeTripProposal(obj.tripProposal, todayStr);
  if (tripProposal && proposal && (proposal.kind === "location" || proposal.kind === "weather")) {
    proposal = null;
  }
  return { reply: reply, outfit: outfit, outfits: outfits, pinProposal: proposal, attachProposal: attachProposal, tripProposal: tripProposal, addProposal: addProposal, wornProposal: wornProposal };
}

// PC-33: the trip-proposal sanitizer. Destination and a valid
// future start date are required (the intent threshold is
// destination + timing); an end date survives only when it is
// a valid date on/after the start. Name is optional color.
function sanitizeTripProposal(raw, todayStr) {
  if (!raw || typeof raw !== "object") return null;
  const destination = cleanText(raw.destination, 80);
  if (!destination) return null;
  const dateOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T12:00:00Z"));
  if (!dateOk(raw.startDate) || raw.startDate < todayStr) return null;
  const out = { destination: destination, startDate: raw.startDate };
  if (dateOk(raw.endDate) && raw.endDate >= raw.startDate) out.endDate = raw.endDate;
  const name = cleanText(raw.name, 60);
  if (name) out.name = name;
  return out;
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
      // The doc id rides along so per-conversation mutes
      // (layered remove, 2026-10-24) can name the fact.
      id: typeof p.id === "string" ? cleanText(p.id, 128) : "",
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
// UX-18 W1 (one assembler): the two resolutions every brief depends on,
// factored out so buildStylistRequest and the manifest (below) can never
// disagree about them — the manifest must describe the brief as built.
function resolveIterBase(previousPick, todayPick) {
  const base = previousPick || (todayPick && todayPick.itemIds && todayPick.itemIds.length ? { itemIds: todayPick.itemIds } : null);
  return { base: base, isToday: !previousPick && !!base };
}

function computeActivePins(pins, tripContext, todayStr, mutedIds) {
  let active = (Array.isArray(pins) ? pins : []).filter(
    (p) => p && (!p.validUntil || p.validUntil >= todayStr)
  );
  // Layered remove (founder, 2026-10-24): facts the user
  // removed from THIS conversation are left out of the brief —
  // what the context bar hides, the stylist truly does not
  // use. The facts themselves are untouched in the account.
  if (Array.isArray(mutedIds) && mutedIds.length) {
    active = active.filter((p) => !p.id || mutedIds.indexOf(p.id) < 0);
  }
  // Threads scoping (founder 2026-10-19): inside a trip conversation,
  // global location/weather pins do NOT apply — the trip's own
  // destination and packing weather are the context there. Preference
  // pins and pins scoped to this trip still do.
  if (tripContext) {
    active = active.filter(
      (p) => p.kind === "preference" || p.tripId === tripContext.tripId
    );
  }
  return active;
}

// The manifest: a plain-names list of what the assembler loaded into
// one brief. Returned with every answer; the client renders the
// context line from it (CONTEXT-MODEL.md, W1/W3), and one-shot callers
// keep it with their records. Built from the same resolutions the
// brief itself used — never a second snapshot.
function buildManifest(input, activePins) {
  const items = input.items || [];
  const messages = input.messages || [];
  const iter = resolveIterBase(input.previousPick, input.todayPick);
  const prefs = Array.isArray(input.styleProfile) ? input.styleProfile.filter(Boolean) : [];
  const vp = input.vibeProfile;
  const tasteApplied = !input.vibe && !!(vp && vp.confidence >= 0.3 && vp.tags);
  return {
    wardrobe: items.length,
    messagesRead: Math.min(messages.length, MAX_MESSAGES),
    messagesTotal: messages.length,
    styleNotes: prefs.length,
    weather: input.weatherContext || null,
    todayPick: input.todayPick && input.todayPick.itemIds && input.todayPick.itemIds.length
      ? { attached: true, lookName: input.todayPick.lookName || null }
      : { attached: false, lookName: null },
    shopItem: input.shopItem
      ? { attached: true, name: input.shopItem.name }
      : { attached: false, name: null },
    previousPick: { present: !!iter.base, fromToday: iter.isToday },
    rejectedOutfits: input.rejectedOutfits && Array.isArray(input.rejectedOutfits) ? input.rejectedOutfits.length : 0,
    references: {
      articles: input.references && Array.isArray(input.references.articles) ? input.references.articles.length : 0,
      outfits: input.references && Array.isArray(input.references.outfits) ? input.references.outfits.length : 0,
    },
    styleWord: input.vibe || null,
    learnedTaste: {
      applied: tasteApplied,
      top: tasteApplied
        ? Object.keys(vp.tags).map((t) => ({ tag: t, score: vp.tags[t] }))
            .sort((a, b) => b.score - a.score).slice(0, 3).map((e) => e.tag)
        : [],
    },
    pins: (activePins || []).map((p) => ({ kind: p.kind, label: p.label })),
    trip: input.tripContext ? { name: input.tripContext.tripName || "Trip" } : null,
  };
}

// THE assembler (UX-18 W1): the single place a brief is built, for
// every caller of the stylist. Input is the sanitized context object;
// output is the model request plus the manifest of what went into it.
function assembleContext(input) {
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(input.today || "")
    ? input.today
    : new Date().toISOString().slice(0, 10);
  const req = buildStylistRequest(
    input.items, input.messages, input.styleProfile, input.previousPick,
    input.references, input.weatherContext, input.vibe, input.vibeProfile,
    input.tripContext, input.pins, todayStr, input.todayPick, input.shopItem,
    input.mutedPinIds, input.attachCtx, input.steerCtx, input.refImages,
    input.photoVerdicts, input.demoWardrobe, input.rejectedOutfits, input.todayHistory
  );
  const manifest = buildManifest(input, computeActivePins(input.pins, input.tripContext, todayStr, input.mutedPinIds));
  return { model: req.model, contents: req.contents, config: req.config, manifest: manifest };
}

function buildStylistRequest(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins, today, todayPick, shopItem, mutedPinIds, attachCtx, steerCtx, refImages, photoVerdicts, demoWardrobe, rejectedOutfits, todayHistory) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const wardrobe = items.map((it, i) => itemLine(it, i)).join("\n");
  let system = SYSTEM + "\n\n" + PRECEDENCE;
  const prefs = Array.isArray(styleProfile) ? styleProfile.filter(Boolean) : [];
  if (prefs.length) {
    system += "\n\nSTYLE PROFILE — the user's confirmed preferences. Honor them when recommending:\n" +
      prefs.map((p) => "- " + p).join("\n");
  }
  // UX-14a: demo wardrobe — the pieces below are samples, not the
  // user's own. Partial wardrobe — under 10 real pieces: say so
  // honestly, never pretend pieces exist that don't.
  if (demoWardrobe) {
    system += "\n\nDEMO WARDROBE — the pieces in the WARDROBE list below are SAMPLES, not the user's own clothes. The user is trying the app before adding anything. Build outfits only from these samples. Never claim they own any of them; if asked, say plainly these are demo pieces and offer to help them add their own.";
  } else if (items.length < 10) {
    system += "\n\nPARTIAL WARDROBE — the user has only " + items.length + " piece" + (items.length === 1 ? "" : "s") + " in so far. Work with what's here and say so honestly (\"with more of your wardrobe I can do more\"); never pretend pieces exist that don't.";
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
  const iterRes = resolveIterBase(previousPick, todayPick);
  const iterBase = iterRes.base;
  const iterBaseIsToday = iterRes.isToday;
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
        "- \"something warmer/cooler/more formal/dressier/…\" → adjust the pick in that direction, keeping what still works. A direction change keeps AT LEAST HALF of the previous pick's pieces — count them: with 4 pieces, at least 2 stay. Change only the slots that must change for the direction, and never swap a piece that already fits the direction.\n" +
        "- Describe the previous pick only from the handles above — never name a piece it does not contain.\n" +
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
  // Shop attach: an item the user is deciding whether to buy,
  // attached to this conversation on purpose. It is NOT owned and
  // NOT in the wardrobe list — outfits keep using wardrobe handles
  // only; this section is for judgement (fit with owned pieces,
  // duplication, whether the earlier verdict holds up).
  if (shopItem) {
    let shop = "\n\nITEM UNDER CONSIDERATION — the user ran a shop check on this piece and attached it to ask follow-ups. They do NOT own it.\n" +
      "- Item: " + shopItem.name + (shopItem.category ? " (" + shopItem.category + ")" : "") +
      (shopItem.colors && shopItem.colors.length ? ", colors: " + shopItem.colors.join(", ") : "") + ".\n";
    if (shopItem.note) shop += "- Seen as: " + shopItem.note + "\n";
    if (shopItem.score != null) {
      shop += "- The shop check scored it " + shopItem.score + "/10 for wardrobe fit" +
        (shopItem.verdict ? ": " + shopItem.verdict : "") + "\n";
    }
    if (shopItem.reasons && shopItem.reasons.length) {
      shop += "- Why that score: " + shopItem.reasons.join("; ") + "\n";
    }
    shop += "- Answer questions about THIS item: what it pairs with (name wardrobe pieces by their handles), whether it duplicates something owned, whether it earns its place. If you suggest an outfit to show how it would be worn, build the outfit from wardrobe pieces and describe the shop item's role in prose — never put the shop item in the outfit's items.";
    system += shop;
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
  // PC-71: outfits the user rejected ("Not for me") — a quiet
  // signal, like the vibe profile. Never mention or apologize
  // about it; just do not suggest these outfits again, and avoid
  // what they disliked about them.
  if (rejectedOutfits && rejectedOutfits.length) {
    const lines = rejectedOutfits.map((r) => {
      const handles = r.itemIds.map((id) => {
        const idx = items.findIndex((it) => it && it.id === id);
        if (idx === -1) return null;
        return "[i" + (idx + 1) + '] "' + cleanText(items[idx].name, 60) + '"';
      }).filter(Boolean);
      if (!handles.length) return null;
      const why = {
        "too-plain": "too plain",
        "wrong-vibe": "the wrong vibe",
        "not-that-piece": "one piece in it was wrong",
        "wrong-weather": "wrong for the weather",
      }[r.reason] || "not right";
      return handles.join(", ") + " — rejected as " + why;
    }).filter(Boolean);
    if (lines.length) {
      system += "\n\nREJECTED OUTFITS — the user said \"not for me\" to these; do not suggest them again.\n" +
        lines.map((l) => "- " + l + ".").join("\n") + "\n" +
        "- Avoid the combination, and avoid what they disliked about it (too plain → livelier; wrong vibe → a different vibe; one piece wrong → change that slot; wrong for the weather → weigh the weather harder).\n" +
        "- Never mention the rejection, apologize for it, or explain it. Just pick better.";
    }
  }
  // #139: recent history — what the user already wore or was
  // already shown this week. Worn outranks suggested. An entry
  // with no surviving top or bottom is skipped: it cannot be
  // named, and the model cannot return it.
  if (todayHistory && ((todayHistory.worn && todayHistory.worn.length) || (todayHistory.suggested && todayHistory.suggested.length))) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortDate = (ds) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ds || "");
      return m ? months[Number(m[2]) - 1] + " " + Number(m[3]) : null;
    };
    const histLines = [];
    (todayHistory.worn || []).forEach((e) => {
      const bk = e.baseKey || baseOutfitKey(e.ids, items);
      if (!bk) return;
      const handles = (e.ids || []).map((id) => {
        const idx = items.findIndex((it) => it && it.id === id);
        return idx === -1 ? null : "[i" + (idx + 1) + '] "' + cleanText(items[idx].name, 60) + '"';
      }).filter(Boolean);
      if (handles.length) histLines.push("- Worn recently: " + handles.join(" + ") + ".");
    });
    (todayHistory.suggested || []).forEach((e) => {
      const bk = e.baseKey || baseOutfitKey(e.ids, items);
      if (!bk) return;
      const handles = (e.ids || []).map((id) => {
        const idx = items.findIndex((it) => it && it.id === id);
        return idx === -1 ? null : "[i" + (idx + 1) + '] "' + cleanText(items[idx].name, 60) + '"';
      }).filter(Boolean);
      if (handles.length) histLines.push("- Already suggested" + (shortDate(e.date) ? " (" + shortDate(e.date) + ")" : " this week") + ": " + handles.join(" + ") + ".");
    });
    if (histLines.length) {
      system += "\n\nRECENT HISTORY — outfits from the last 7 days. Do not repeat them when another suitable combination exists.\n" +
        histLines.join("\n") + "\n" +
        "- A repeat is the same top + bottom pair, even with different shoes or accessories — changing only the shoes or accessories is not a new outfit. Reusing individual pieces in a different combination is fine.\n" +
        "- A new name, tagline, or item order does not make an outfit different.";
    }
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
  const activePins = computeActivePins(pins, tripContext, todayStr, mutedPinIds);
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
      "- Never propose on your own initiative — only when the user states the fact or its end. Propose, never append.\n" +
      "- TENSE RULE (PC-33): location and weather pins are PRESENT-TENSE ONLY — propose one only for where " +
      "the user IS now or weather they are in now (\"I'm in Tahoe until Sunday\", \"it's snowing here\"). Never " +
      "for a place they will travel to later, however clean its end date looks: a saved pin takes effect " +
      "immediately and would outrank their real weather at home. Future trips belong in a trip proposal " +
      "(below), not a pin. Preference proposals are unaffected — lasting facts stay proposable.";
  }
  // PC-52: attach proposals. Attach is an act (UX-18 decision 1) —
  // the stylist may PROPOSE the act when the conversation has
  // turned on the unattached pick, exactly as facts are proposed.
  // The brief section exists only when a pick is available and
  // unattached and no proposal was dismissed in this conversation;
  // the server also drops the field otherwise (askStylist gates).
  if (!tripContext && attachCtx && attachCtx.available && !attachCtx.dismissed && !todayPick) {
    system += "\n\nATTACH PROPOSAL — today's pick exists but is NOT attached to this conversation, so you cannot see or change it. " +
      "If the user's words clearly turn on that pick (\"make it warmer\", \"why did you pick this?\", \"swap the shoes on it\"), " +
      "you may return \"attachProposal\": \"todayPick\" in the JSON alongside reply/outfit. The user gets an Attach card; " +
      "nothing attaches unless they tap it. Do not claim to see the pick, and do not propose when the conversation is about anything else.";
  }
  // PC-68: logging a wear is an act, proposed like the others.
  if (!tripContext) {
    system += "\n\nWORN PROPOSAL — if the user's latest message says they wore (or are wearing) the outfit " +
      "under discussion — the one you proposed in this conversation, the attached today's pick, or the one " +
      "you have been iterating on together — return \"wornProposal\": \"worn\" in the JSON alongside " +
      "reply/outfit. The user gets a one-tap card to log it as worn today; never claim it is logged until " +
      "they tap. Only when a specific outfit is clearly the one worn — not for a vague \"I wore jeans " +
      "today\" with no outfit in play.";
  }
  // PC-33: trip steering. Pins are the present-tense layer;
  // trips own the future. When a message carries a future trip,
  // the durable offer is a trip object, not a pin.
  if (!tripContext && !(steerCtx && steerCtx.dismissed)) {
    system += "\n\nTRIP PROPOSAL — if the user's words carry a FUTURE trip (a destination plus future timing: " +
      "\"next week\", explicit dates, \"my trip to …\"), you may return \"tripProposal\" in the JSON alongside reply/outfit:\n" +
      "{ \"destination\": \"<place>\", \"startDate\": \"<YYYY-MM-DD>\", \"endDate\": \"<YYYY-MM-DD, omit if same or unknown>\", " +
      "\"name\": \"<short trip name, optional>\" }.\n" +
      "Compute real dates from what the user said and today's date. The user gets a card offering to create the trip; " +
      "answer their question fully either way — the card never replaces advice, and creating the trip is their tap, " +
      "never your act. Vague travel talk with no timing earns no proposal.";
  }
  // PC-38: reference photos ride with the latest user message
  // as vision context for this turn. They are inspiration, not
  // inventory — the brief says so in as many words, because a
  // model that can't tell an inspo photo from an owned piece
  // will happily dress the user in clothes they don't have.
  const hasRefImages = !tripContext && Array.isArray(refImages) && refImages.length > 0;
  if (hasRefImages) {
    system += "\n\nREFERENCE PHOTOS — the user attached " + refImages.length +
      " photo(s) to their latest message (they travel with it below). These are INSPIRATION: " +
      "looks the user is aiming for. They are NOT in the wardrobe — never put them in an outfit, " +
      "never treat them as owned, never suggest wearing them. Name what you actually see in them " +
      "(the pieces, colors, silhouette, mood), then answer by building only from the wardrobe above. " +
      "If the user asks whether a pictured piece is in their wardrobe, do not guess and do not simply " +
      "take their guess as fact — the app checks the photo against the wardrobe and a PHOTO CHECK " +
      "section appears below when the result is in; until then, say you are checking.";
    // PC-66: when the user asks for the pictured pieces to BECOME
    // wardrobe, the app can do it — through a confirm card, never
    // silently. The proposal field is the stylist's only role.
    system += "\n\nADD-TO-WARDROBE PROPOSAL — if the user's latest message asks to add, log, or save " +
      "the pictured clothing to their wardrobe (\"add it to the wardrobe\", \"log these jeans\"), return " +
      "\"addProposal\": \"photoItems\" in the JSON alongside reply/outfit. The user gets a card listing the " +
      "pieces found in the photo; nothing is added unless they confirm on that card. In your reply, point " +
      "them at the card below — never claim the pieces are already added. If they also asked for an outfit " +
      "built with a new piece, tell them you'll build it the moment it's added (the app will ask you again " +
      "right after) and answer the rest of their message from what they already own.";
  }
  // PC-67: photo-check verdicts — computed by the client's
  // garment matcher from a photo sent earlier in this thread.
  // They ground every logged/unlogged claim the stylist makes.
  if (!tripContext && Array.isArray(photoVerdicts) && photoVerdicts.length) {
    const lines = photoVerdicts.map((v) => {
      if (v.status === "matched") return "- \"" + v.label + "\": MATCHED — it is their logged \"" + v.matchedName + "\".";
      if (v.status === "ambiguous") return "- \"" + v.label + "\": POSSIBLE match with \"" + v.matchedName + "\"" +
        (v.altName ? " or \"" + v.altName + "\"" : "") + " — unconfirmed.";
      return "- \"" + v.label + "\": NO MATCH — not in the wardrobe.";
    });
    system += "\n\nPHOTO CHECK — the app matched the pieces in the photo the user sent against the wardrobe:\n" +
      lines.join("\n") +
      "\nGround every claim about what is or is not in the wardrobe in this list. A MATCHED piece IS logged — " +
      "name it as theirs. NO MATCH means the piece is not in the wardrobe — say so plainly; if they want it " +
      "in, the add flow can add it. For a POSSIBLE match, ask the user to confirm — never assume either way, " +
      "and never describe a lookalike substitute as the pictured piece itself.";
  }
  for (const m of messages) {
    contents.push({ role: m.role, parts: [{ text: m.text }] });
  }
  if (hasRefImages) {
    for (let i = contents.length - 1; i >= 0; i--) {
      if (contents[i].role === "user") {
        for (const img of refImages) {
          contents[i].parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
        break;
      }
    }
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
  // PC-88: a multi-outfit reply is ~3x the JSON of a single pick,
  // and the thinking budget draws from the same pool — a 2500 cap
  // truncated every three-outfit ask mid-object (AI_BAD_RESPONSE,
  // refs req_6f7c/req_72b4/req_4f06). The cap is a ceiling, not a
  // charge, so it rises only on turns that ask for more than one.
  var lastUserText = "";
  for (var mi = messages.length - 1; mi >= 0; mi--) {
    if (messages[mi] && messages[mi].role === "user") { lastUserText = String(messages[mi].text || messages[mi].content || ""); break; }
  }
  var wantsMultipleOutfits = /\b(three|3|a few|several|multiple|couple(?: of)?|some|different)\b[^.]{0,60}\b(outfits?|looks?|options|ideas)\b/i.test(lastUserText) ||
    /\b(outfits?|looks?|options|ideas)\b[^.]{0,60}\b(three|3|a few|several|multiple)\b/i.test(lastUserText);
  const config = {
    systemInstruction: system,
    temperature: 0.3,
    // Trip mode rewrites the whole packing plan per call — the biggest
    // output in the app; 2500 truncated tool calls (2026-10-19), and
    // 4000 still crowded a full re-plan over a 69-piece wardrobe
    // (2026-10-21) — the thinking budget draws from the same pool.
    maxOutputTokens: tripContext ? 7000 : (wantsMultipleOutfits ? 6000 : 2500),
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

// OBS-2: one funnel for the stylist's non-failure events —
// rejections, self-heals, degradations. Structured log always;
// the error_events sink when the caller wired hooks.onEvent.
function emitEvent(hooks, kind, name, fields) {
  try {
    logEvent(name, Object.assign({ kind: kind }, fields || {}));
    if (hooks && typeof hooks.onEvent === "function") hooks.onEvent(kind, name, fields || {});
  } catch (e) { /* events must never break the request */ }
}

function logTripArgsRejected(stage, args, hooks) {
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
  emitEvent(hooks, "rejection", "trip_tool_args_rejected", { stage: stage });
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
// PC-88: one parsed outfit + its mapped wardrobe ids → the
// result shape the client renders. Shared by the single-outfit
// return and the multi-outfit return below.
function toOutfitResult(raw, mapped) {
  return {
    itemIds: mapped.map((m) => m.id),
    itemNames: mapped.map((m) => m.name),
    confidence: confidenceFromScores(raw.scores),
    reasoning: raw.reasoning,
    lookName: raw.lookName || null,
    tagline: raw.tagline || null,
    styleNote: raw.styleNote || null,
    scores: raw.scores,
  };
}

async function askStylist(items, messages, styleProfile, previousPick, references, weatherContext, vibe, vibeProfile, tripContext, pins, today, hooks, todayPick, shopItem, mutedPinIds, attachCtx, steerCtx, refImages, photoVerdicts, demoWardrobe, rejectedOutfits, todayHistory) {
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(today || "")
    ? today
    : new Date().toISOString().slice(0, 10);
  // #139: fill the history's base keys against this wardrobe
  // before assembling — the brief and the repair check both
  // read them.
  if (todayHistory) withBaseKeys(todayHistory, items);
  // UX-18 W1: every stylist call goes through the one assembler; the
  // manifest of what was loaded rides back with the answer.
  const assembled = assembleContext({
    items: items, messages: messages, styleProfile: styleProfile,
    previousPick: previousPick, references: references,
    weatherContext: weatherContext, vibe: vibe, vibeProfile: vibeProfile,
    tripContext: tripContext, pins: pins, today: todayStr, todayPick: todayPick,
    shopItem: shopItem, mutedPinIds: mutedPinIds, attachCtx: attachCtx,
    steerCtx: steerCtx, refImages: refImages, photoVerdicts: photoVerdicts,
    demoWardrobe: demoWardrobe, rejectedOutfits: rejectedOutfits, todayHistory: todayHistory,
  });
  const { model, contents, config } = assembled;
  const manifest = assembled.manifest;
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
      emitEvent(hooks, "self_heal", "trip_packing_retry", { stage: "first" });
      // The model tried to update the packing but its args didn't
      // survive mapping — log it (OBS-1) and re-ask once with a hint.
      logTripArgsRejected("first", updCall.args, hooks);
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
          if (!mappedCall) logTripArgsRejected("retry", c.args, hooks);
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
    if (planFailed) emitEvent(hooks, "rejection", "trip_plan_not_applied", {});
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
    return { reply: text, toolCall: mappedCall, pinProposal: pinProposal, outfitSuggestions: outfitSuggestions, manifest: manifest };
  }
  let parsed = await callStylistModel(ai, model, contents, config, "askStylist", todayStr, hooks);

  // Slot validation with ONE repair attempt. The repair shows the model
  // its own answer plus what's wrong with it.
  let mapped = parsed.outfit ? mapHandlesToIds(parsed.outfit, items) : null;
  let problem = parsed.outfit ? validateSlots(mapped || [], items) : null;
  // PC-84: the keep floor is a repair trigger, not a rejection —
  // a short outfit gets one re-ask naming the count, and if the
  // repair still misses the floor (or never runs), the best valid
  // outfit stands rather than going text-only.
  const iterBase = resolveIterBase(previousPick, todayPick).base;
  let lastUserText = "";
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    if (messages[mi] && messages[mi].role === "user") { lastUserText = String(messages[mi].text || messages[mi].content || ""); break; }
  }
  const isMulti = parsed.outfits && parsed.outfits.length > 1;
  const keepProblem = (parsed.outfit && mapped && !isMulti)
    ? iterationKeepProblem(mapped.map((m) => m.id), iterBase && iterBase.itemIds, lastUserText)
    : null;
  // #139: the repeat check — a Today generation that returns a
  // recently worn or suggested base is re-asked once, like the
  // keep floor. If the repair still repeats, the best valid
  // outfit stands (degraded event) rather than going text-only.
  const repeatProblem = (parsed.outfit && mapped && !problem && !isMulti)
    ? todayRepeatProblem(mapped.map((m) => m.id), todayHistory, items)
    : null;
  // PC-88: the repair below is for a single bad outfit only. A
  // multi-outfit reply goes to the multi branch instead, where a
  // bad entry drops rather than re-asking the whole turn.
  if (parsed.outfit && !isMulti && (problem || !mapped || keepProblem || repeatProblem)) {
    emitEvent(hooks, "self_heal", "slot_repair_attempt", { problem: problem || keepProblem || repeatProblem || "handles_unmapped" });
    const repairContents = contents.concat([
      { role: "model", parts: [{ text: JSON.stringify(parsed.outfit) }] },
      { role: "user", parts: [{ text: "That outfit doesn't work: " + (problem || keepProblem || repeatProblem || "the handles didn't match the wardrobe") + ". Choose again using only wardrobe handles, following all rules." }] },
    ]);
    try {
      parsed = await callStylistModel(ai, model, repairContents, config, "askStylist-repair", todayStr, hooks);
      mapped = parsed.outfit ? mapHandlesToIds(parsed.outfit, items) : null;
      problem = parsed.outfit ? validateSlots(mapped || [], items) : null;
      const keepAfter = (parsed.outfit && mapped)
        ? iterationKeepProblem(mapped.map((m) => m.id), iterBase && iterBase.itemIds, lastUserText)
        : null;
      if (keepAfter) emitEvent(hooks, "degraded", "iteration_keep_floor_missed", { problem: keepAfter });
      const repeatAfter = (parsed.outfit && mapped && !problem)
        ? todayRepeatProblem(mapped.map((m) => m.id), todayHistory, items)
        : null;
      if (repeatAfter) emitEvent(hooks, "degraded", "today_repeat_after_repair", { problem: repeatAfter });
    } catch (e) {
      // Repair failed — fall through to text-only below, UNLESS the
      // repair was keep-only: the original outfit is slot-valid,
      // so it stands rather than leaving the user with no card.
      emitEvent(hooks, "degraded", "slot_repair_failed", { key: (e && e.key) || null });
      if (!problem && keepProblem) {
        emitEvent(hooks, "degraded", "iteration_keep_floor_missed", { problem: keepProblem });
      } else {
        problem = problem || "repair failed";
      }
    }
  }

  // PC-52: the attach proposal survives only under the exact
  // conditions its brief section states — general conversation,
  // a pick available, none attached, none dismissed here. The
  // prompt asks; this gate decides (a model that proposes out
  // of turn is dropped, not displayed).
  const attachProposal = (!tripContext && attachCtx && attachCtx.available &&
    !attachCtx.dismissed && !todayPick) ? (parsed.attachProposal || null) : null;
  // PC-33: the trip proposal survives only in general chat and
  // only when steering has not been dismissed in this
  // conversation. (Parse already suppressed any competing
  // location/weather pin proposal.)
  const tripProposal = (!tripContext && !(steerCtx && steerCtx.dismissed))
    ? (parsed.tripProposal || null) : null;
  // PC-66: the add proposal survives only when the turn actually
  // carried reference photos in general chat — the card lists
  // pieces parsed from that photo, so without one it would be a
  // lie. The prompt asks; this gate decides.
  const addProposal = (!tripContext && Array.isArray(refImages) && refImages.length > 0)
    ? (parsed.addProposal || null) : null;
  // PC-68: the worn proposal survives only when an outfit is
  // actually under discussion (a previous pick in the thread or
  // the attached today's pick) — otherwise there is nothing
  // definite to log.
  const wornProposal = (!tripContext && (previousPick || todayPick))
    ? (parsed.wornProposal || null) : null;
  // PC-88: a multi-outfit reply — map + validate each entry; a
  // bad entry drops (with a rejection event) instead of failing
  // the whole reply. "outfit" stays the first, so single-outfit
  // consumers (composer, Today, follow-up sheet) keep working.
  const multiRaw = Array.isArray(parsed.outfits) ? parsed.outfits.slice(0, 3) : [];
  if (multiRaw.length > 1) {
    const multiOutfits = [];
    for (const raw of multiRaw) {
      const m = mapHandlesToIds(raw, items);
      const p = m ? validateSlots(m, items) : "handles_unmapped";
      if (m && !p) multiOutfits.push(toOutfitResult(raw, m));
      else emitEvent(hooks, "rejection", "outfit_discarded", { problem: p });
    }
    if (!multiOutfits.length) {
      return { reply: parsed.reply, outfit: null, outfits: [], pinProposal: parsed.pinProposal || null, attachProposal: attachProposal, tripProposal: tripProposal, addProposal: addProposal, wornProposal: wornProposal, manifest: manifest };
    }
    return { reply: parsed.reply, manifest: manifest, outfit: multiOutfits[0], outfits: multiOutfits, pinProposal: parsed.pinProposal || null, attachProposal: attachProposal, tripProposal: tripProposal, addProposal: addProposal, wornProposal: wornProposal };
  }
  if (!parsed.outfit || !mapped || problem) {
    if (parsed.outfit) emitEvent(hooks, "rejection", "outfit_discarded", { problem: problem || "unmapped" });
    return { reply: parsed.reply, outfit: null, pinProposal: parsed.pinProposal || null, attachProposal: attachProposal, tripProposal: tripProposal, addProposal: addProposal, wornProposal: wornProposal, manifest: manifest };
  }
  return {
    reply: parsed.reply,
    manifest: manifest,
    outfit: toOutfitResult(parsed.outfit, mapped),
    pinProposal: parsed.pinProposal || null,
    attachProposal: attachProposal,
    tripProposal: tripProposal,
    addProposal: addProposal,
    wornProposal: wornProposal,
  };
}

module.exports = { askStylist, buildStylistRequest, assembleContext, buildManifest, resolveIterBase, computeActivePins, PRECEDENCE, MAX_MESSAGES, parseStylistJson, sanitizeItems, sanitizeMessages, sanitizePreviousPick, sanitizeRejectedOutfits, sanitizeTodayPick, sanitizeShopItem, sanitizeReferences, sanitizeStyleProfile, sanitizeVibe, sanitizeVibeProfile, sanitizeWeatherContext, sanitizeTripContext, sanitizePins, sanitizePinProposal, sanitizeTripProposal, sanitizeRefImages, sanitizePhotoVerdicts, extractToolCall, extractToolCalls, mapUpdateTripPacking, mapSuggestTripOutfits, handleIndex, unwrapJsonReply, mapHandlesToIds, validateSlots, parseScores, iterationKeepProblem, canonicalOutfitKey, baseOutfitKey, assembleTodayHistory, withBaseKeys, todayHasAlternative, todayRepeatProblem, lastNDates, sanitizeTodayWindow, loadTodayHistory, confidenceFromScores, describeColors, itemLine, cleanText, RUBRIC_VERSION, SYSTEM, VIBE_TAGS };
