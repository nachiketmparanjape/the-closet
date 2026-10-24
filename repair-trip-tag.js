"use strict";
// One-off repair (2026-10-24): the founder's shop check from tonight
// (the 'Hot Girls for Zohran' graphic tee) saved WITHOUT its trip
// tag — the pending-trip context was being cleared when he picked
// the photo source (fixed in the client the same night). This lists
// his trips + untagged shop checks; with --apply <checkId> <tripId>
// it PATCHes tripId onto exactly that check doc.
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT = "closet-404e9";
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
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
const sv = (doc, field) => {
  const f = doc && doc.fields && doc.fields[field];
  return f && typeof f.stringValue === "string" ? f.stringValue : null;
};
const idOf = (doc) => doc.name.split("/").pop();

(async () => {
  const tok = await accessToken();
  const H = { Authorization: "Bearer " + tok };
  const applyIdx = process.argv.indexOf("--apply");
  if (applyIdx !== -1) {
    const checkId = process.argv[applyIdx + 1];
    const tripId = process.argv[applyIdx + 2];
    if (!checkId || !tripId) throw new Error("usage: --apply <checkId> <tripId>");
    const url = `${BASE}/users/${UID}/shopChecks/${checkId}?updateMask.fieldPaths=tripId`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { tripId: { stringValue: tripId } } }),
    });
    const j = await res.json();
    console.log("PATCH status", res.status, "tripId now:", sv(j, "tripId"));
    return;
  }
  const tripsRes = await fetch(`${BASE}/users/${UID}/trips?pageSize=20`, { headers: H });
  const trips = (await tripsRes.json()).documents || [];
  for (const t of trips) {
    const legs = t.fields && t.fields.legs && t.fields.legs.arrayValue && t.fields.legs.arrayValue.values || [];
    const leg0 = legs[0] && legs[0].mapValue && legs[0].mapValue.fields;
    const legStr = leg0 ? [sv({ fields: leg0 }, "resolvedName") || sv({ fields: leg0 }, "location"), sv({ fields: leg0 }, "startDate"), "→", sv({ fields: leg0 }, "endDate")].join(" ") : "(no legs)";
    console.log("TRIP", idOf(t), "name:", sv(t, "name"), "| leg:", legStr);
  }
  const checksRes = await fetch(`${BASE}/users/${UID}/shopChecks?pageSize=50`, { headers: H });
  const checks = (await checksRes.json()).documents || [];
  for (const c of checks) {
    const item = c.fields && c.fields.item && c.fields.item.mapValue && c.fields.item.mapValue.fields;
    const note = item ? sv({ fields: item }, "note") : null;
    const name = item ? sv({ fields: item }, "name") : null;
    console.log("CHECK", idOf(c), "| tripId:", sv(c, "tripId"), "| status:", sv(c, "status"), "| created:", c.createTime, "| item:", name, "|", (note || "").slice(0, 80));
  }
})().catch((e) => { console.error(e); process.exit(1); });
