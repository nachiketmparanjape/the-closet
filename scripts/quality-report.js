#!/usr/bin/env node
// OBS-2 quality report — the durable, on-demand answer to "what's
// failing, how often, since when" for the Closet callables.
//
//   node scripts/quality-report.js [--days 7] [--uid <uid>]
//
// Reads three Firestore sources with the founder's own OAuth
// (same refresh flow as feedback-triage.js; no secrets in file):
//   - error_events (root): per-callable success/failure ledger +
//     rejection / degraded / self_heal events (OBS-2 sink).
//   - ai_usage (root): AI call outcomes + latency, per feature.
//   - users/<uid>/client_errors: client-side failures, with the
//     OBS-2 session id + action trail for correlation.
// Spike flags: a function's last-24h failure rate is flagged
// when it has >=3 failures and the rate is >=2x its baseline
// rate over the rest of the window. Notify-only by design —
// this report is the alerting surface until a digest is built.
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const args = process.argv.slice(2);
// Parse flags by name — the naive indexOf()+1 pattern silently
// reads args[0] when a flag is absent (the uid became "--days"
// and every per-user section read an empty account, reporting
// a false "all clean". Found by OBS-4's first census run.)
const flagVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DAYS = Number(flagVal("--days") || 7) || 7;
const UID = flagVal("--uid") || "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
// The heartbeat probe's own events are excluded from the stats
// (they are synthetic) and reported as a liveness line instead.
let PROBE_UID = null;
try {
  const probeCreds = JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".heartbeat-probe.json"), "utf8"));
  PROBE_UID = probeCreds.uid || null;
} catch (e) { /* no probe bootstrapped yet */ }

function getToken() {
  const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const clientId = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const clientSecret = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  const refresh = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refresh }),
  }).then((r) => r.json()).then((j) => j.access_token);
}

const dec = (v) => {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(dec);
  if (v.mapValue) { const o = {}; for (const k in v.mapValue.fields || {}) o[k] = dec(v.mapValue.fields[k]); return o; }
  return null;
};

