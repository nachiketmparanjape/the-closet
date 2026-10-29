"use strict";

// PC-36 layer 3: the automated vision orientation check.
// One verdict per piece: which way is up. The cutout is
// composited on magenta (the extractcheck choice: magenta
// appears in neither garments nor rooms, so the garment
// silhouette is unmistakable) and the model answers the
// rotation NEEDED to make the garment upright — none,
// cw90, ccw90, or flip180.
//
// Soft failure by design: an unparseable verdict, a
// refusal, or an outage resolves to { rotation: "none",
// checked: false } — the piece still ships (its render
// is cut as-is) and the review card records that
// orientation was not checked, so the founder rotates
// manually. A wrong forced rotation would be worse
// than none: the manual buttons are one tap either
// way, but a confident wrong verdict hides.

const sharp = require("sharp");
const { getClient, reportUsage, MODEL_VERSION } = require("./describe");

const ROTATIONS = ["none", "cw90", "ccw90", "flip180"];

const PROMPT = `You are judging the orientation of a garment cutout shown on a solid magenta background.

The garment's UP direction is: the collar edge for tops, the waistband edge for trousers, shorts and skirts, the opening edge for shoes and bags. Answer with ONLY a JSON object (no markdown, no prose): {"rotation": "none" or "cw90" or "ccw90" or "flip180"}.

rotation is the turn NEEDED to make the garment upright:
- "none": already upright (collar/waistband/opening at the top).
- "cw90": turn clockwise 90 degrees.
- "ccw90": turn counter-clockwise 90 degrees.
- "flip180": turn upside down (collar/waistband at the bottom now).

When unsure, answer "none".`;

// Strict verdict parsing, mirroring extractcheck's rule:
// anything that is not an explicit known rotation is not
// a verdict at all.
function parseOrientationJson(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(text.trim());
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch (e2) {
        /* fall through to null */
      }
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (!ROTATIONS.includes(parsed.rotation)) return null;
  return parsed.rotation;
}

function buildOrientRequest(cutoutBuffer) {
  return {
    model: process.env.GEMINI_MODEL || MODEL_VERSION,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cutoutBuffer.toString("base64"),
            },
          },
          { text: PROMPT },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  };
}

// callModel defaults to the Vertex Gemini client (same
// as describe/photo). Returns { rotation, checked }.
async function judgeOrientation({ callModel, cutoutBuffer, hooks }) {
  try {
    const magenta = await sharp(cutoutBuffer)
      .flatten({ background: "#ff00ff" })
      .png()
      .toBuffer();
    const model = process.env.GEMINI_MODEL || MODEL_VERSION;
    const req = buildOrientRequest(magenta);
    const callStart = Date.now();
    const caller = callModel || ((r) => getClient().models.generateContent(r));
    const response = await caller(req);
    reportUsage(hooks, response, model, callStart);
    const text = (response.text || "").trim();
    const rotation = parseOrientationJson(text);
    if (!rotation) return { rotation: "none", checked: false };
    return { rotation, checked: true };
  } catch (e) {
    return { rotation: "none", checked: false };
  }
}

module.exports = { judgeOrientation, parseOrientationJson, buildOrientRequest, ROTATIONS, PROMPT };
