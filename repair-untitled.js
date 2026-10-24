"use strict";
// One-off repair (2026-10-24): 8 wardrobe items were saved with
// the literal name "Untitled item" and no ai block — their
// describe step failed during a bulk add and nothing retried.
// This re-runs the SAME describe prompt (functions/describe.js)
// against each item's stored photo via the Vertex REST endpoint
// and PATCHes the v2 fields, mirroring buildV2Fields in the
// client. Usage: node repair-untitled.js [--apply]
const fs = require("fs");
const path = require("path");
const { PALETTE, PALETTE_NAMES, canonicalName, brandKey } = require("./functions/palette");
const { capShortName } = require("./functions/shortname");

const APPLY = process.argv.includes("--apply");
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
const PROJECT = "closet-404e9";
const MODEL = "gemini-3.5-flash";
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Other"];
const PATTERNS = ["solid", "striped", "plaid", "check", "floral", "graphic", "other"];
const FITS = ["slim", "regular", "relaxed", "oversized", "unknown"];
const FORMALITIES = ["casual", "smart-casual", "formal"];
const WARMTHS = ["light", "medium", "heavy"];
const STYLE_TAGS = ["classic", "minimalist", "preppy", "streetwear", "vintage", "bohemian", "edgy", "romantic", "sporty", "rugged", "refined", "avant-garde"];

const PROMPT = `You are cataloguing one garment from its photo for a personal wardrobe app.
Look at the photo and answer with ONLY a JSON object (no markdown, no prose) with exactly these keys:

{
  "name": "short, specific name a person would use, e.g. 'Navy striped crew-neck tee' (max 6 words)",
  "short_name": "the card label: a noun phrase of AT MOST 5 words — no commas, no clauses, no 'with/featuring' tails — e.g. 'Navy linen overshirt', 'White bear graphic tee'",
  "description": "one plain sentence describing the garment for outfit planning (style, cut, notable details)",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "colors": ["1 to 3 dominant colors of the GARMENT itself (ignore background) — pick ONLY from this list: ${PALETTE_NAMES.join(", ")}"],
  "pattern": one of ${JSON.stringify(PATTERNS)},
  "fit": one of ${JSON.stringify(FITS)} (use 'unknown' if the photo can't tell),
  "fabric_guess": "best guess at the fabric in 1-3 words, or 'unknown' — this is a guess, be honest",
  "formality": one of ${JSON.stringify(FORMALITIES)},
  "warmth": one of ${JSON.stringify(WARMTHS)},
  "brand": "the PARENT brand in 1-3 words — strip sub-lines and collections ('Uniqlo UT' → 'Uniqlo', 'Nike SB' → 'Nike', 'H&M Conscious' → 'H&M'), or null if none is visible — best effort, never guess",
  "subtype": "the specific garment type in 1-3 words ('oxford shirt', 'crewneck tee', 'straight-leg jeans', 'chelsea boots') — null if unclear. An oversized graphic tee and an oxford shirt are both 'Tops' but play totally different roles; be specific",
  "style_tags": ["0 to 3 tags from this list ONLY: ${STYLE_TAGS.join(", ")} — the garment's style lane(s); empty array if none fit clearly"]
}

Describe ONLY what is visible in THIS photo. If it shows the back of the garment, say so in the description and do not assume the front matches. Never invent details for the unseen side.

If the photo shows no garment, return every field as its safest value
(category "Other", fit "unknown", fabric_guess "unknown", pattern "other",
formality "casual", warmth "light", colors [], brand null, subtype null,
style_tags [], name
"Unidentified item",
description "No garment could be identified in the photo.").`;

function token() {
  const src = fs.readFileSync(path.join(__dirname, "deploy-firestore-rules.js"), "utf8");
  const g = (n) => { const m = src.match(new RegExp(n + '\\s*=\\s*"([^"]+)"')); return m && m[1]; };
  const rt = fs.readFileSync(process.env.HOME + "/.config/firebase-ci-token", "utf8").trim();
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: g("CLIENT_ID"), client_secret: g("CLIENT_SECRET"), refresh_token: rt, grant_type: "refresh_token" }),
  }).then((r) => r.json()).then((j) => j.access_token);
}

