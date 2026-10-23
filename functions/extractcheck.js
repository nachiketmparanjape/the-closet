"use strict";

// PC-34 quality gate, layer 2: the semantic check. The mask
// heuristics (imagenorm.judgeMask) catch catastrophic failures;
// only a vision model can catch "that's a bag strap, not part of
// the garment" — which actually happened in the BiRefNet trial.
//
// The checker sees the normalized original and the cutout
// composited on magenta (a color that appears in neither garments
// nor rooms, so extras, remnants and fringe are unmissable) and
// answers one narrow question as strict JSON. Tuned strict on
// purpose: a good render wrongly rejected costs the status quo
// (the original keeps showing); a bad render wrongly passed is
// the failure the founder said we must not ship.
//
// Never throws for model-side failures: any outage, refusal or
// unparseable reply resolves to { ok: false, checkError: true } —
// the gate fails safe, toward the original photo.

const { GoogleGenAI } = require("@google/genai");
const sharp = require("sharp");

const MODEL_VERSION = "gemini-3.5-flash"; // same pinned model as describe.js

const PROMPT = `You are the quality gate for a wardrobe app's photo cleanup.

Image 1 is the ORIGINAL photo of one garment. Image 2 is an automatic background-removal cutout of that photo, shown on a solid magenta background.

Judge ONLY the cutout. Answer with ONLY a JSON object (no markdown, no prose):
{"ok": true or false, "problems": ["short phrases"]}

ok = true only if ALL of these hold:
- Image 2 shows exactly the main garment from image 1 — the whole garment, nothing missing (no cut-off sleeves, legs, straps or edges).
- Nothing else came along: no other objects, no body parts, no furniture, no background remnants, no magenta showing through holes in the garment.
- The garment's shape, color and details match image 1 (a price tag or label that is ON the garment in image 1 is part of the garment and is fine).

When in doubt, answer ok = false and name the problem. A rejected cutout costs nothing — the app keeps the original photo. A bad cutout that passes is the real failure.`;

// Strict verdict parsing, exported for tests. Anything that is not
// an explicit ok:true is a rejection — ambiguity never passes.
function parseVerdict(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, problems: ["empty verdict"], checkError: true };
  }
  let parsed;
  try {
    parsed = JSON.parse(text.trim());
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch (e2) {
        /* fall through to the error verdict */
      }
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, problems: ["unparseable verdict"], checkError: true };
  }
  const problems = Array.isArray(parsed.problems)
    ? parsed.problems.filter((p) => typeof p === "string").map((p) => p.slice(0, 120)).slice(0, 5)
    : [];
  if (parsed.ok === true) {
    return { ok: true, problems: [] };
  }
  return { ok: false, problems: problems.length ? problems : ["checker said not ok"] };
}

async function compositeOnMagenta(pngBuffer) {
  const meta = await sharp(pngBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1024;
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 255 } },
  })
    .composite([{ input: pngBuffer }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

let client = null;
function getClient() {
  if (client) return client;
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_LOCATION || "global"; // 3.x serves from global only
  client = new GoogleGenAI({ vertexai: true, project, location });
  return client;
}

// Default model caller; injectable via deps.callModel for tests.
// Returns { text, usage } where usage is the Vertex usageMetadata.
async function defaultCallModel(parts) {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || MODEL_VERSION;
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 400,
      thinkingConfig: { thinkingBudget: 512 },
    },
  });
  return { text: response && response.text, usage: (response && response.usageMetadata) || null, model };
}

// checkCutout(original {buffer, mimeType}, cutoutPng, deps)
// deps: { callModel } — defaults to the Vertex caller above.
// Resolves { ok, problems, checkError?, usage, model }.
async function checkCutout(original, cutoutPng, deps) {
  const callModel = (deps && deps.callModel) || defaultCallModel;
  let composite;
  try {
    composite = await compositeOnMagenta(cutoutPng);
  } catch (err) {
    return { ok: false, problems: ["composite failed: " + err.message], checkError: true, usage: null, model: null };
  }
  let out;
  try {
    out = await callModel([
      { text: PROMPT },
      { inlineData: { mimeType: original.mimeType || "image/jpeg", data: original.buffer.toString("base64") } },
      { inlineData: { mimeType: "image/jpeg", data: composite.toString("base64") } },
    ]);
  } catch (err) {
    return { ok: false, problems: ["checker call failed: " + err.message], checkError: true, usage: null, model: null };
  }
  const verdict = parseVerdict(out && out.text);
  verdict.usage = (out && out.usage) || null;
  verdict.model = (out && out.model) || null;
  return verdict;
}

module.exports = { checkCutout, parseVerdict, compositeOnMagenta, PROMPT };
