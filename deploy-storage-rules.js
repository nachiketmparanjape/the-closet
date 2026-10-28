// Deploys storage.rules to the live Firebase Storage release.
// Mirrors deploy-firestore-rules.js, except the OAuth client
// constants are read from deploy-update.js at runtime so no
// secret is ever duplicated into a second file.
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const BUCKET = "closet-404e9.firebasestorage.app";

const upd = fs.readFileSync(path.join(__dirname, "deploy-update.js"), "utf8");
const cid = upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/)[1];
const cs = upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/)[1];

const RULES = fs.readFileSync(path.join(__dirname, "storage.rules"), "utf8");

async function main() {
  const refreshToken = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: cid, client_secret: cs, refresh_token: refreshToken }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) throw new Error("Token exchange failed");
  const H = { Authorization: "Bearer " + tokenJson.access_token, "Content-Type": "application/json" };

  const rsRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`, {
    method: "POST", headers: H,
    body: JSON.stringify({ source: { files: [{ name: "storage.rules", content: RULES }] } }),
  });
  const rsJson = await rsRes.json();
  if (!rsRes.ok) throw new Error("Create ruleset failed: " + JSON.stringify(rsJson).slice(0, 300));
  console.log("Created ruleset:", rsJson.name);

  const releaseName = `projects/${PROJECT}/releases/firebase.storage/${BUCKET}`;
  const relRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({ release: { name: releaseName, rulesetName: rsJson.name } }),
  });
  if (!relRes.ok) throw new Error("Update release failed: " + (await relRes.text()).slice(0, 300));
  console.log("Storage rules updated.");
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
