/**
 * Backfill photo types + fix stale "ready" standardization statuses.
 *
 * Findings (2026-11-09, data-quality probe: 54 issues):
 *  - 52 photos across two users have no `type`. All verified to be
 *    originals (storagePath under items/ or outfit-photos/, none under
 *    renders/, none named cutout/standardized) — safe to tag "actual".
 *  - 2 items (KD1iOtTej4zKpHgvtZ2a, nZvhKuQXFgN9eO19zSAM) claim
 *    standardization.status="ready" with a standardizedUrl, but the
 *    standardized.png file is GONE from Storage (lost in the Oct 31
 *    Bug #5 corruption; the restore put back original + cutout only).
 *    The status is a lie. Fix: mark "failed" with a clear reason and
 *    clear the stale URLs, so the item page offers the retry CTA and
 *    the founder can re-run standardization from the phone (which
 *    genuinely re-creates the render via FLUX).
 *
 * Usage: node scripts/backfill-photo-types.js [--dry-run]
 *   --dry-run: print what would change, write nothing.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROJECT = "closet-404e9";
const DB = "(default)";

function token() {
  const src = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const cid = src.match(/CLIENT_ID\s*=\s*['"]([^'"]+)['"]/)[1];
  const sec = src.match(/CLIENT_SECRET\s*=\s*['"]([^'"]+)['"]/)[1];
  const rt = fs.readFileSync(path.join(process.env.HOME, ".config", "firebase-ci-token"), "utf8").trim();
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt, client_id: cid, client_secret: sec }),
  }).then((r) => r.json()).then((j) => j.access_token);
}

const STALE_READY = new Set(["KD1iOtTej4zKpHgvtZ2a", "nZvhKuQXFgN9eO19zSAM"]);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const at = await token();
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents`;
  const headers = { Authorization: `Bearer ${at}`, "Content-Type": "application/json" };

  let typed = 0, staleFixed = 0, itemsTouched = 0;
  for (const uid of ["67ghFBwpy3Qu7dF0sZFDH2BdRwm2", "6tY4xjZXkmNQO3UUXEd3EnCRiri1"]) {
    const list = await fetch(`${base}/users/${uid}/items?pageSize=100`, { headers }).then((r) => r.json());
    for (const doc of list.documents || []) {
      const itemId = doc.name.split("/").pop();
      const fields = doc.fields || {};
      const photos = ((fields.photos || {}).arrayValue || {}).values || [];
      let changed = false;

      // Backfill missing types on originals.
      for (const p of photos) {
        const pf = (p.mapValue || {}).fields || {};
        if (!pf.type) {
          pf.type = { stringValue: "actual" };
          typed++;
          changed = true;
        }
      }

      // Fix stale "ready" (file gone from Storage).
      const std = ((fields.standardization || {}).mapValue || {}).fields || {};
      if (STALE_READY.has(itemId) && (std.status || {}).stringValue === "ready") {
        std.status = { stringValue: "failed" };
        std.lastError = { stringValue: "standardized render lost in Oct 31 restore; re-run standardization from the item page" };
        delete std.standardizedUrl;
        delete std.standardizedStoragePath;
        staleFixed++;
        changed = true;
      }

      if (!changed) continue;
      itemsTouched++;
      if (dryRun) {
        console.log(`[dry-run] would update ${uid.slice(0, 6)}…/${itemId}`);
        continue;
      }
      // Write back photos + standardization as full fields.
      const body = { fields: {} };
      body.fields.photos = { arrayValue: { values: photos } };
      if (fields.standardization) body.fields.standardization = fields.standardization;
      const patch = await fetch(
        `${base}/users/${uid}/items/${itemId}?updateMask.fieldPaths=photos&updateMask.fieldPaths=standardization`,
        { method: "PATCH", headers, body: JSON.stringify(body) }
      );
      if (!patch.ok) {
        console.log(`FAILED ${itemId}:`, (await patch.text()).slice(0, 200));
      } else {
        console.log(`Updated ${itemId}`);
      }
    }
  }
  console.log(`\nDone${dryRun ? " (dry run)" : ""}: ${typed} photos typed, ${staleFixed} stale-ready fixed, ${itemsTouched} items touched.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
