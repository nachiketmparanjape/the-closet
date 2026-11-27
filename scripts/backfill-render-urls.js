#!/usr/bin/env node
// PC-93 (2026-11-26): backfill renderUrl onto photo entries whose
// cutout render passed but was never linked.
// The parse-confirm path wrote renderStoragePath + renderStatus
// "passed" without minting renderUrl, so photoDisplayUrl fell back
// to the original photo and the cutout never showed. The confirm
// path now mints at save time; this script heals items created
// before that fix (and any later item whose mint failed at confirm).
// Minting mirrors what the client SDK's getDownloadURL does: read
// the object's firebaseStorageDownloadTokens metadata (creating one
// if absent) and build the v0 download URL.
// Usage: node scripts/backfill-render-urls.js [--dry-run] [--apply]
// Default is --dry-run (lists what would change). --apply writes.
// Exit 0 on success; lists every item touched.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PROJECT = "closet-404e9";
const BUCKET = "closet-404e9.firebasestorage.app";
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
const APPLY = process.argv.includes("--apply");

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
async function listDocs(token, collectionPath, pageSize = 100) {
  const out = [];
  let pageToken = "";
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}` + (pageToken ? `&pageToken=${pageToken}` : "");
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    const j = await r.json();
    if (j.error) throw new Error("list " + collectionPath + ": " + JSON.stringify(j.error).slice(0, 300));
    (j.documents || []).forEach((d) => out.push(d));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return out;
}
// Firestore REST value -> plain JS.
function val(f) {
  if (!f) return undefined;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.timestampValue !== undefined) return { __timestamp: f.timestampValue };
  if (f.nullValue !== undefined) return null;
  if (f.mapValue) { const o = {}; for (const [k, v] of Object.entries(f.mapValue.fields || {})) o[k] = val(v); return o; }
  if (f.arrayValue) return (f.arrayValue.values || []).map(val);
  return f;
}
// Plain JS -> Firestore REST value. Timestamps round-trip untouched.
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (v.__timestamp) return { timestampValue: v.__timestamp };
  if (typeof v === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  }
  throw new Error("cannot encode value of type " + typeof v);
}
function docFields(doc) {
  const o = {};
  for (const [k, v] of Object.entries(doc.fields || {})) o[k] = val(v);
  o._id = doc.name.split("/").pop();
  o._name = doc.name;
  return o;
}

// Mint the Firebase download URL for a Storage object, creating the
// download token metadata when the object has none (what the client
// SDK does on first getDownloadURL). In dry-run mode this never
// writes: a missing token is reported, not created.
async function downloadUrlFor(token, storagePath, readOnly) {
  const encPath = encodeURIComponent(storagePath);
  const metaUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encPath}`;
  const metaRes = await fetch(metaUrl, { headers: { Authorization: "Bearer " + token } });
  if (metaRes.status === 404) return null; // render file gone — nothing to link
  if (!metaRes.ok) throw new Error("metadata GET failed: " + metaRes.status);
  const meta = await metaRes.json();
  let dlToken = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
  if (!dlToken) {
    if (readOnly) return "WOULD-CREATE-TOKEN";
    dlToken = crypto.randomUUID();
    const patchRes = await fetch(metaUrl, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: dlToken } }),
    });
    if (!patchRes.ok) throw new Error("metadata PATCH failed: " + patchRes.status);
  }
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encPath}?alt=media&token=${dlToken}`;
}

(async () => {
  const token = await founderToken();
  const items = (await listDocs(token, `users/${UID}/items`, 100)).map(docFields);
  let needFix = 0;
  let fixed = 0;
  let skipped = 0;
  for (const it of items) {
    const photos = it.photos || [];
    let changed = false;
    for (const p of photos) {
      if (p.renderStoragePath && p.renderStatus === "passed" && !p.renderUrl) {
        needFix++;
        const url = await downloadUrlFor(token, p.renderStoragePath, !APPLY);
        if (!url) { console.log(`SKIP ${it._id} (${it.name}): render file missing at ${p.renderStoragePath}`); skipped++; continue; }
        if (!APPLY) { console.log(`WOULD FIX ${it._id} (${it.name}): ${p.renderStoragePath}${url === "WOULD-CREATE-TOKEN" ? " (token would be created)" : ""}`); continue; }
        p.renderUrl = url;
        changed = true;
      }
    }
    if (changed) {
      const patchUrl = `https://firestore.googleapis.com/v1/${it._name}?updateMask.fieldPaths=photos`;
      const body = { fields: { photos: enc(photos) } };
      const r = await fetch(patchUrl, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`photos PATCH failed for ${it._id}: ` + (await r.text()).slice(0, 200));
      fixed++;
      console.log(`FIXED ${it._id} (${it.name})`);
    }
  }
  console.log(APPLY ? `done: ${fixed} items fixed, ${skipped} skipped` : `dry run: ${needFix} photo entries need renderUrl (run with --apply to write)`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
