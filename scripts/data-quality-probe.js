#!/usr/bin/env node
// #131 (2026-11-04): Data quality probes — extends the Monday OBS-2 heartbeat.
// Silent on pass; reports specific issues on fail.
// Checks:
// 1. Items with photos[] missing `type` tags (backfill completeness)
// 2. Items stuck in `processing` > 1 hour (stuck detection)
// 3. standardization.status=ready but no photo with type=standardized (consistency)
// 4. standardization.status=already_clean but no photo with type=standardized (consistency)
//
// Usage: node scripts/data-quality-probe.js
// Exit 0 = all pass (silent). Exit 1 = issues found (prints them).
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const STUCK_MS = 60 * 60 * 1000; // 1 hour

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

async function listAll(token, collection) {
  const docs = [];
  let pageToken = null;
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?pageSize=100` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    const j = await r.json();
    docs.push(...(j.documents || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return docs;
}

function getStr(fields, key) {
  return (fields[key] || {}).stringValue || null;
}

function getMap(fields, key) {
  const m = (fields[key] || {}).mapValue;
  if (!m) return null;
  return Object.fromEntries(
    Object.entries(m.fields || {}).map(([k, v]) => [k, v.stringValue || v.integerValue || null])
  );
}

(async () => {
  const token = await founderToken();
  const nowMs = Date.now();
  const issues = [];

  const users = await listAll(token, "users");
  for (const u of users) {
    const uid = u.name.split("/").pop();
    const items = await listAll(token, `users/${uid}/items`);
    for (const doc of items) {
      const itemId = doc.name.split("/").pop();
      const f = doc.fields || {};
      const photos = ((f.photos || {}).arrayValue || {}).values || [];
      const std = getMap(f, "standardization");
      const stdStatus = std ? std.status : null;

      // 1. Photos missing type tags
      const untyped = photos.filter((p) => {
        const pf = (p.mapValue || {}).fields || {};
        return !pf.type;
      });
      if (untyped.length) {
        issues.push(`UNTYPED_PHOTOS: users/${uid}/items/${itemId} has ${untyped.length}/${photos.length} photos without type`);
      }

      // 2. Stuck in processing > 1 hour
      if (stdStatus === "processing") {
        const ts = (std.lastAttemptAt || std.markedAt) ? new Date(std.lastAttemptAt || std.markedAt).getTime() : 0;
        if (nowMs - ts > STUCK_MS) {
          issues.push(`STUCK_PROCESSING: users/${uid}/items/${itemId} processing for >1h`);
        }
      }

      // 3. status=ready but no standardized photo
      if (stdStatus === "ready") {
        const hasStd = photos.some((p) => getStr((p.mapValue || {}).fields || {}, "type") === "standardized");
        if (!hasStd) issues.push(`INCONSISTENT_READY: users/${uid}/items/${itemId} status=ready but no standardized photo`);
      }

      // 4. status=already_clean but no standardized photo
      if (stdStatus === "already_clean") {
        const hasStd = photos.some((p) => getStr((p.mapValue || {}).fields || {}, "type") === "standardized");
        if (!hasStd) issues.push(`INCONSISTENT_CLEAN: users/${uid}/items/${itemId} status=already_clean but no standardized photo`);
      }
    }
  }

  if (issues.length) {
    console.log("DATA QUALITY FAIL — " + issues.length + " issue(s):");
    issues.forEach((i) => console.log("  " + i));
    process.exit(1);
  }
  console.log("DATA QUALITY PASS");
})().catch((e) => { console.error("probe failed:", e.message); process.exit(1); });
