"use strict";
// One-off: Run SAM 3 cutouts for the 5 items corrupted by PC-58 Bug #5.
// Uses REST APIs only (no Admin SDK credentials needed).

const fs = require("fs");
const { createFalSegmentation, getFalSegmentation, fetchMaskBuffer } = require("./sam-fal");
const { maskToCutout } = require("./sam");

const FAL_KEY = fs.readFileSync(process.env.HOME + "/.config/fal-key", "utf8").trim();
const AT = fs.readFileSync(process.env.HOME + "/workspace/.fb-at.txt", "utf8").trim();
const FUID = "67ghFBwpy3Qu7dF0sZFDH2BdRwm2";
const BUCKET = "closet-404e9.firebasestorage.app";

async function firestoreGet(itemId, mask) {
  const maskQs = mask.map(m => `mask.fieldPaths=${m}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/closet-404e9/databases/(default)/documents/users/${FUID}/items/${itemId}?${maskQs}`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + AT } });
  return r.json();
}

async function firestorePatch(itemId, photos) {
  const url = `https://firestore.googleapis.com/v1/projects/closet-404e9/databases/(default)/documents/users/${FUID}/items/${itemId}?updateMask.fieldPaths=photos`;
  const values = photos.map(p => ({
    mapValue: { fields: {
      url: { stringValue: p.url },
      storagePath: { stringValue: p.storagePath },
      type: { stringValue: p.type },
      createdAt: { timestampValue: p.createdAt },
    }}
  }));
  const body = JSON.stringify({ fields: { photos: { arrayValue: { values } } } });
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + AT, "Content-Type": "application/json" },
    body,
  });
  if (!r.ok) throw new Error("Firestore patch failed: " + r.status);
}

async function storageUpload(storagePath, buffer, contentType) {
  // Use the Firebase Storage REST API (upload via POST to /o with uploadType=media)
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(storagePath)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + AT,
      "Content-Type": contentType,
    },
    body: buffer,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Storage upload failed ${r.status}: ${txt.slice(0, 200)}`);
  }
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

async function main() {
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
      const doc = await firestoreGet(iid, ["photos", "createdAt", "imageUrl", "storagePath"]);
      const f = doc.fields || {};
      const photos = (f.photos?.arrayValue?.values || []).map(p => {
        const pf = p.mapValue?.fields || {};
        return {
          url: pf.url?.stringValue || "",
          storagePath: pf.storagePath?.stringValue || "",
          type: pf.type?.stringValue || "actual",
          createdAt: pf.createdAt?.timestampValue || new Date().toISOString(),
        };
      });
      // Use imageUrl as fallback if photos empty
      const imageUrl = photos[0]?.url || f.imageUrl?.stringValue || "";
      const createdAt = f.createdAt?.timestampValue || new Date().toISOString();
      if (!imageUrl) { console.log("  SKIP: no image"); continue; }

      console.log("  Downloading...");
      const imgRes = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      console.log(`  ${imgBuffer.length} bytes`);

      console.log("  SAM 3 submitting...");
      const seg = await createFalSegmentation({
        apiKey: FAL_KEY, imageBuffer: imgBuffer, filename: "input.jpg",
        prompt: "the garment", fetchImpl: fetch,
      });

      let maskUrl = null;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await getFalSegmentation({
          apiKey: FAL_KEY, predictionId: seg.predictionId,
          statusUrl: seg.statusUrl, responseUrl: seg.responseUrl, fetchImpl: fetch,
        });
        if (res.status === "succeeded" && res.output?.pred_masks?.[0]) {
          maskUrl = res.output.pred_masks[0].url;
          break;
        }
        if (res.status === "failed") throw new Error("SAM failed: " + res.error);
      }
      if (!maskUrl) throw new Error("SAM timed out");
      console.log("  Mask ready");

      const maskBuffer = await fetchMaskBuffer({ url: maskUrl, fetchImpl: fetch });
      console.log("  Cutting out...");
      const cutout = await maskToCutout({ imageBuffer: imgBuffer, maskBuffer });

      const cutoutPath = `users/${FUID}/items/${iid}/cutout-sam3.png`;
      console.log("  Uploading cutout...");
      const cutoutUrl = await storageUpload(cutoutPath, cutout, "image/png");

      console.log("  Updating Firestore...");
      const newPhotos = [
        { url: cutoutUrl, storagePath: cutoutPath, type: "cutout", createdAt: new Date().toISOString() },
        ...photos.filter(p => p.url), // keep existing valid photos
      ];
      await firestorePatch(iid, newPhotos);
      console.log("  DONE");
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
  console.log("\nAll done");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
