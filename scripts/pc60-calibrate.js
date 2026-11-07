/**
 * PC-60 calibration script.
 *
 * Runs the unified cutout check against the calibration set and reports
 * agreement with the founder's verdicts, per checklist item.
 *
 * The bar (founder-validated 2026-11-04): 95% agreement, <2% false-pass.
 * If the check does not meet the bar, thresholds are tuned (not guessed)
 * and the report is re-run. The report is filed before the gate is turned on.
 *
 * Calibration set:
 *   - All items with a standardized photo (founder-approved = pass).
 *   - Known failures (founder-rejected = fail) — listed in KNOWN_FAILURES
 *     by item id, with the reason the founder gave.
 *
 * Usage: node scripts/pc60-calibrate.js [--vision] [--limit N]
 *   --vision: also run the Gemini vision judge (costs ~$0.001/cut).
 *             Without it, only the mask geometry layer runs (free).
 *   --limit N: only check the first N items (for a quick smoke test).
 *
 * Scale note: this script runs against one user's items (the founder's).
 * The calibration set must grow beyond the founder before thresholds apply
 * to all users — see the design doc.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Known failures: item id -> founder's verdict reason.
// These are cuts the founder saw and rejected. Add to this list as
// new failures are found (with the date and the reason).
const KNOWN_FAILURES = {
  // The broken 0.54 cut (2026-10-28): scored 0.54, was broken.
  // The bag-strap cut (2026-10-27): BiRefNet left a bag strap on.
  // The Qwen inventions (2026-10-28): invented ZARA label, deleted sleeves.
  // TODO: fill in real item ids from the founder's notes.
};

async function main() {
  const args = process.argv.slice(2);
  const runVision = args.includes("--vision");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  // Auth: reuse the token-exchange from deploy scripts.
  const deployUpdateSrc = fs.readFileSync(
    path.join(__dirname, "..", "deploy-update.js"), "utf8"
  );
  const cid = deployUpdateSrc.match(/CLIENT_ID\s*=\s*['"]([^'"]+)['"]/)[1];
  const sec = deployUpdateSrc.match(/CLIENT_SECRET\s*=\s*['"]([^'"]+)['"]/)[1];
  const rt = fs.readFileSync(
    path.join(process.env.HOME, ".config", "firebase-ci-token"), "utf8"
  ).trim();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: rt,
      client_id: cid,
      client_secret: sec,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    console.error("Token exchange failed:", JSON.stringify(tokenJson).slice(0, 200));
    process.exit(1);
  }
  const at = tokenJson.access_token;

  // Founder uid (from the studio's known user).
  const uid = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
  const listRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/closet-404e9/databases/(default)/documents/users/${uid}/items?pageSize=100&mask.fieldPaths=name&mask.fieldPaths=photos&mask.fieldPaths=standardization&mask.fieldPaths=category`,
    { headers: { Authorization: `Bearer ${at}` } }
  );
  const listJson = await listRes.json();
  const docs = listJson.documents || [];

  const { runCutoutCheck } = require("../functions/cutout-check");

  let total = 0;
  let agreements = 0;
  let falsePass = 0;
  let falseFail = 0;
  const byReason = {};
  const failures = [];

  for (const doc of docs.slice(0, limit)) {
    const id = doc.name.split("/").pop();
    const fields = doc.fields || {};
    const photos = ((fields.photos || {}).arrayValue || {}).values || [];
    const stdPhoto = photos.find((p) => {
      const pf = (p.mapValue || {}).fields || {};
      return ((pf.type || {}).stringValue || "") === "standardized";
    });
    if (!stdPhoto) continue;
    const pf = (stdPhoto.mapValue || {}).fields || {};
    const url = (pf.url || {}).stringValue || "";
    if (!url) continue;

    // Expected label: pass unless in KNOWN_FAILURES.
    const expectedPass = !(id in KNOWN_FAILURES);

    // Download the cutout.
    let cutoutBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      cutoutBuffer = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      continue;
    }

    // Original photo: first non-standardized photo, or the same URL.
    const origPhoto = photos.find((p) => {
      const f = (p.mapValue || {}).fields || {};
      return ((f.type || {}).stringValue || "") !== "standardized";
    });
    let origBuffer = cutoutBuffer;
    if (origPhoto) {
      const of = (origPhoto.mapValue || {}).fields || {};
      const origUrl = (of.url || {}).stringValue || "";
      if (origUrl) {
        try {
          const res = await fetch(origUrl);
          if (res.ok) origBuffer = Buffer.from(await res.arrayBuffer());
        } catch (e) { /* fall back to cutout */ }
      }
    }

    // Run the check (mask geometry only unless --vision).
    let callModel = null;
    if (runVision) {
      // Vision judge needs a model call — wire Gemini here.
      // For now, skip (the vision layer is tested separately).
      console.log("  --vision: vision judge not yet wired in this script (mask only).");
      callModel = null;
    }
    const result = await runCutoutCheck({
      originalBuffer: origBuffer,
      cutoutBuffer,
      expected: null, // aspect check needs original dims; skip for now
      callModel,
      category: ((fields.category || {}).stringValue || ""),
      name: ((fields.name || {}).stringValue || ""),
    });

    total++;
    const agree = result.pass === expectedPass;
    if (agree) agreements++;
    else if (result.pass && !expectedPass) falsePass++;
    else if (!result.pass && expectedPass) falseFail++;

    for (const r of result.reasons) {
      byReason[r] = (byReason[r] || 0) + 1;
    }
    if (!agree) {
      failures.push({
        id,
        name: ((fields.name || {}).stringValue || "?").slice(0, 30),
        expected: expectedPass ? "pass" : "fail",
        got: result.pass ? "pass" : "fail",
        reasons: result.reasons,
      });
    }
  }

  console.log("\n=== PC-60 Calibration Report ===");
  console.log(`Items checked: ${total}`);
  console.log(`Agreement: ${agreements}/${total} (${total ? (100 * agreements / total).toFixed(1) : 0}%)`);
  console.log(`False-pass (dangerous): ${falsePass} (${total ? (100 * falsePass / total).toFixed(1) : 0}%)`);
  console.log(`False-fail (annoying): ${falseFail} (${total ? (100 * falseFail / total).toFixed(1) : 0}%)`);
  console.log(`\nBar: 95% agreement, <2% false-pass.`);
  const meetsBar = total > 0 && agreements / total >= 0.95 && falsePass / total < 0.02;
  console.log(`Meets bar: ${meetsBar ? "YES" : "NO"}`);
  console.log(`\nReasons fired:`);
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r}: ${n}`);
  }
  if (failures.length) {
    console.log(`\nDisagreements:`);
    for (const f of failures) {
      console.log(`  ${f.id} (${f.name}): expected ${f.expected}, got ${f.got} — ${f.reasons.join(", ")}`);
    }
  }
  console.log(`\nNote: mask-geometry layer only. Vision judge not yet wired (--vision is a stub).`);
}

main().catch((e) => {
  console.error("Calibration failed:", e.message);
  process.exit(1);
});
