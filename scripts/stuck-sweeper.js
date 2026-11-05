#!/usr/bin/env node
// #131 (2026-11-04): Stuck-state sweeper.
// Finds async workflows stuck in "processing" beyond a timeout and marks
// them "failed" so they can be retried instead of spinning forever.
// Covers: item standardization, outfit parses.
// Run by cron; silent on no-op, logs what it heals.
//
// Usage: node scripts/stuck-sweeper.js [--dry-run]
const fs = require("fs");
const path = require("path");
const os = require("os");

const DRY_RUN = process.argv.includes("--dry-run");
// Stuck threshold: 30 minutes in processing with no update.
const STUCK_MS = 30 * 60 * 1000;
const PROJECT = "closet-404e9";

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

const api = (token) => ({
  async list(collection, pageToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?pageSize=100` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    return r.json();
  },
  async patch(docName, fields) {
    const url = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=${Object.keys(fields).join("&updateMask.fieldPaths=")}`;
    const body = {
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? { stringValue: v } : v])
      ),
    };
    const r = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("patch failed: " + (await r.text()).slice(0, 200));
  },
});

function isStuck(std, nowMs) {
  if (!std || std.status !== "processing") return false;
  // Use lastAttemptAt or markedAt as the staleness signal.
  const ts = std.lastAttemptAt || std.markedAt;
  if (!ts) return true; // no timestamp at all — definitely stuck
  const t = new Date(ts).getTime();
  return nowMs - t > STUCK_MS;
}

(async () => {
  const token = await founderToken();
  const db = api(token);
  const nowMs = Date.now();
  let healed = 0;
  let checked = 0;

  // Scan all users' items for stuck standardizations.
  // (Collection group query would be cleaner but needs an index; paginate users instead.)
  const users = await db.list("users");
  for (const u of users.documents || []) {
    const uid = u.name.split("/").pop();
    let pageToken = null;
    do {
      const items = await db.list(`users/${uid}/items`, pageToken);
      for (const doc of items.documents || []) {
        checked++;
        const f = doc.fields || {};
        const std = f.standardization && f.standardization.mapValue
          ? Object.fromEntries(
              Object.entries(f.standardization.mapValue.fields || {}).map(([k, v]) => [
                k, v.stringValue || v.integerValue || null,
              ])
            )
          : null;
        if (isStuck(std, nowMs)) {
          const itemId = doc.name.split("/").pop();
          console.log(`STUCK: users/${uid}/items/${itemId} processing since ${std.lastAttemptAt || std.markedAt || "unknown"}`);
          if (!DRY_RUN) {
            await db.patch(doc.name, {
              "standardization.status": "failed",
              "standardization.lastError": "stuck_processing_timeout",
            });
          }
          healed++;
        }
      }
      pageToken = items.nextPageToken;
    } while (pageToken);
  }

  // Scan parses for stuck states.
  const parses = await db.list("parses");
  for (const doc of parses.documents || []) {
    checked++;
    const f = doc.fields || {};
    const status = (f.status || {}).stringValue;
    const updatedAt = (f.updatedAt || {}).timestampValue;
    if ((status === "processing" || status === "cutting") && updatedAt) {
      if (nowMs - new Date(updatedAt).getTime() > STUCK_MS) {
        console.log(`STUCK: ${doc.name} status=${status}`);
        if (!DRY_RUN) {
          await db.patch(doc.name, { status: "failed" });
        }
        healed++;
      }
    }
  }

  console.log(`sweeper done: checked=${checked} healed=${healed}${DRY_RUN ? " (dry run)" : ""}`);
})().catch((e) => { console.error("sweeper failed:", e.message); process.exit(1); });
