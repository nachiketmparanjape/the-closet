// shopcheck.js — PC-14: shop compatibility check.
//
// The user photographs a shop item (in store or a screenshot). The model
// describes it, scores its wardrobe fit 0-10, flags near-duplicates among
// owned pieces, and suggests 2-3 outfits from the real wardrobe that the
// item would slot into. The shop item is NEVER catalogued — this is an
// ephemeral check, not an intake flow.
//
// Trust model: the model proposes, the server validates. Item IDs in the
// response are re-validated against the real wardrobe — a hallucinated id
// can never surface. No price/value judgment, no purchase links.

const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getClient, reportUsage, MODEL_VERSION, CATEGORIES } = require("./describe");
const { codedError } = require("./errors");
const { cleanText } = require("./stylist");
const { capShortName } = require("./shortname");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function oneOf(value, allowed, fallback) {
  return allowed.indexOf(value) !== -1 ? value : fallback;
}

function cleanScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

// PC-40: read the trip a check belongs to and shape it for the
// prompt. Any failure (bad id, missing doc) degrades to null —
// a trip ref must never break a check.
async function loadTripContext(db, uid, tripId, items) {
  try {
    if (!tripId || typeof tripId !== "string") return null;
    const snap = await db.collection("users").doc(uid).collection("trips").doc(tripId).get();
    if (!snap.exists) return null;
    const t = snap.data();
    const leg = (t.legs && t.legs[0]) || {};
    const nameById = {};
    (items || []).forEach((it) => { nameById[it.id] = it.name; });
    const packedIds = (t.packing && t.packing.articleIds) || [];
    return {
      id: tripId,
      name: cleanText(t.name, 80) || "the trip",
      location: cleanText(leg.resolvedName || leg.location || "", 80),
      startDate: typeof leg.startDate === "string" ? leg.startDate : null,
      endDate: typeof leg.endDate === "string" ? leg.endDate : null,
      weather: cleanText(t.weatherSnapshot || (t.packing && t.packing.weatherSnapshot) || "", 200),
      notes: cleanText(t.notes || "", 200),
      packedNames: packedIds.map((id) => nameById[id]).filter(Boolean).slice(0, 40),
    };
  } catch (e) {
    return null;
  }
}

// Pure: build the exact model request. Exported for tests.
// PC-40: `context` ({trip, question}) is optional — without it
// the prompt is exactly the original wardrobe-only check.
function buildShopCheckRequest(imageBase64, mimeType, items, context) {
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const wardrobe = items
    .map((it, i) => {
      const colors = Array.isArray(it.colors)
        ? it.colors.map((c) => (c && c.name ? c.name : c)).filter(Boolean).join("/")
        : "";
      return (
        "[i" + (i + 1) + '] id="' + it.id + '" "' + cleanText(it.name, 60) + '" [' +
        cleanText(it.category, 20) + "]" + (colors ? " colors: " + colors : "")
      );
    })
    .join("\n");
  const prompt =
    "This photo shows a garment for sale (in a store or a screenshot). " +
    "Describe it, then judge how well it fits the wearer's wardrobe below.\n\n" +
    "If the photo does NOT show a garment (or no garment is clearly visible), " +
    'respond with JSON only: {"notClothing": true}.\n\n' +
    "Otherwise, be honest but kind — like a friend who will tell the truth " +
    "about a purchase. Score 0-10 on whether this item EARNS a place: does it " +
    "fill a gap, or duplicate what they own? Will it actually get worn with " +
    "their things? Never comment on price, value for money, where to buy it, " +
    "or availability — judge fit with THIS wardrobe only.\n\n" +
    "WARDROBE:\n" + wardrobe + "\n\n" +
    ((context && context.trip)
      ? "TRIP CONTEXT: the wearer is considering this item FOR a trip — \"" + context.trip.name + "\"" +
        (context.trip.location ? " (" + context.trip.location + ")" : "") +
        (context.trip.startDate ? ", " + context.trip.startDate + " to " + (context.trip.endDate || context.trip.startDate) : "") + ". " +
        (context.trip.weather ? "Expected weather: " + context.trip.weather + ". " : "") +
        (context.trip.notes ? "Trip notes: " + context.trip.notes + ". " : "") +
        (context.trip.packedNames && context.trip.packedNames.length
          ? "Already packed for this trip: " + context.trip.packedNames.join(", ") + ". "
          : "Nothing is packed for this trip yet. ") +
        "Judge how well it serves THIS trip: does it fit the weather, fill a packing gap or duplicate a packed piece, " +
        "and combine with the packed pieces? Weigh that alongside the general wardrobe fit, and name the trip in the verdict when it drives the call.\n\n"
      : "") +
    ((context && context.question)
      ? "THE WEARER'S QUESTION: \"" + context.question + "\" — answer it directly in the verdict or reasons.\n\n"
      : "") +
    'Respond with JSON only: {"item": {"name": "short 2-4 word product name", "category": one of ' + JSON.stringify(CATEGORIES) + ', "colors": ["..."], ' +
    '"pattern": "...", "formality": 0.0-1.0, "note": "one-line description"}, ' +
    '"score": 0-10, "verdict": "one honest sentence", ' +
    '"reasons": ["...", "..."], ' +
    '"similarOwned": [{"itemId": "...", "note": "why it is similar"}], ' +
    '"outfits": [{"pieces": ["<owned item id>", "..."], "note": "why this works"}]}.\n' +
    "Rules: similarOwned lists ONLY owned items genuinely close to this one " +
    "(empty array if none — do not force it). outfits: 2-3 outfits, each 2+ " +
    "owned piece ids from the wardrobe list above plus the new item implied; " +
    "use only real ids from the list. If the wardrobe is too small for real " +
    "outfits, return an empty outfits array rather than inventing.";
  const contents = [
    {
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
      ],
    },
  ];
  const config = {
    temperature: 0.3,
    maxOutputTokens: 1600,
    thinkingConfig: { thinkingBudget: 512 },
    responseMimeType: "application/json",
  };
  return { model, contents, config };
}

