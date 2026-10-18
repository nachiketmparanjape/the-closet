// PC-19 backfill: compute phash for existing item photos and write it back.
// Usage: node scripts/backfill-phash.js (reads creds like the deploy scripts).
const fs = require("fs");
const path = require("path");
const jpeg = require("/tmp/node_modules/jpeg-js");

const PROJECT = "closet-404e9";
const UID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";

function creds() {
  const src = fs.readFileSync(path.join(__dirname, "..", "deploy-firestore-rules.js"), "utf8");
  const cid = src.match(/CLIENT_ID\s*=\s*["']([^"']+)/)[1];
  const csec = src.match(/CLIENT_SECRET\s*=\s*["']([^"']+)/)[1];
  const rtok = fs.readFileSync("/home/hatch/.config/firebase-ci-token", "utf8").trim();
  return { cid, csec, rtok };
}

async function accessToken() {
  const { cid, csec, rtok } = creds();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rtok, client_id: cid, client_secret: csec }),
  });
  return (await r.json()).access_token;
}

function phashFromGray(g) {
  const N = 32, coeffs = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      if (u === 0 && v === 0) continue;
      let sum = 0;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++)
          sum += g[y * N + x] * Math.cos((Math.PI / N) * (x + 0.5) * u) * Math.cos((Math.PI / N) * (y + 0.5) * v);
      coeffs.push(sum);
    }
  }
  const sorted = coeffs.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let maxAbs = 0;
  for (const c of coeffs) maxAbs = Math.max(maxAbs, Math.abs(c));
  if (maxAbs < 1e-6) return "0000000000000000";
  let h = 0n;
  coeffs.forEach((c, i) => { if (c > med) h |= 1n << BigInt(i); });
  return h.toString(16).padStart(16, "0");
}

function downscaleGray(raw, w, h) {
  const g = new Array(1024);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const sx = Math.min(w - 1, Math.floor((x / 32) * w));
      const sy = Math.min(h - 1, Math.floor((y / 32) * h));
      const i = (sy * w + sx) * 4;
      g[y * 32 + x] = 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
    }
  }
  return g;
}

async function main() {
  const token = await accessToken();
  const H = { Authorization: "Bearer " + token };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${UID}/items?pageSize=100`;
  const docs = (await (await fetch(base, { headers: H })).json()).documents || [];
  let done = 0;
  for (const d of docs) {
    const fields = d.fields || {};
    const photos = ((fields.photos || {}).arrayValue || {}).values || [];
    let changed = false;
    for (const p of photos) {
      const pf = (p.mapValue || {}).fields || {};
      if (pf.phash) continue;
      const url = (pf.url || {}).stringValue;
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      let decoded;
      try { decoded = jpeg.decode(buf, { maxMemoryUsageInMB: 512 }); }
      catch (e) { console.log("skip (not jpeg):", url.slice(0, 60)); continue; }
      pf.phash = { stringValue: phashFromGray(downscaleGray(decoded.data, decoded.width, decoded.height)) };
      changed = true;
    }
    if (changed) {
      const name = d.name;
      await fetch(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=photos`, {
        method: "PATCH", headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { photos: { arrayValue: { values: photos } } } }),
      });
      done++;
      console.log("updated", name.split("/").pop());
    }
  }
  console.log("backfilled", done, "items");
}

main().catch((e) => { console.error(e); process.exit(1); });
