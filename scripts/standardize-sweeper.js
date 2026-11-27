// PC-106 (2026-11-26): Standardization sweeper — the safety net under
// the direct call. The client calls standardizeItem after every item
// creation, but a call can never be sent (offline, app closed, crash).
// This script finds items with NO standardization status at all — the
// direct call never ran — and runs the pipeline for them in-process
// (same repo code as the callable, REST-backed db/bucket adapters).
// It never touches items that already have a status: processing,
// failed, ready, already_clean, pending_review and rejected are all
// someone else's decision (the stuck-sweeper owns stuck processing;
// the founder retries failed ones by hand).
//
// Grace period: 10 minutes past creation, so a just-created item whose
// direct call is still in flight is never raced. Per-user cap: 5 items
// per user per run, so one user's backlog never starves the rest.
// Run budget: stop starting new items after 20 minutes.
//
// Run by cron every 30 minutes; silent on no-op, logs what it heals.
//
// Usage: node scripts/standardize-sweeper.js [--dry-run]
const fs = require("fs");
const path = require("path");
const os = require("os");
const { accessToken, fromFields, makeDb, listDocs, makeBucket } = require("./rest-adapters");

const DRY_RUN = process.argv.includes("--dry-run");
// Grace period: an item younger than this may still be getting its
// direct call — leave it alone.
const GRACE_MS = 10 * 60 * 1000;
// Per-user cap per run (scale rule: no user starves another).
const PER_USER_CAP = 5;
// Stop starting new items after this long (a run is 30 min apart).
const RUN_BUDGET_MS = 20 * 60 * 1000;

// True when the item has no standardization status at all and is old
// enough that its direct call should have landed by now. `item` is a
// plain object (fromFields); createdAt is an ISO timestamp string or
// absent (old items predate the field — treat as old).
function needsStandardization(item, nowMs) {
  if (!item || item.standardization) return false;
  const photos = Array.isArray(item.photos) ? item.photos : [];
  if (!photos.length) return false;
  const createdMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
  if (!Number.isNaN(createdMs) && nowMs - createdMs < GRACE_MS) return false;
  return true;
}

// Cap each user's candidates at PER_USER_CAP, preserving scan order.
function pickBatch(candidates) {
  const perUser = {};
  const picked = [];
  for (const c of candidates) {
    perUser[c.uid] = (perUser[c.uid] || 0) + 1;
    if (perUser[c.uid] <= PER_USER_CAP) picked.push(c);
  }
  return picked;
}

async function main() {
  const token = await accessToken();
  const falApiKey = fs.readFileSync(path.join(os.homedir(), ".config", "fal-key"), "utf8").trim();
  const db = makeDb(token);
  const bucket = makeBucket(token);
  const { runStandardizationPipeline } = require("../functions/standardize-pipeline");
  const nowMs = Date.now();
  const startedAt = Date.now();
  let checked = 0;
  let candidates = [];

  const users = await listDocs(token, "users");
  for (const u of users.documents || []) {
    const uid = u.name.split("/").pop();
    let pageToken = null;
    do {
      const items = await listDocs(token, `users/${uid}/items`, pageToken);
      for (const doc of items.documents || []) {
        checked++;
        const item = fromFields(doc.fields || {});
        if (needsStandardization(item, nowMs)) {
          candidates.push({ uid, itemId: doc.name.split("/").pop(), item });
        }
      }
      pageToken = items.nextPageToken;
    } while (pageToken);
  }

  const batch = pickBatch(candidates);
  console.log(`sweeper scan: checked=${checked} missing=${candidates.length} batch=${batch.length}${DRY_RUN ? " (dry run)" : ""}`);
  let healed = 0;
  for (const c of batch) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) {
      console.log("sweeper: run budget reached, stopping");
      break;
    }
    const itemRef = db.collection("users").doc(c.uid).collection("items").doc(c.itemId);
    console.log(`HEAL: users/${c.uid}/items/${c.itemId} (${c.item.name || "unnamed"})`);
    if (DRY_RUN) continue;
    // The callable's non-force bookkeeping, then the pipeline.
    await itemRef.update({
      "standardization.status": "processing",
      "standardization.attempts": 1,
      "standardization.lastAttemptAt": new Date().toISOString(),
    });
    try {
      await runStandardizationPipeline({ db, bucket, uid: c.uid, itemId: c.itemId, item: c.item, falApiKey });
      const after = await itemRef.get();
      const std = (after.data() || {}).standardization || {};
      console.log(`  healed: status=${std.status}`);
      healed++;
    } catch (pipeErr) {
      await itemRef.update({
        "standardization.status": "failed",
        "standardization.lastError": String(pipeErr.message).slice(0, 200),
      });
      console.log(`  failed: ${pipeErr.message}`);
      healed++;
    }
  }

  console.log(`sweeper done: checked=${checked} healed=${healed}${DRY_RUN ? " (dry run)" : ""}`);
}

if (require.main === module) {
  main().catch((e) => { console.error("sweeper failed:", e.message); process.exit(1); });
}

module.exports = { needsStandardization, pickBatch, GRACE_MS, PER_USER_CAP, RUN_BUDGET_MS };
