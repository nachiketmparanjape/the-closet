// OBS-4 follow-up (founder-approved 2026-10-24): normalize the
// v1-remnant items — docs carrying the v1 single `color` hex but
// no v2 `colors` array (legal under DATA_MODEL's lazy migration;
// this is the re-save that completes it). Colors are built with
// the app's OWN buildColorsFromAI, extracted from index.html and
// run against the real palette module — no re-implementation.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
global.window = globalThis;
require(path.join(__dirname, "..", "public", "js", "palette.js"));
global.window.Palette = globalThis.Palette;
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const fnSrc = html.match(/function buildColorsFromAI\(ai, dominantHex\) \{[\s\S]*?\n      \}/)[0];
const buildColorsFromAI = eval("(" + fnSrc.replace(/^function/, "function") + ")");

const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
const CID = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
const CS = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
const RT = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
const BASE = "https://firestore.googleapis.com/v1/projects/closet-404e9/databases/(default)/documents";
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
const dec = (v) => { if (!v) return null; if (v.stringValue !== undefined) return v.stringValue; if (v.integerValue !== undefined) return Number(v.integerValue); if (v.doubleValue !== undefined) return v.doubleValue; if (v.booleanValue !== undefined) return v.booleanValue; if (v.nullValue !== undefined) return null; if (v.timestampValue !== undefined) return v.timestampValue; if (v.arrayValue) return (v.arrayValue.values || []).map(dec); if (v.mapValue) { const o = {}; for (const k in v.mapValue.fields || {}) o[k] = dec(v.mapValue.fields[k]); return o; } return null; };
const enc = (v) => { if (v === null || v === undefined) return { nullValue: null }; if (typeof v === "string") return { stringValue: v }; if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; if (typeof v === "boolean") return { booleanValue: v }; if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }; const f = {}; for (const k in v) f[k] = enc(v[k]); return { mapValue: { fields: f } }; };
(async () => {
  const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: CID, client_secret: CS, refresh_token: RT }) }).then((r) => r.json()).then((j) => j.access_token);
  const H = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };
  const list = await fetch(`${BASE}/users/${UID}/items?pageSize=300`, { headers: H }).then((r) => r.json());
  const items = (list.documents || []).map((d) => { const o = { _id: d.name.split("/").pop() }; for (const k in d.fields || {}) o[k] = dec(d.fields[k]); return o; });
  const targets = items.filter((it) => !Array.isArray(it.colors) || !it.colors.length);
  console.log("v1 remnants:", targets.length);
  for (const it of targets) {
    const colors = buildColorsFromAI(it.ai || null, it.color || null);
    const body = { fields: { colors: enc(colors) } };
    const r = await fetch(`${BASE}/users/${UID}/items/${it._id}?updateMask.fieldPaths=colors`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
    console.log(r.status === 200 ? "OK  " : "FAIL(" + r.status + ") ", it.name, "→", colors.map((c) => `${c.name || "(unnamed)"} ${c.hex}${c.primary ? " *" : ""}`).join(", "));
  }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
