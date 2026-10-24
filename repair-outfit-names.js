"use strict";
// One-off repair (2026-10-24): outfit shortNames that are just the
// first piece's name (NAMING-1's fallback) become anchor-pair
// combo names ("Grey sweater + Cream corduroy"). Outfits with a
// real name (a stylist look name or a typed builder name — i.e.
// `name` does not embed the first item's full name) get
// capShortName(name) instead. Dry-run by default; --apply writes.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { capShortName } = require("./functions/shortname");

const PROJECT = "closet-404e9";
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
const APPLY = process.argv.includes("--apply");
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

async function accessToken() {
  const rulesSrc = fs.readFileSync(path.join(__dirname, "deploy-firestore-rules.js"), "utf8");
  const clientId = (rulesSrc.match(/CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const clientSecret = (rulesSrc.match(/CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  const refreshToken = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("no access token");
  return j.access_token;
}
const sv = (fields, field) => {
  const f = fields && fields[field];
  return f && typeof f.stringValue === "string" ? f.stringValue : null;
};
const av = (fields, field) => {
  const f = fields && fields[field];
  return f && f.arrayValue && Array.isArray(f.arrayValue.values)
    ? f.arrayValue.values.map((v) => v.stringValue).filter(Boolean) : [];
};
async function listAll(tok, coll) {
  const out = [];
  let pageToken = "";
  for (;;) {
    const url = `${BASE}/users/${UID}/${coll}?pageSize=300` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
    const j = await res.json();
    (j.documents || []).forEach((d) => out.push(d));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}
function comboName(itemIds, itemShortById) {
  const parts = itemIds.map((id) => {
    const n = (itemShortById[id] || "").trim();
    return n ? n.split(/\s+/).slice(0, 2).join(" ") : null;
  }).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return capShortName(parts[0]);
  return capShortName(parts[0] + " + " + parts[1]);
}

(async () => {
  const tok = await accessToken();
  const items = await listAll(tok, "items");
  const itemShortById = {};
  for (const d of items) {
    const id = d.name.split("/").pop();
    itemShortById[id] = sv(d.fields, "shortName") || sv(d.fields, "name") || "";
  }
  const outfits = await listAll(tok, "outfits");
  let changed = 0;
  for (const d of outfits) {
    const id = d.name.split("/").pop();
    const name = sv(d.fields, "name") || "";
    const cur = sv(d.fields, "shortName");
    const itemIds = av(d.fields, "itemIds");
    const itemNames = av(d.fields, "itemNames");
    const firstFull = itemNames[0] || "";
    const named = name && !(firstFull && name.includes(firstFull));
    const expected = named ? capShortName(name) : comboName(itemIds, itemShortById);
    const tag = named ? "named" : "combo";
    if (!expected || expected === cur) {
      console.log("OK  ", id, "|", cur);
      continue;
    }
    changed++;
    console.log("FIX ", id, "|", tag, "|", JSON.stringify(cur), "→", JSON.stringify(expected));
    if (APPLY) {
      const url = `${BASE}/users/${UID}/outfits/${id}?updateMask.fieldPaths=shortName`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { shortName: { stringValue: expected } } }),
      });
      if (!res.ok) console.log("  PATCH FAILED", res.status, await res.text());
    }
  }
  console.log(`${APPLY ? "APPLIED" : "DRY-RUN"}: ${changed} outfits to fix of ${outfits.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
