// Shared REST adapters for VM-side scripts that touch live Firestore /
// Storage with the saved user OAuth token (the CI service account key
// has no Firestore access). Extracted from the one-off retest script
// (scripts/retest-sweatshirt.js, 2026-11-27) for reuse by
// scripts/standardize-sweeper.js (PC-106) and future scripts. The
// retest script keeps its inline copies as a frozen one-off.
// No secrets are printed or stored here — the token comes from the
// refresh token in ~/.config/firebase-ci-token at run time.
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT = "closet-404e9";
const BUCKET = "closet-404e9.firebasestorage.app";

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

// --- Firestore value conversion (subset: the shapes items use) ---
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
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
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

function docUrl(docPath) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
}

// A Firestore-shaped db: db.collection("users").doc(uid).collection("items")
// .doc(itemId) gives an itemRef with .get()/.update(); db.runTransaction
// runs the function with a minimal transaction object.
function makeDb(token) {
  const docRef = (docPath) => ({
    get: async () => {
      const res = await fetch(docUrl(docPath), { headers: { Authorization: "Bearer " + token } });
      if (res.status === 404) return { exists: false, data: () => null };
      if (!res.ok) throw new Error("Firestore GET failed: " + res.status + " " + (await res.text()).slice(0, 200));
      const doc = await res.json();
      return { exists: true, data: () => fromFields(doc.fields || {}) };
    },
    update: async (dotted) => {
      const { fields, mask } = dottedToBody(dotted);
      const qs = mask.map((m) => "updateMask.fieldPaths=" + encodeURIComponent(m)).join("&");
      const res = await fetch(docUrl(docPath) + "?" + qs, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error("Firestore PATCH failed: " + res.status + " " + (await res.text()).slice(0, 200));
    },
    collection: (name) => collectionRef(docPath + "/" + name),
  });
  const collectionRef = (collPath) => ({ doc: (id) => docRef(collPath + "/" + id) });
  return {
    collection: (name) => collectionRef(name),
    // The Admin SDK's t.update is synchronous-fire; the REST adapter's
    // update is a promise. Collect the updates and await them after the
    // callback returns — otherwise a rejection escapes as an unhandled
    // rejection and crashes the process instead of reaching the caller
    // (PC-106 live run: the final pending_review write threw this way).
    runTransaction: async (fn) => {
      const pending = [];
      await fn({ update: (ref, data) => { pending.push(ref.update(data)); } });
      await Promise.all(pending);
    },
  };
}

// List documents in a collection (one page). Returns the raw REST body:
// { documents: [...], nextPageToken }.
async function listDocs(token, collectionPath, pageToken) {
  const url = docUrl(collectionPath) + "?pageSize=100" + (pageToken ? "&pageToken=" + pageToken : "");
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) throw new Error("Firestore LIST failed: " + res.status + " " + (await res.text()).slice(0, 200));
  return res.json();
}

// A Storage-shaped bucket: the four calls the standardization pipeline
// uses (getMetadata / setMetadata / save / makePublic).
function makeBucket(token, bucketName = BUCKET) {
  return {
    name: bucketName,
    file: (storagePath) => {
      const enc = encodeURIComponent(storagePath);
      const metaUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${enc}`;
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
            `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${enc}`,
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

module.exports = { PROJECT, BUCKET, accessToken, fromValue, fromFields, toValue, dottedToBody, makeDb, listDocs, makeBucket };