async function listAll(tok, collPath, sinceIso) {
  const out = [];
  let pageToken = "";
  for (;;) {
    const url = `${BASE}/${collPath}?pageSize=300${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    for (const d of j.documents || []) {
      const o = {};
      for (const k in d.fields || {}) o[k] = dec(d.fields[k]);
      const ts = o.ts || o.createdAt;
      if (ts && ts >= sinceIso) out.push(o);
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

async function listAllDocs(tok, collPath) {
  const out = [];
  let pageToken = "";
  for (;;) {
    const url = `${BASE}/${collPath}?pageSize=300${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    for (const d of j.documents || []) {
      const o = { _id: (d.name || "").split("/").pop() };
      for (const k in d.fields || {}) o[k] = dec(d.fields[k]);
      out.push(o);
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

(async () => {
  const tok = await getToken();
  const now = Date.now();
  const sinceIso = new Date(now - DAYS * 864e5).toISOString();
  const dayAgoIso = new Date(now - 864e5).toISOString();

  const [events, usage, clientErrs] = await Promise.all([
    listAll(tok, "error_events", sinceIso),
    listAll(tok, "ai_usage", sinceIso),
    listAll(tok, `users/${UID}/client_errors`, sinceIso).catch(() => []),
  ]);

  console.log(`QUALITY REPORT — last ${DAYS} day(s) · generated ${new Date(now).toISOString()}\n`);

  // Per-function ledger from error_events.
  const byFn = {};
  let probeLatest = null;
  for (const e of events) {
    if (PROBE_UID && e.uid === PROBE_UID) {
      if (e.kind === "failure" && e.key === "EMPTY_WARDROBE" && (!probeLatest || (e.ts || "") > probeLatest)) probeLatest = e.ts;
      continue;
    }
    const fn = (e.fn || "?").split(":")[0];
    const b = byFn[fn] || (byFn[fn] = { ok: 0, fail: 0, keys: {}, durs: [], fail24: 0, calls24: 0, failBase: 0, callsBase: 0 });
    const in24 = (e.ts || "") >= dayAgoIso;
    if (e.kind === "success") { b.ok++; b.durs.push(e.durationMs || 0); }
    if (e.kind === "failure") { b.fail++; if (e.key) b.keys[e.key] = (b.keys[e.key] || 0) + 1; }
    if (e.kind === "success" || e.kind === "failure") {
      if (in24) { b.calls24++; if (e.kind === "failure") b.fail24++; }
      else { b.callsBase++; if (e.kind === "failure") b.failBase++; }
    }
  }
  console.log("CALLABLES (error_events)");
  const fns = Object.keys(byFn).sort();
  if (!fns.length) console.log("  (no events yet)");
  for (const fn of fns) {
    const b = byFn[fn];
    const total = b.ok + b.fail;
    const rate = total ? ((100 * b.fail) / total).toFixed(1) : "0.0";
    const topKeys = Object.entries(b.keys).sort((a, z) => z[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}×${n}`).join(", ");
    console.log(`  ${fn}: ${b.ok} ok / ${b.fail} failed (${rate}%) · p50 ${pct(b.durs, 50) ?? "–"}ms · p95 ${pct(b.durs, 95) ?? "–"}ms${topKeys ? " · top: " + topKeys : ""}`);
    const r24 = b.calls24 ? b.fail24 / b.calls24 : 0;
    const rBase = b.callsBase ? b.failBase / b.callsBase : 0;
    if (b.fail24 >= 3 && r24 >= 2 * Math.max(rBase, 0.01)) {
      console.log(`  ⚠ SPIKE: ${fn} failed ${b.fail24}/${b.calls24} in the last 24h (${(r24 * 100).toFixed(0)}%) vs baseline ${(rBase * 100).toFixed(0)}%`);
    }
  }

  console.log("\nHEARTBEAT (synthetic probe, excluded from the stats above)");
  console.log(probeLatest
    ? `  last probe failure recorded with its key at ${probeLatest} — the ledger is alive`
    : "  ⚠ no probe event in this window — either the probe has not run or the ledger is not recording");

  // Non-failure events — the used-to-be-silent bucket.
  const evCounts = {};
  for (const e of events) {
    if (PROBE_UID && e.uid === PROBE_UID) continue;
    if (e.kind === "success" || e.kind === "failure") continue;
    const k = `${e.kind} · ${e.fn || "?"}`;
    evCounts[k] = (evCounts[k] || 0) + 1;
  }
  console.log("\nNON-FAILURE EVENTS (rejections / degradations / self-heals)");
  const evs = Object.entries(evCounts).sort((a, z) => z[1] - a[1]);
  if (!evs.length) console.log("  (none)");
  for (const [k, n] of evs) console.log(`  ${k}: ${n}`);

  // AI usage outcomes.
  const byFeat = {};
  for (const u of usage) {
    const f = u.feature || "?";
    const b = byFeat[f] || (byFeat[f] = { ok: 0, fail: 0, lat: [] });
    if (u.outcome === "success") b.ok++; else b.fail++;
    if (u.latencyMs != null) b.lat.push(u.latencyMs);
  }
  console.log("\nAI CALLS (ai_usage)");
  const feats = Object.keys(byFeat).sort();
  if (!feats.length) console.log("  (none)");
  for (const f of feats) {
    const b = byFeat[f];
    console.log(`  ${f}: ${b.ok} ok / ${b.fail} failed · p50 ${pct(b.lat, 50) ?? "–"}ms · p95 ${pct(b.lat, 95) ?? "–"}ms`);
  }

  // OBS-4: data-model drift census — the live documents vs
  // docs/DATA_MODEL.md (v2) + the NAMING-1 standard. Read-only;
  // drift found here becomes its own cut, never an auto-repair.
  const [items, trips, checks] = await Promise.all([
    listAllDocs(tok, `users/${UID}/items`),
    listAllDocs(tok, `users/${UID}/trips`).catch(() => []),
    listAllDocs(tok, `users/${UID}/shopChecks`).catch(() => []),
  ]);
  const drift = {};
  const flag = (kind, id) => {
    const d = drift[kind] || (drift[kind] = { n: 0, ids: [] });
    d.n++; if (d.ids.length < 3) d.ids.push(id);
  };
  for (const it of items) {
    if (!it.name || !String(it.name).trim() || it.name === "Untitled item") flag("item:missing-name", it._id);
    if (!it.shortName || !String(it.shortName).trim()) flag("item:missing-shortName", it._id);
    else if (String(it.shortName).length > 48 || String(it.shortName).trim().split(/\s+/).length > 5) flag("item:shortName-over-budget", it._id);
    if (!it.category) flag("item:missing-category", it._id);
    if (!Array.isArray(it.colors) || !it.colors.length) flag("item:no-colors-array(v1 remnant)", it._id);
    if (!it.imageUrl && !(it.photos && it.photos[0] && it.photos[0].url)) flag("item:missing-photo", it._id);
    if (!it.ai && it.needsAi !== true) flag("item:unnamed-unflagged(no ai, no needsAi)", it._id);
    if (!it.createdAt) flag("item:missing-createdAt", it._id);
  }
  for (const t of trips) {
    if (!t.name) flag("trip:missing-name", t._id);
    const leg = (t.legs && t.legs[0]) || null;
    if (!leg || !(leg.location || leg.resolvedName) || !leg.startDate) flag("trip:missing-leg", t._id);
  }
  for (const c of checks) {
    if (!c.item || !c.item.name) flag("check:missing-item-name", c._id);
    if (!["considering", "bought", "dismissed"].includes(c.status)) flag("check:bad-status", c._id);
    if (!c.photoUrl && !c.photoPath) flag("check:missing-photo", c._id);
  }
  console.log(`\nDATA DRIFT (census: ${items.length} items · ${trips.length} trips · ${checks.length} checks, vs DATA_MODEL v2 + NAMING-1)`);
  const kinds = Object.entries(drift).sort((a, z) => z[1].n - a[1].n);
  if (!kinds.length) console.log("  none — the live documents match the model");
  for (const [kind, d] of kinds) console.log(`  ${kind}: ${d.n} (e.g. ${d.ids.join(", ")})`);

  // Client errors.
  console.log(`\nCLIENT ERRORS (${clientErrs.length})`);
  const byWhere = {};
  for (const c of clientErrs) byWhere[c.where || "?"] = (byWhere[c.where || "?"] || 0) + 1;
  for (const [w, n] of Object.entries(byWhere).sort((a, z) => z[1] - a[1]).slice(0, 8)) console.log(`  ${w}: ${n}`);
  for (const c of clientErrs.slice(-3)) {
    console.log(`  latest: ${c.createdAt || "?"} · ${c.where || "?"} · session ${c.sessionId || "(pre-OBS-2)"} · ${(c.message || "").slice(0, 90)}`);
  }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
