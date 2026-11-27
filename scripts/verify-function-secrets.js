#!/usr/bin/env node
// PC-96 (2026-11-26): deployed-function secrets audit.
// Compares every deployed Cloud Function's bound secrets against
// SECRETS_BY_FUNCTION in deploy-create.js, and flags any function
// still on a retired runtime (nodejs20 — Google refuses all
// updates to it, which is how a fix was once blocked until the
// runtime was bumped in the same PATCH).
// A function born without its secret stays broken: deploy-update
// only patches buildConfig, never serviceConfig.
//
// PC-104 (2026-11-26): also audits deployed config drift against
// function-config.json — timeout, memory (the API reports "1GiB"
// where the config writes "1Gi"; both spellings normalize the
// same), and eventTrigger wiring for the functions that declare
// one. A trigger was once lost in a REST recreate precisely
// because no audit checked wiring (PC-101); PC-106 deleted the
// fleet's only event-triggered function, so the wiring check
// currently has nothing to check — it stays for the next one.
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
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "function-config.json"), "utf8"));
  const token = await founderToken();
  const url = `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${LOCATION}/functions?pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const json = await res.json();
  if (json.error) throw new Error("functions API: " + JSON.stringify(json.error).slice(0, 200));
  const problems = [];
  const checked = [];
  // The API reports memory as "1GiB"; the config writes "1Gi".
  // Same quantity, different spelling — normalize before comparing.
  const normMem = (s) => String(s || "").replace(/([KMGT]i)B$/i, "$1");
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
    // PC-104: config drift — timeout, memory, trigger wiring.
    const cfg = config[name];
    if (cfg) {
      if (cfg.timeoutSeconds && fn.serviceConfig.timeoutSeconds !== cfg.timeoutSeconds) {
        problems.push(`${name}: timeout ${fn.serviceConfig.timeoutSeconds}s, expected ${cfg.timeoutSeconds}s`);
      }
      if (cfg.availableMemory && normMem(fn.serviceConfig.availableMemory) !== normMem(cfg.availableMemory)) {
        problems.push(`${name}: memory ${fn.serviceConfig.availableMemory}, expected ${cfg.availableMemory}`);
      }
      if (cfg.eventTrigger) {
        const et = fn.eventTrigger;
        if (!et) {
          problems.push(`${name}: no eventTrigger — the trigger was never wired (PC-101 class)`);
        } else {
          if (et.eventType !== cfg.eventTrigger.eventType) {
            problems.push(`${name}: trigger eventType ${et.eventType}, expected ${cfg.eventTrigger.eventType}`);
          }
          const wantDoc = (cfg.eventTrigger.eventFilters || []).find((f) => f.attribute === "document");
          const gotDoc = (et.eventFilters || []).find((f) => f.attribute === "document");
          if (wantDoc && (!gotDoc || gotDoc.value !== wantDoc.value)) {
            problems.push(`${name}: trigger document filter ${gotDoc ? gotDoc.value : "(none)"}, expected ${wantDoc.value}`);
          }
          if (cfg.eventTrigger.triggerRegion && et.triggerRegion !== cfg.eventTrigger.triggerRegion) {
            problems.push(`${name}: trigger region ${et.triggerRegion}, expected ${cfg.eventTrigger.triggerRegion}`);
          }
        }
      }
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
  console.log("OK: every deployed function has exactly its declared secrets, no retired runtimes, and no config drift.");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
