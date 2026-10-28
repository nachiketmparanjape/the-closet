"use strict";

// SPIKE harness — TEMPORARY. Delete this module, its index.js
// export, the SPIKE_KEY secret, and the spikeRun function when
// the image experiments close (plan:
// docs/proposals/IMAGE-PIPELINE-EXPERIMENTS.md).
//
// Purpose: run one Replicate prediction per call, server-side,
// so the REPLICATE_API_TOKEN secret is used only inside Google
// Cloud — it never reaches a local script, a file, or chat.
// Callers authenticate with a throwaway key (the SPIKE_KEY
// secret, created for these spikes) in the x-spike-key header.
//
// POST JSON: { model: "owner/name", input: { ... } }
// Response JSON: { status, predictionId, predictSeconds,
// output, error, storedPath? } — when the prediction output
// contains a file URL, the file is also copied into Storage
// under spikes/ so it outlives Replicate's expiring URLs.

const { getStorage } = require("firebase-admin/storage");

const API_BASE = "https://api.replicate.com/v1";
const POLL_MS = 3000;
const MAX_WAIT_MS = 270000;

async function createPrediction(model, input, apiKey) {
  const res = await fetch(API_BASE + "/models/" + model + "/predictions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      Prefer: "wait=55",
    },
    body: JSON.stringify({ input }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      "replicate create " + res.status + ": " + JSON.stringify(j).slice(0, 300)
    );
  }
  return j;
}

function firstFileUrl(output) {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    for (const o of output) {
      const u = firstFileUrl(o);
      if (u) return u;
    }
  } else if (output && typeof output === "object") {
    for (const k of Object.keys(output)) {
      const u = firstFileUrl(output[k]);
      if (u) return u;
    }
  }
  return null;
}

async function spikeRunHandler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST only" });
      return;
    }
    const expected = process.env.SPIKE_KEY;
    if (!expected || req.get("x-spike-key") !== expected) {
      res.status(403).json({ error: "bad key" });
      return;
    }
    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });
      return;
    }
    const body = req.body || {};
    const model = String(body.model || "");
    const input = body.input || {};
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(model)) {
      res.status(400).json({ error: "model must be owner/name" });
      return;
    }
    const started = Date.now();
    let pred = await createPrediction(model, input, apiKey);
    const deadline = started + MAX_WAIT_MS;
    while (pred && (pred.status === "starting" || pred.status === "processing")) {
      if (Date.now() > deadline) {
        res.status(504).json({ status: "timeout", predictionId: pred.id });
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
      const r2 = await fetch(pred.urls.get, {
        headers: { Authorization: "Bearer " + apiKey },
      });
      pred = await r2.json();
    }
    const out = {
      status: pred.status,
      predictionId: pred.id,
      predictSeconds:
        (pred.metrics && pred.metrics.predict_time) || null,
      output: pred.output || null,
      error: pred.error || null,
    };
    const fileUrl = firstFileUrl(pred.output);
    if (fileUrl) {
      try {
        const fr = await fetch(fileUrl);
        const buf = Buffer.from(await fr.arrayBuffer());
        const m = fileUrl.split("?")[0].match(/\.(png|jpe?g|webp)$/i);
        const ext = m ? m[1].toLowerCase() : "png";
        const storedPath =
          "spikes/" +
          new Date().toISOString().replace(/[:.]/g, "-") +
          "-" +
          model.replace("/", "-") +
          "." +
          ext;
        await getStorage()
          .bucket()
          .file(storedPath)
          .save(buf, {
            contentType: fr.headers.get("content-type") || "image/png",
          });
        out.storedPath = storedPath;
      } catch (e) {
        out.storeError = String((e && e.message) || e);
      }
    }
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}

module.exports = { spikeRunHandler, firstFileUrl };
