#!/usr/bin/env node
// PC-96 (2026-11-26): deployed-function secrets audit.
// Compares every deployed Cloud Function's bound secrets against
// SECRETS_BY_FUNCTION in deploy-create.js, and flags any function
// still on a retired runtime (nodejs20 — Google refuses all
// updates to it, which is how the autoStandardizeItem fix was
// blocked until the runtime was bumped in the same PATCH).
// A function born without its secret stays broken: deploy-update
// only patches buildConfig, never serviceConfig.
// Usage: node scripts/verify-function-secrets.js
// Exit 0 when everything matches; exit 1 with a list otherwise.
// Run after any function create/update, and in the monthly doc review.
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const LOCATION = "us-central1";
const RETIRED_RUNTIMES = new Set(["nodejs20"]);

function founderToken() {
  const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const clientId = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const clientSecret = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  const refresh = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: clientId,
      client_secret: clientSecret, refresh_token: refresh,
    }),
  }).then((r) => r.json()).then((j) => j.access_token);
}

// Parse SECRETS_BY_FUNCTION out of deploy-create.js (same pattern
// stuck-sweeper.js uses for the OAuth constants — never require a
// script that runs its main flow on load).
function expectedSecrets() {
  const src = fs.readFileSync(path.join(__dirname, "..", "deploy-create.js"), "utf8");
  const block = (src.match(/const SECRETS_BY_FUNCTION = \{([\s\S]*?)\};/) || [])[1];
  if (!block) throw new Error("SECRETS_BY_FUNCTION not found in deploy-create.js");
  const map = {};
  const re = /([A-Za-z0-9_]+):\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    map[m[1]] = (m[2].match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
  }
  return map;
}

(async () => {
  const expected = expectedSecrets();
  const token = await founderToken();
  const url = `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${LOCATION}/functions?pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const json = await res.json();
  if (json.error) throw new Error("functions API: " + JSON.stringify(json.error).slice(0, 200));
  const problems = [];
  const checked = [];
  for (const fn of json.functions || []) {
    const name = fn.name.split("/").pop();
    const bound = ((fn.serviceConfig || {}).secretEnvironmentVariables || []).map((s) => s.key).sort();
    const want = (expected[name] || []).slice().sort();
    checked.push(name);
    if (JSON.stringify(bound) !== JSON.stringify(want)) {
      problems.push(`${name}: bound [${bound.join(", ")}], expected [${want.join(", ")}]`);
    }
    const runtime = (fn.buildConfig || {}).runtime || "?";
    if (RETIRED_RUNTIMES.has(runtime)) {
      problems.push(`${name}: retired runtime ${runtime} — no update (including a secret bind) can land until it is bumped`);
    }
    if (fn.state !== "ACTIVE") {
      problems.push(`${name}: state ${fn.state}`);
    }
  }
  // Functions in the map but not deployed at all.
  for (const name of Object.keys(expected)) {
    if (!checked.includes(name)) problems.push(`${name}: in SECRETS_BY_FUNCTION but not deployed`);
  }
  console.log(`checked ${checked.length} functions`);
  if (problems.length) {
    console.log("MISMATCHES:");
    problems.forEach((p) => console.log(" - " + p));
    process.exit(1);
  }
  console.log("OK: every deployed function has exactly its declared secrets, no retired runtimes.");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