// Pure: parse + validate the model's reply against the real item ids.
// Exported for tests.
function parseShopCheckJson(text, validIds) {
  let obj = null;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { obj = JSON.parse(match[0]); } catch (e) { obj = null; }
    }
  }
  if (!obj || typeof obj !== "object") {
    throw codedError("AI_BAD_RESPONSE", "shopCheck: model returned non-JSON");
  }
  if (obj.notClothing === true) {
    return { notClothing: true };
  }
  const valid = new Set(validIds);
  const item = obj.item && typeof obj.item === "object" ? obj.item : {};
  const similarOwned = [];
  const seenSimilar = new Set();
  if (Array.isArray(obj.similarOwned)) {
    for (const s of obj.similarOwned) {
      const id = s && typeof s.itemId === "string" ? s.itemId : null;
      if (!id || !valid.has(id) || seenSimilar.has(id)) continue; // hallucinated or dup: drop
      seenSimilar.add(id);
      similarOwned.push({ itemId: id, note: cleanText(s.note, 160) });
    }
  }
  const outfits = [];
  if (Array.isArray(obj.outfits)) {
    for (const o of obj.outfits) {
      if (!o || !Array.isArray(o.pieces)) continue;
      const pieces = [];
      const seenPieces = new Set();
      for (const p of o.pieces) {
        if (typeof p !== "string" || !valid.has(p) || seenPieces.has(p)) continue;
        seenPieces.add(p);
        pieces.push(p);
      }
      if (pieces.length < 2) continue; // an outfit needs at least 2 owned pieces
      outfits.push({ pieces: pieces, note: cleanText(o.note, 200) });
    }
    outfits.splice(3); // cap at 3
  }
  return {
    notClothing: false,
    item: {
      name: cleanText(item.name, 60),
      // NAMING-1: the prompt already asks for a 2–4 word name, but
      // the cap is enforced here so a prose-y reply can never
      // reach a card again (the client prefers shortName).
      shortName: capShortName(item.name),
      category: oneOf(item.category, CATEGORIES, "Other"),
      colors: Array.isArray(item.colors)
        ? item.colors.filter((c) => typeof c === "string").map((c) => cleanText(c, 30)).filter(Boolean).slice(0, 5)
        : [],
      pattern: cleanText(item.pattern, 40),
      note: cleanText(item.note, 200),
    },
    score: cleanScore(obj.score),
    verdict: cleanText(obj.verdict, 200),
    reasons: Array.isArray(obj.reasons)
      ? obj.reasons.filter((r) => typeof r === "string").map((r) => cleanText(r, 200)).filter(Boolean).slice(0, 4)
      : [],
    similarOwned: similarOwned,
    outfits: outfits,
  };
}

// Handler: (uid, storagePath, db?, hooks?, ctx?) -> result.
// db injectable for tests; Storage always real (photo bytes needed).
// PC-40: ctx = { tripId, question } — the server reads the trip
// itself; the client only names it.
async function shopCheck(uid, storagePath, db, hooks, ctx) {
  if (typeof storagePath !== "string" || !storagePath.startsWith("users/" + uid + "/shop-checks/")) {
    throw codedError("NOT_YOUR_PHOTO", "shopCheck: bad storage path");
  }
  db = db || getFirestore();
  const file = getStorage().bucket().file(storagePath);
  const [metadata] = await file.getMetadata().catch(() => [null]);
  if (!metadata) {
    throw codedError("BAD_IMAGE", "shopCheck: photo not found");
  }
  if (Number(metadata.size || 0) > MAX_IMAGE_BYTES) {
    throw codedError("IMAGE_TOO_LARGE", "shopCheck: photo too large");
  }
  const [buffer] = await file.download();

  const itemSnaps = await db.collection("users").doc(uid).collection("items").limit(500).get();
  const items = itemSnaps.docs.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }));
  if (!items.length) {
    throw codedError("EMPTY_WARDROBE", "shopCheck: no items to compare against");
  }

  const trip = ctx && ctx.tripId ? await loadTripContext(db, uid, ctx.tripId, items) : null;
  const question = ctx && ctx.question ? cleanText(ctx.question, 200) : "";
  const { model, contents, config } = buildShopCheckRequest(
    buffer.toString("base64"), metadata.contentType || "image/jpeg", items,
    { trip: trip, question: question }
  );
  const callStart = Date.now();
  let text;
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({ model, contents, config });
    reportUsage(hooks, response, model, callStart);
    text = (response.text || "").trim();
  } catch (err) {
    throw codedError("AI_UNAVAILABLE", "shopCheck: generateContent failed: " + (err && err.message));
  }
  if (!text) {
    throw codedError("AI_BAD_RESPONSE", "shopCheck: model returned no text");
  }
  const result = parseShopCheckJson(text, items.map((it) => it.id));
  // PC-40: echo what context actually drove the judgment, so the
  // client stamps the saved check with the server's truth.
  if (trip || question) {
    result.context = {
      tripId: trip ? trip.id : null,
      tripName: trip ? trip.name : null,
      question: question || null,
    };
  }
  return result;
}

module.exports = { shopCheck, buildShopCheckRequest, parseShopCheckJson, loadTripContext };
