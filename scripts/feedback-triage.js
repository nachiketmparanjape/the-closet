#!/usr/bin/env node
// Feedback triage I/O for the Closet app's `feedback` collection (FB-1).
// Same OAuth refresh flow as deploy-*.js; no secrets live in this file
// (client id/secret are read from deploy-update.js, refresh token from
// ~/.config/firebase-ci-token — both gitignored).
//
//   node feedback-triage.js list
//     -> JSON array of untriaged docs: [{id, text, view, uid, userAgent, createdAt}]
//   node feedback-triage.js triage <docId> --outcome "<one-liner>"
//     -> stamps triagedAt + triageOutcome on the doc
//   node feedback-triage.js clear <docId> --outcome "<one-liner>" --archive-log <path>
//     -> appends a snippet to the archive log, then deletes the doc
//
// Lifecycle: new -> triaged (into the studio inbox) -> cleared. Clearing is
// hygiene for the console, not cost: a feedback doc is ~1KB; the Firestore
// free tier holds ~a million of them.

const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getToken() {
  const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const clientId = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const clientSecret = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  if (!clientId || !clientSecret) throw new Error("could not read OAuth client from deploy-update.js");
  const refresh = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: clientId,
      client_secret: clientSecret, refresh_token: refresh,
    }),
  }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error("token exchange failed: " + JSON.stringify(j).slice(0, 200));
    return j.access_token;
  });
}

const strVal = (f) => (f && f.stringValue) || "";
const tsVal = (f) => (f && f.timestampValue) || "";

function toJson(doc) {
  const id = doc.name.split("/").pop();
  const f = doc.fields || {};
  return {
    id,
    text: strVal(f.text),
    view: strVal(f.view),
    uid: strVal(f.uid),
    userAgent: strVal(f.userAgent),
    createdAt: tsVal(f.createdAt) || doc.createTime,
  };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const token = await getToken();
  const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  if (cmd === "list") {
    // NB: orderBy=createTime silently returns zero docs on this API;
    // volumes are tiny, so no server-side ordering.
    const res = await fetch(`${BASE}/feedback?pageSize=100`, { headers: H });
    const j = await res.json();
    if (!res.ok) throw new Error("list failed: " + JSON.stringify(j).slice(0, 300));
    const docs = (j.documents || []).filter((d) => !(d.fields && d.fields.triagedAt));
    console.log(JSON.stringify(docs.map(toJson), null, 1));
    return;
  }

  const getArg = (flag) => {
    const i = rest.indexOf(flag);
    return i === -1 ? null : rest[i + 1];
  };

  if (cmd === "triage" || cmd === "clear") {
    const id = rest[0];
    const outcome = getArg("--outcome") || "";
    if (!id) throw new Error("doc id required");
    // Fetch first so the archive log captures the text even on clear.
    const getRes = await fetch(`${BASE}/feedback/${id}`, { headers: H });
    const doc = await getRes.json();
    if (!getRes.ok) throw new Error("get failed: " + JSON.stringify(doc).slice(0, 300));
    const flat = toJson(doc);

    if (cmd === "triage") {
      const now = new Date().toISOString();
      const patchRes = await fetch(
        `${BASE}/feedback/${id}?updateMask.fieldPaths=triagedAt&updateMask.fieldPaths=triageOutcome`,
        {
          method: "PATCH", headers: H,
          body: JSON.stringify({ fields: {
            triagedAt: { timestampValue: now },
            triageOutcome: { stringValue: outcome.slice(0, 500) },
          }}),
        });
      if (!patchRes.ok) throw new Error("triage failed: " + (await patchRes.text()).slice(0, 300));
      console.log(`triaged ${id}`);
      return;
    }

    // clear: archive then delete
    const logPath = getArg("--archive-log");
    const entry = [
      `=== ${new Date().toISOString()} ${id} ===`,
      `outcome: ${outcome}`,
      `view: ${flat.view} | uid: ${flat.uid}`,
      `userAgent: ${flat.userAgent}`,
      `text: ${flat.text.slice(0, 500)}`,
      "",
    ].join("\n");
    if (logPath) fs.appendFileSync(logPath, entry);
    const delRes = await fetch(`${BASE}/feedback/${id}`, { method: "DELETE", headers: H });
    if (!delRes.ok) throw new Error("delete failed: " + (await delRes.text()).slice(0, 300));
    console.log(`cleared ${id} (archived${logPath ? "" : " — no log path!"})`);
    return;
  }

  throw new Error("usage: list | triage <id> --outcome <t> | clear <id> --outcome <t> --archive-log <p>");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
