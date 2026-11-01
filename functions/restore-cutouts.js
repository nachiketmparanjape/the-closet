"use strict";
// One-off: Run SAM 3 cutouts for the 5 items corrupted by PC-58 Bug #5.
// Restores the cutout as photos[0] (type='cutout'), original as photos[1] (type='actual').

const fs = require("fs");
const path = require("path");
const { createFalSegmentation, getFalSegmentation, fetchMaskBuffer, uploadToFalStorage } = require("./sam-fal");
const { maskToCutout } = require("./sam");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const FAL_KEY = fs.readFileSync(process.env.HOME + "/.config/fal-key", "utf8").trim();

// Use the Firebase CLI token for admin SDK
async function getAccessToken() {
  const rt = fs.readFileSync(process.env.HOME + "/.config/firebase-ci-token", "utf8").trim();
  const src = fs.readFileSync(path.join(__dirname, "..", "deploy-update.js"), "utf8");
  const cid = src.match(/CLIENT_ID\s*=\s*['"]([^'"]+)['"]/)[1];
  const sec = src.match(/CLIENT_SECRET\s*=\s*['"]([^'"]+)['"]/)[1];
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt, client_id: cid, client_secret: sec }),
  });
  const j = await r.json();
  return j.access_token;
}

async function main() {
  const AT = await getAccessToken();
  
  // Initialize admin SDK with the token
  process.env.GOOGLE_OAUTH_ACCESS_TOKEN = AT;
  initializeApp({ projectId: "closet-404e9", storageBucket: "closet-404e9.firebasestorage.app" });
  const db = getFirestore();
  const bucket = getStorage().bucket();
  
  const FUID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
  const items = [
    ["0ecFuT2JXAxRGCmmTm9R", "Black drawstring shorts"],
    ["3Ret25xrhiJdaveIxEwT", "Navy embroidered fruit crew"],
    ["KD1iOtTej4zKpHgvtZ2a", "Black graphic short-sleeve tee"],
    ["qPd06bygx822TjlydZy4", "Olive green jogger pants"],
    ["wXYjIf2leZoeCqTTRYg6", "Black Nike Air joggers"],
  ];

  for (const [iid, name] of items) {
    console.log(`\n=== ${name} (${iid}) ===`);
    try {
      // Get item
      const itemRef = db.collection("users").doc(FUID).collection("items").doc(iid);
      const snap = await itemRef.get();
      if (!snap.exists) { console.log("  SKIP: not found"); continue; }
      const item = snap.data();
      const photos = item.photos || [];
      if (!photos.length || !photos[0].url) { console.log("  SKIP: no photo"); continue; }
      const imageUrl = photos[0].url;
      const createdAt = item.createdAt || new Date().toISOString();
      
      console.log("  Downloading original...");
      const imgRes = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      console.log(`  Got ${imgBuffer.length} bytes`);
      
      console.log("  Submitting SAM 3...");
      const seg = await createFalSegmentation({
        apiKey: FAL_KEY,
        imageBuffer: imgBuffer,
        filename: "input.jpg",
        prompt: "the garment",
        fetchImpl: fetch,
      });
      const predictionId = seg.predictionId;
      console.log(`  Request: ${predictionId}`);
      
      // Poll
      let maskUrl = null;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const result = await getFalSegmentation({
          apiKey: FAL_KEY,
          predictionId,
          statusUrl: seg.statusUrl,
          responseUrl: seg.responseUrl,
          fetchImpl: fetch,
        });
        if (result.status === "succeeded" && result.output && result.output.pred_masks && result.output.pred_masks[0]) {
          maskUrl = result.output.pred_masks[0].url;
          break;
        }
        if (result.status === "failed") throw new Error("SAM 3 failed: " + (result.error || ""));
        if (i % 6 === 0) console.log(`  Polling... (${i*5}s)`);
      }
      if (!maskUrl) throw new Error("SAM 3 timed out");
      console.log("  Got mask");
      
      console.log("  Downloading mask...");
      const maskBuffer = await fetchMaskBuffer({ url: maskUrl, fetchImpl: fetch });
      
      console.log("  Creating cutout...");
      const cutout = await maskToCutout({ imageBuffer: imgBuffer, maskBuffer });
      
      const cutoutPath = `users/${FUID}/items/${iid}/cutout-sam3.png`;
      console.log("  Uploading cutout...");
      await bucket.file(cutoutPath).save(cutout, { contentType: "image/png" });
      const cutoutUrl = `https://firebasestorage.googleapis.com/v0/b/closet-404e9.firebasestorage.app/o/${encodeURIComponent(cutoutPath)}?alt=media`;
      
      console.log("  Updating Firestore...");
      // Preserve existing photos, put cutout first
      const existingPhotos = (item.photos || []).map(p => ({
        url: p.url,
        storagePath: p.storagePath,
        type: p.type || "actual",
        createdAt: p.createdAt || createdAt,
      }));
      const newPhotos = [
        { url: cutoutUrl, storagePath: cutoutPath, type: "cutout", createdAt: new Date().toISOString() },
        ...existingPhotos,
      ];
      await itemRef.update({ photos: newPhotos });
      console.log("  DONE");
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
  console.log("\nAll done");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
