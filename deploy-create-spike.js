// deploy-create-extract.js — deploy-create.js variant for extractGarment (PC-34):
// 120s timeout + REPLICATE_API_TOKEN secret binding (provider swap
// to BiRefNet, 2026-10-23). Gitignored.
// Usage: node deploy-create.js <FunctionId>
// Never prints tokens or keys. Gitignored.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT = "closet-404e9";
const LOCATION = "us-central1";
const FUNCTION_ID = process.argv[2];
if (!FUNCTION_ID) { console.error("Usage: node deploy-create.js <FunctionId>"); process.exit(1); }
const CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";
const FUNCS_DIR = path.join(os.homedir(), "workspace", "wardrobe-app", "hosting", "functions");

async function api(url, accessToken, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { res, json, text };
}

async function main() {
  const refreshToken = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) throw new Error("Token exchange failed");
  const AT = tokenJson.access_token;

  execSync(`cd ${FUNCS_DIR} && rm -f /tmp/func-src.zip && zip -qr /tmp/func-src.zip . -x "node_modules/*" -x "*.log"`, { stdio: "pipe" });
  console.log("source zipped");

  // The VM egress flakes on some Google POSTs; retry with backoff.
  async function withRetry(label, fn, tries) {
    let lastErr = null;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        console.log(label + " attempt " + (i + 1) + " failed: " + e.message);
        await new Promise((r) => setTimeout(r, 8000 * (i + 1)));
      }
    }
    throw lastErr;
  }

  const gen = await withRetry("generateUploadUrl", async () => {
    const g = await api(`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${LOCATION}/functions:generateUploadUrl`, AT, { method: "POST", body: "{}" });
    if (!g.res.ok) throw new Error("status " + g.res.status);
    return g;
  }, 5);
  await withRetry("source upload", async () => {
    const putRes = await fetch(gen.json.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/zip" },
      body: fs.readFileSync("/tmp/func-src.zip"),
    });
    if (!putRes.ok) throw new Error("status " + putRes.status);
  }, 5);
  console.log("source uploaded");

  // v2 create: the body must include the full resource name; env vars
  // live in serviceConfig.
  const create = await withRetry("function create", async () => {
    const c = await api(
      `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${LOCATION}/functions?functionId=${FUNCTION_ID}`,
      AT,
      {
        method: "POST",
        body: JSON.stringify({
          name: `projects/${PROJECT}/locations/${LOCATION}/functions/${FUNCTION_ID}`,
          buildConfig: {
            runtime: "nodejs20",
            entryPoint: FUNCTION_ID,
            source: { storageSource: gen.json.storageSource },
          },
          serviceConfig: {
            timeoutSeconds: 300,
            availableMemory: "512Mi",
            maxInstanceCount: 5,
            ingressSettings: "ALLOW_ALL",
            environmentVariables: {
              GCLOUD_PROJECT: PROJECT,
              VERTEX_LOCATION: "global",
              GEMINI_MODEL: "gemini-3.5-flash",
            },
            secretEnvironmentVariables: [
              { key: "REPLICATE_API_TOKEN", projectId: PROJECT, secret: "REPLICATE_API_TOKEN", version: "latest" },
              { key: "SPIKE_KEY", projectId: PROJECT, secret: "SPIKE_KEY", version: "latest" },
            ],
          },
        }),
      }
    );
    if (!c.res.ok) throw new Error("status " + c.res.status + ": " + c.text.slice(0, 200));
    return c;
  }, 4);
  console.log("create operation started:", create.json.name);

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const op = await api(`https://cloudfunctions.googleapis.com/v2/${create.json.name}`, AT);
    if (!op.res.ok) throw new Error("poll: " + op.text.slice(0, 150));
    if (op.json.done) {
      if (op.json.error) throw new Error("failed: " + JSON.stringify(op.json.error).slice(0, 300));
      console.log("function ready");
      break;
    }
    process.stdout.write(".");
    if (i === 59) throw new Error("timed out waiting for the create operation");
  }

  // Callable functions need public Cloud Run invoker access — the Firebase
  // callable framework does its own Firebase-Auth validation per request.
  // Without this, clients get a 403 that surfaces as INTERNAL.
  // (Learned 2026-10-17: critiqueOutfit/parseOutfitPhoto shipped without it.)
  const svc = FUNCTION_ID.toLowerCase();
  await withRetry("setIamPolicy", async () => {
    const iam = await api(
      `https://run.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/services/${svc}:setIamPolicy`,
      AT,
      {
        method: "POST",
        body: JSON.stringify({
          policy: { bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] },
        }),
      }
    );
    if (!iam.res.ok) throw new Error("status " + iam.res.status + ": " + iam.text.slice(0, 200));
  }, 4);
  console.log("public invoker binding set");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
