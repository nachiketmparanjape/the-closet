#!/usr/bin/env node
// OBS-2 acceptance smoke (run once at ship, safe to re-run):
// signs in anonymously via the Auth REST API, calls askStylist
// with an empty wardrobe, and expects the EMPTY_WARDROBE catalog
// error back — then checks the error_events sink holds the
// failure WITH its key (the uncoded bug this sprint killed).
const fs = require("fs");
const path = require("path");

const API_KEY = (() => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const m = html.match(/apiKey:\s*"([^"]+)"/);
  if (!m) throw new Error("apiKey not found in index.html");
  return m[1];
})();

(async () => {
  const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  }).then((r) => r.json());
  if (!signUp.idToken) throw new Error("anon sign-in failed: " + JSON.stringify(signUp).slice(0, 200));
  const uid = signUp.localId;

  const res = await fetch("https://us-central1-closet-404e9.cloudfunctions.net/askStylist", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + signUp.idToken },
    body: JSON.stringify({ data: { items: [], messages: [{ role: "user", text: "hello" }] } }),
  }).then((r) => r.json());
  console.log("callable response:", JSON.stringify(res).slice(0, 300));
  const msg = res && res.error && res.error.message || "";
  console.log(msg.includes("add a few pieces") ? "✓ EMPTY_WARDROBE catalog message returned" : "✗ unexpected error shape");

  // Check the sink (founder OAuth, same flow as the reports).
  const os = require("os");
  const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const clientId = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const clientSecret = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  const refresh = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refresh }),
  }).then((r) => r.json()).then((j) => j.access_token);
  await new Promise((r) => setTimeout(r, 2500)); // let the event land
  const list = await fetch(`https://firestore.googleapis.com/v1/projects/closet-404e9/databases/(default)/documents/error_events?pageSize=50`, {
    headers: { Authorization: "Bearer " + tok },
  }).then((r) => r.json());
  const mine = (list.documents || []).filter((d) => d.fields && d.fields.uid && d.fields.uid.stringValue === uid);
  for (const d of mine) {
    const f = d.fields;
    console.log("event:", (f.kind || {}).stringValue, "· fn", (f.fn || {}).stringValue, "· key", (f.key || {}).stringValue || "(none)");
  }
  const good = mine.some((d) => (d.fields.key || {}).stringValue === "EMPTY_WARDROBE" && (d.fields.kind || {}).stringValue === "failure");
  console.log(good ? "✓ error_events holds the failure WITH its key — uncoded is dead" : "✗ sink check failed");
  process.exit(good ? 0 : 1);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
