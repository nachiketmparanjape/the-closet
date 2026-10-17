// Lane metrics instrumentation (Sprint 8).
//
// Computes the five product-lane health metrics from Firestore, read-only:
//   catalogue       AI tag acceptance rate
//   outfits         wear-through rate (saved -> worn)
//   loop            rating completion rate (wears that get rated)
//   stylist         calibration gap (predicted confidence vs actual ratings)
//   personalization suggestion acceptance rate
//
// Usage: node scripts/lane-metrics.js [--uid <uid>]
//   UID is auto-discovered when the project has a single user.
//   Prints a human summary plus JSON. Never writes.
//
// Auth: reuses the Firebase CI OAuth flow (same as deploy-update.js).
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT = "closet-404e9";
const FIELDS = [
  ["category", "category"],
  ["brand", "brand"],
  ["subtype", "subtype"],
  ["pattern", "pattern"],
  ["fit", "fit"],
  ["formality", "formality"],
  ["fabric_guess", "fabricGuess"],
];

// ---- Firestore REST value decoding ---------------------------------------

function dec(v) {
  if (v == null) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(dec);
  if (v.mapValue !== undefined) {
    const o = {};
    for (const k of Object.keys(v.mapValue.fields || {})) o[k] = dec(v.mapValue.fields[k]);
    return o;
  }
  if (v.nullValue !== undefined) return null;
  return null;
}

function docOf(raw) {
  const o = {};
  for (const k of Object.keys(raw.fields || {})) o[k] = dec(raw.fields[k]);
  o._id = raw.name.split("/").pop();
  const m = raw.name.match(/\/users\/([^/]+)\//);
  o._uid = m ? m[1] : null;
  return o;
}

// ---- Pure metric computation (unit-tested) -------------------------------

function tagAcceptance(items) {
  const perField = {};
  let acc = 0, tot = 0;
  for (const it of items) {
    const ai = it.ai && typeof it.ai === "object" ? it.ai : null;
    if (!ai) continue;
    for (const [aiKey, field] of FIELDS) {
      const sug = ai[aiKey] != null && ai[aiKey] !== "" ? String(ai[aiKey]) : null;
      if (sug === null) continue;
      // Vintage guard: v1/bulk items never had these fields written — the
      // user never saw them, so they can't count as rejected. Only score
      // fields the final record actually carries.
      if (!(field in it)) continue;
      const fin = it[field] != null && it[field] !== "" ? String(it[field]) : null;
      perField[field] = perField[field] || { acc: 0, tot: 0 };
      perField[field].tot++;
      tot++;
      if (sug === fin) { perField[field].acc++; acc++; }
    }
  }
  const fields = {};
  for (const f of Object.keys(perField)) {
    fields[f] = perField[f].tot ? perField[f].acc / perField[f].tot : null;
  }
  return { rate: tot ? acc / tot : null, n: tot, fields };
}

function colorAcceptance(items) {
  let acc = 0, tot = 0;
  for (const it of items) {
    const ai = it.ai && typeof it.ai === "object" ? it.ai : null;
    if (!ai || ai.colors == null) continue;
    const sug = (Array.isArray(ai.colors) ? ai.colors : [ai.colors])
      .map(String).map((s) => s.toLowerCase());
    if (!sug.length) continue;
    // Vintage guard: items without a colors[] array never exposed colors
    // for acceptance — skip, don't score as rejected.
    if (!Array.isArray(it.colors)) continue;
    const fin = Array.isArray(it.colors)
      ? it.colors.map((c) => (c && c.name ? String(c.name).toLowerCase() : null)).filter(Boolean)
      : [];
    for (const s of sug) { tot++; if (fin.includes(s)) acc++; }
  }
  return { rate: tot ? acc / tot : null, n: tot };
}

function wearThrough(outfits, wears) {
  const groups = new Set(outfits.map((o) => o.versionGroup || o._id));
  const worn = new Set(wears.map((w) => w.outfitId).filter(Boolean));
  // Count a group as worn if any of its version doc ids was worn.
  const groupIds = new Set();
  for (const o of outfits) groupIds.add(o._id);
  let wornGroups = 0;
  for (const g of groups) {
    const versions = outfits.filter((o) => (o.versionGroup || o._id) === g).map((o) => o._id);
    if (versions.some((id) => worn.has(id))) wornGroups++;
  }
  return { rate: groups.size ? wornGroups / groups.size : null, worn: wornGroups, outfits: groups.size };
}

function ratingCompletion(wears, ratings) {
  if (!wears.length) return { rate: null, rated: 0, wears: 0 };
  const rated = new Set(
    ratings.filter((r) => r.rater === "user" && r.wearEventId).map((r) => r.wearEventId)
  );
  const n = wears.filter((w) => rated.has(w._id)).length;
  return { rate: n / wears.length, rated: n, wears: wears.length };
}

function calibrationGap(outfits, ratings) {
  const gaps = [];
  for (const o of outfits) {
    if (o.appConfidence == null) continue;
    const scores = ratings
      .filter((r) => r.rater === "user" && r.targetKind === "outfit" && r.targetId === o._id && r.score != null)
      .map((r) => Number(r.score));
    if (!scores.length) continue;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    gaps.push(Math.abs(Number(o.appConfidence) - mean));
  }
  return {
    gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    n: gaps.length,
  };
}

function suggestionAcceptance(ratings, styleProfile) {
  const suggested = new Set(
    ratings
      .filter((r) => r.rater === "app" && r.suggestedPreference)
      .map((r) => String(r.suggestedPreference))
  );
  if (!suggested.size) return { rate: null, accepted: 0, suggested: 0 };
  const prefs = (styleProfile && Array.isArray(styleProfile.preferences) ? styleProfile.preferences : [])
    .map((p) => (p && p.text ? String(p.text) : null)).filter(Boolean);
  const accepted = [...suggested].filter((s) => prefs.includes(s)).length;
  return { rate: accepted / suggested.size, accepted, suggested: suggested.size };
}

function computeMetrics({ items, outfits, wears, ratings, styleProfile }) {
  return {
    catalogue: { tagAcceptance: tagAcceptance(items), colorAcceptance: colorAcceptance(items) },
    outfits: { wearThrough: wearThrough(outfits, wears) },
    loop: { ratingCompletion: ratingCompletion(wears, ratings) },
    stylist: { calibrationGap: calibrationGap(outfits, ratings) },
    personalization: { suggestionAcceptance: suggestionAcceptance(ratings, styleProfile) },
  };
}

// ---- Fetch + report ------------------------------------------------------

async function accessToken() {
  const src = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const cid = src.match(/CLIENT_ID = "([^"]+)"/)[1];
  const csec = src.match(/CLIENT_SECRET = "([^"]+)"/)[1];
  const refreshToken = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: cid, client_secret: csec, refresh_token: refreshToken }),
  });
  const json = await tr.json();
  if (!tr.ok) throw new Error("token exchange failed");
  return json.access_token;
}

