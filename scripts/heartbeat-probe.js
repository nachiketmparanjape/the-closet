#!/usr/bin/env node
// OBS-2 heartbeat probe — monitors the monitor.
//   node scripts/heartbeat-probe.js
// Signs in as a dedicated probe account (bootstrapped on first
// run; credentials in .heartbeat-probe.json, gitignored, 600),
// makes the one call that must always fail the same way —
// askStylist with an empty wardrobe — and verifies the failure
// landed in error_events WITH its catalog key (EMPTY_WARDROBE).
// Prints HEARTBEAT PASS/FAIL; exit 0/1. Run weekly by cron;
// silence on PASS, the founder hears only about FAIL.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const CREDS = path.join(__dirname, "..", ".heartbeat-probe.json");
const API_KEY = (() => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const m = html.match(/apiKey:\s*"([^"]+)"/);
  if (!m) throw new Error("apiKey not found in index.html");
  return m[1];
})();

async function authCall(endpoint, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(endpoint + " failed: " + JSON.stringify(j.error || j).slice(0, 200));
  return j;
}

function founderToken() {
  const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const clientId = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const clientSecret = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  const refresh = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refresh }),
  }).then((r) => r.json()).then((j) => j.access_token);
}

(async () => {
  let creds = null;
  if (fs.existsSync(CREDS)) creds = JSON.parse(fs.readFileSync(CREDS, "utf8"));
  if (!creds) {
    creds = {
      email: "heartbeat-probe@closet-404e9.example",
      password: crypto.randomBytes(24).toString("base64url"),
    };
    const su = await authCall("signUp", { email: creds.email, password: creds.password, returnSecureToken: true });
    creds.uid = su.localId;
    fs.writeFileSync(CREDS, JSON.stringify(creds, null, 2), { mode: 0o600 });
    console.log("probe account bootstrapped:", creds.uid);
  }
  const si = await authCall("signInWithPassword", { email: creds.email, password: creds.password, returnSecureToken: true });
  const uid = si.localId;
  const before = new Date(Date.now() - 60000).toISOString();

  const res = await fetch("https://us-central1-closet-404e9.cloudfunctions.net/askStylist", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + si.idToken },
    body: JSON.stringify({ data: { items: [], messages: [{ role: "user", text: "heartbeat" }] } }),
  }).then((r) => r.json());
  const msg = (res && res.error && res.error.message) || "";
  if (!msg.includes("add a few pieces")) {
    console.log("HEARTBEAT FAIL — unexpected callable response:", JSON.stringify(res).slice(0, 200));
    process.exit(1);
  }

  const tok = await founderToken();
  // 2026-11-09 fix: the old code listed the first 100 error_events and
  // searched them client-side. Firestore's list returns documents in
  // ID order, not by time — once the collection passed 100 docs (568
  // by Nov 9), the newest event stopped appearing in that page and the
  // probe failed forever. Query by the probe uid instead (single-field
  // filter, no composite index needed); the probe account has very few
  // events, so the page always contains all of them. Filter key/kind/ts
  // client-side as before.
  for (let attempt = 0; attempt < 6; attempt++) {
    const q = await fetch("https://firestore.googleapis.com/v1/projects/closet-404e9/databases/(default)/documents:runQuery", {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "error_events" }],
          where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } } },
          limit: 100,
        },
      }),
    }).then((r) => r.json());
    const hit = (q || []).find((r) => {
      const d = r.document;
      if (!d) return false;
      const f = d.fields || {};
      return (f.key || {}).stringValue === "EMPTY_WARDROBE" &&
        (f.kind || {}).stringValue === "failure" &&
        (f.ts || {}).timestampValue >= before;
    });
    if (hit) {
      console.log("HEARTBEAT PASS — probe event in error_events with key EMPTY_WARDROBE at", (hit.document.fields.ts || {}).timestampValue);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("HEARTBEAT FAIL — no probe event found in error_events (the ledger or the boundary is broken)");
  process.exit(1);
})().catch((e) => { console.log("HEARTBEAT FAIL —", e.message); process.exit(1); });