const enc = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === "object") { const f = {}; for (const k in v) f[k] = enc(v[k]); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
};
const dec = (v) => {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(dec);
  if (v.mapValue) { const o = {}; for (const k in v.mapValue.fields || {}) o[k] = dec(v.mapValue.fields[k]); return o; }
  return null;
};

async function describe(tok, imageUrl) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("photo fetch " + imgRes.status);
  const mime = imgRes.headers.get("content-type") || "image/jpeg";
  const b64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
  const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType: mime.split(";")[0], data: b64 } }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2, thinkingConfig: { thinkingBudget: 512 } },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error("vertex " + res.status + " " + JSON.stringify(j).slice(0, 200));
  const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || "").join("") || "";
  return JSON.parse(text);
}

(async () => {
  const tok = await token();
  const H = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${UID}/items`;
  const list = await (await fetch(base + "?pageSize=100", { headers: H })).json();
  const items = (list.documents || []).map((d) => {
    const o = { id: d.name.split("/").pop() };
    for (const k in d.fields || {}) o[k] = dec(d.fields[k]);
    return o;
  });
  const targets = items.filter((i) => i.name === "Untitled item");
  console.log("targets:", targets.length, APPLY ? "(APPLYING)" : "(dry run)");
  for (const it of targets) {
    const url = it.imageUrl || (it.photos && it.photos[0] && it.photos[0].url);
    if (!url) { console.log(it.id, "NO PHOTO — skipped"); continue; }
    const ai = await describe(tok, url);
    if (!ai || !ai.name || ai.name === "Unidentified item") { console.log(it.id, "model could not identify — left as-is"); continue; }
    ai.brandKey = brandKey(ai.brand || null);
    ai.analyzedAt = new Date().toISOString();
    ai.modelVersion = MODEL;
    ai.photoIds = [];
    const dominantHex = (it.colors && it.colors[0] && it.colors[0].hex) || "#5c6673";
    const colors = (ai.colors || []).slice(0, 3).map((name, i) => {
      const p = PALETTE.find((e) => e.name === name) || {};
      return { name, hex: i === 0 ? dominantHex : (p.hex || dominantHex), source: "ai", primary: i === 0, family: p.family || canonicalName(name) || name };
    });
    const update = {
      name: ai.name,
      shortName: capShortName(ai.short_name || ai.name),
      category: CATEGORIES.includes(ai.category) ? ai.category : "Other",
      colors,
      description: ai.description || "",
      pattern: PATTERNS.includes(ai.pattern) ? ai.pattern : "other",
      fit: FITS.includes(ai.fit) ? ai.fit : "unknown",
      fabricGuess: ai.fabric_guess || "unknown",
      formality: FORMALITIES.includes(ai.formality) ? ai.formality : "casual",
      warmth: WARMTHS.includes(ai.warmth) ? ai.warmth : "light",
      brand: ai.brand || null,
      brandKey: ai.brandKey,
      subtype: ai.subtype || null,
      styleTags: (ai.style_tags || []).filter((t) => STYLE_TAGS.includes(t)).slice(0, 3),
      ai,
    };
    console.log(it.id, "→", JSON.stringify({ name: update.name, category: update.category, colors: (ai.colors || []).join("/") }));
    if (APPLY) {
      const mask = Object.keys(update).map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&");
      const fields = {}; for (const k in update) fields[k] = enc(update[k]);
      const r = await fetch(`${base}/${it.id}?${mask}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields }) });
      if (!r.ok) console.log("  PATCH FAILED", r.status, (await r.text()).slice(0, 160));
      else console.log("  patched ✓");
    }
  }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
