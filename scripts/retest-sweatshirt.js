// ONE-OFF live retest (2026-11-27): run the FIXED standardization
// pipeline against the founder's real sweatshirt item
// (FHMXDcg4NNpkdj8HsFMY), replicating the standardizeItem callable's
// force path (attempts+1, processing, pipeline, outcome). Uses the
// repo's pipeline module (identical source to what was just deployed
// to standardizeItem + autoStandardizeItem) with REST-backed
// Firestore/Storage adapters (the CI service account has no
// Firestore access; the saved user OAuth token does). Costs one
// FLUX run ($0.03) on success, two at most on a systematic failure.
// A success leaves a pending_review render for the founder to
// approve/reject in the app — the normal flow, not a side effect.
// Usage: node scripts/retest-sweatshirt.js
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const BUCKET = "closet-404e9.firebasestorage.app";
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
const ITEM_ID = "FHMXDcg4NNpkdj8HsFMY";
const DOC_PATH = `users/${UID}/items/${ITEM_ID}`;

async function accessToken() {
  const upd = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const cid = (upd.match(/const CLIENT_ID\s*=\s*"([^"]+)"/) || [])[1];
  const sec = (upd.match(/const CLIENT_SECRET\s*=\s*"([^"]+)"/) || [])[1];
  const ref = fs.readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8").trim();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: cid, client_secret: sec, refresh_token: ref }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("token exchange failed: " + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

// --- Firestore value conversion (subset: the shapes this item uses) ---
function fromValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromValue);
  if (v.mapValue) return fromFields(v.mapValue.fields || {});
  return undefined;
}
function fromFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}
function toValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === "number") return { doubleValue: v };
  throw new Error("unsupported update value: " + typeof v);
}
// Dotted update fields -> nested Firestore fields + updateMask paths.
function dottedToBody(dotted) {
  const fields = {};
  const mask = [];
  for (const [dottedPath, value] of Object.entries(dotted)) {
    mask.push(dottedPath);
    const parts = dottedPath.split(".");
    let node = fields;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { mapValue: { fields: {} } };
      node = node[parts[i]].mapValue.fields;
    }
    node[parts[parts.length - 1]] = toValue(value);
  }
  return { fields, mask };
}

function makeDb(token) {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${DOC_PATH}`;
  async function updateDoc(dotted) {
    const { fields, mask } = dottedToBody(dotted);
    const qs = mask.map((m) => "updateMask.fieldPaths=" + encodeURIComponent(m)).join("&");
    const res = await fetch(docUrl + "?" + qs, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error("Firestore PATCH failed: " + res.status + " " + (await res.text()).slice(0, 200));
  }
  const itemRef = {
    update: (dotted) => updateDoc(dotted),
    get: async () => {
      const res = await fetch(docUrl, { headers: { Authorization: "Bearer " + token } });
      if (res.status === 404) return { exists: false, data: () => null };
      if (!res.ok) throw new Error("Firestore GET failed: " + res.status);
      const doc = await res.json();
      return { exists: true, data: () => fromFields(doc.fields || {}) };
    },
  };
  return {
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => itemRef }) }) }),
    runTransaction: async (fn) => { await fn({ update: (ref, data) => ref.update(data) }); },
  };
}

function makeBucket(token) {
  return {
    name: BUCKET,
    file: (storagePath) => {
      const enc = encodeURIComponent(storagePath);
      const metaUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${enc}`;
      const auth = { Authorization: "Bearer " + token };
      return {
        getMetadata: async () => {
          const res = await fetch(metaUrl, { headers: auth });
          if (!res.ok) throw new Error("Storage metadata GET failed: " + res.status);
          const body = await res.json();
          return [{ metadata: body.metadata || {} }];
        },
        setMetadata: async (meta) => {
          const res = await fetch(metaUrl, {
            method: "PATCH",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify(meta),
          });
          if (!res.ok) throw new Error("Storage metadata PATCH failed: " + res.status);
          return [await res.json()];
        },
        save: async (buffer, opts) => {
          const res = await fetch(
            `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${enc}`,
            { method: "POST", headers: { ...auth, "Content-Type": (opts && opts.contentType) || "application/octet-stream" }, body: buffer }
          );
          if (!res.ok) throw new Error("Storage upload failed: " + res.status + " " + (await res.text()).slice(0, 200));
          return [await res.json()];
        },
        makePublic: async () => {
          const res = await fetch(metaUrl + "/acl", {
            method: "POST",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify({ entity: "allUsers", role: "READER" }),
          });
          if (!res.ok) throw new Error("Storage makePublic failed: " + res.status);
          return [await res.json()];
        },
      };
    },
  };
}

async function main() {
  const token = await accessToken();
  const falApiKey = fs.readFileSync(path.join(os.homedir(), ".config", "fal-key"), "utf8").trim();
  const db = makeDb(token);
  const bucket = makeBucket(token);
  const itemRef = db.collection("users").doc(UID).collection("items").doc(ITEM_ID);
  const snap = await itemRef.get();
  if (!snap.exists) throw new Error("item not found");
  const item = snap.data();
  const std = item.standardization || {};
  console.log("before: status=%s attempts=%s lastError=%s", std.status, std.attempts, std.lastError || "(none)");
  console.log("photos[0]: renderStatus=%s renderUrl=%s", item.photos[0].renderStatus, item.photos[0].renderUrl ? "present" : "MISSING");

  // Callable force path bookkeeping.
  const attempts = (std.attempts || 0) + 1;
  await itemRef.update({
    "standardization.status": "processing",
    "standardization.attempts": attempts,
    "standardization.lastAttemptAt": new Date().toISOString(),
  });
  console.log("marked processing (attempt %d); running pipeline...", attempts);

  const { runStandardizationPipeline } = require("../functions/standardize-pipeline.js");
  const started = Date.now();
  try {
    const result = await runStandardizationPipeline({ db, bucket, uid: UID, itemId: ITEM_ID, item, falApiKey, feedback: "" });
    console.log("PIPELINE OK in %ds: %s", Math.round((Date.now() - started) / 1000), JSON.stringify(result));
  } catch (pipeErr) {
    await itemRef.update({
      "standardization.status": "failed",
      "standardization.lastError": String(pipeErr.message).slice(0, 200),
    });
    console.log("PIPELINE FAILED in %ds: %s", Math.round((Date.now() - started) / 1000), pipeErr.message);
    process.exitCode = 1;
  }
  const after = await itemRef.get();
  const stdAfter = (after.data().standardization || {});
  console.log("after: status=%s attempts=%s inputKind=%s lastError=%s pendingUrl=%s rejected=%s",
    stdAfter.status, stdAfter.attempts, stdAfter.inputKind || "(none)", stdAfter.lastError || "(none)",
    stdAfter.pendingUrl || "(none)", stdAfter.lastRejectedStoragePath || "(none)");
}

main().catch((e) => { console.error("RETEST ERROR:", e.message); process.exit(1); });