async function collectionGroup(at, collectionId, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId, allDescendants: true }], limit: 1000 },
    }),
  });
  const j = await r.json();
  return j.filter((row) => row.document).map((row) => docOf(row.document)).filter((d) => d._uid === uid);
}

function fmtRate(r) {
  return r.rate == null ? "n/a" : (r.rate * 100).toFixed(1) + "%";
}

async function main() {
  const at = await accessToken();
  // Discover UID from items.
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const probe = await (await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "items", allDescendants: true }], limit: 500 } }),
  })).json();
  const uids = new Set(probe.filter((x) => x.document).map((x) => docOf(x.document)._uid).filter(Boolean));
  let uid = null;
  const arg = process.argv.indexOf("--uid");
  if (arg !== -1) uid = process.argv[arg + 1];
  else if (uids.size === 1) uid = [...uids][0];
  if (!uid) throw new Error(`UID ambiguous (${[...uids].join(",")}) — pass --uid`);

  const [items, outfits, wears, ratings] = await Promise.all(
    ["items", "outfits", "wear_events", "ratings"].map((c) => collectionGroup(at, c, uid))
  );
  let styleProfile = null;
  const sp = await (await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/style_profile/${uid}`,
    { headers: { Authorization: "Bearer " + at } }
  )).json();
  if (sp.fields) styleProfile = docOf(sp);

  const m = computeMetrics({ items, outfits, wears, ratings, styleProfile });
  const pct = (x) => (x == null ? "n/a" : (x * 100).toFixed(1) + "%");
  console.log("Lane metrics for closet-404e9 (n: " + items.length + " items, " + outfits.length + " outfits, " + wears.length + " wears, " + ratings.length + " ratings)");
  console.log("  catalogue.tagAcceptance:      " + pct(m.catalogue.tagAcceptance.rate) + ` (n=${m.catalogue.tagAcceptance.n} fields)`);
  for (const f of Object.keys(m.catalogue.tagAcceptance.fields)) {
    console.log("    - " + f + ": " + pct(m.catalogue.tagAcceptance.fields[f]));
  }
  console.log("  catalogue.colorAcceptance:    " + pct(m.catalogue.colorAcceptance.rate) + ` (n=${m.catalogue.colorAcceptance.n} colors)`);
  console.log("  outfits.wearThrough:          " + pct(m.outfits.wearThrough.rate) + ` (${m.outfits.wearThrough.worn}/${m.outfits.wearThrough.outfits})`);
  console.log("  loop.ratingCompletion:        " + pct(m.loop.ratingCompletion.rate) + ` (${m.loop.ratingCompletion.rated}/${m.loop.ratingCompletion.wears})`);
  console.log("  stylist.calibrationGap:       " + (m.stylist.calibrationGap.gap == null ? "n/a" : m.stylist.calibrationGap.gap.toFixed(2) + " pts") + ` (n=${m.stylist.calibrationGap.n} outfits)`);
  console.log("  personalization.suggestionAcceptance: " + pct(m.personalization.suggestionAcceptance.rate) + ` (${m.personalization.suggestionAcceptance.accepted}/${m.personalization.suggestionAcceptance.suggested})`);
  console.log(JSON.stringify(m));
}

if (require.main === module) {
  main().catch((e) => { console.error("lane-metrics failed:", e.message); process.exit(1); });
}

module.exports = { computeMetrics, tagAcceptance, colorAcceptance, wearThrough, ratingCompletion, calibrationGap, suggestionAcceptance, dec };
