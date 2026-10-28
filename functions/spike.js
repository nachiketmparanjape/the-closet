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

async function createPrediction(model, input, apiKey) {
  const headers = {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
    Prefer: "wait=5",
  };
  // Replicate throttles accounts without a payment method to a
  // burst of 1 create (429 with retry_after ~10s). The wrapper
  // below retries creates through that window.
  return createWithBackoff(model, input, apiKey, headers);
}

const versionCache = {};

async function resolveVersion(model, apiKey) {
  if (versionCache[model]) return versionCache[model];
  const mres = await fetch(API_BASE + "/models/" + model, {
    headers: { Authorization: "Bearer " + apiKey },
  });
  const mj = await mres.json().catch(() => null);
  const version = mj && mj.latest_version && mj.latest_version.id;
  if (!version) {
    throw new Error(
      "model lookup failed for " + model + ": " + JSON.stringify(mj).slice(0, 200)
    );
  }
  versionCache[model] = version;
  return version;
}

async function createWithBackoff(model, input, apiKey, headers) {
  // The retry counter is a LOCAL loop variable. It used to
  // live on the function object, which persists across
  // requests on a warm instance — after five lifetime 429s
  // every later create failed instantly (learned live,
  // 2026-10-27, third strike for this counter).
  for (let attempt = 0; ; attempt++) {
    // Create by version hash, always. The earlier flow probed
    // /models/{owner}/{name}/predictions first and fell back on
    // 404 — but on a burst-1 throttle the probe itself eats the
    // one allowed create, so the real create lands inside the
    // window and 429s on every retry (the likely cause of a
    // full evening of 429s; the balance theory never explained
    // spaced retries failing). One create per attempt now.
    const version = await resolveVersion(model, apiKey);
    const res = await fetch(API_BASE + "/predictions", {
      method: "POST",
      headers,
      body: JSON.stringify({ version, input }),
    });
    const j = await res.json().catch(() => null);
    if (res.status === 429 && attempt < 6) {
      const waitS = j && j.retry_after ? Number(j.retry_after) + 2 : 12;
      await new Promise((r) => setTimeout(r, waitS * 1000));
      continue;
    }
    if (!res.ok) {
      throw new Error(
        "replicate create " + res.status + ": " + JSON.stringify(j).slice(0, 300)
      );
    }
    return j;
  }
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

async function presentPrediction(pred) {
  const out = {
    status: pred.status,
    predictionId: pred.id,
    predictSeconds: (pred.metrics && pred.metrics.predict_time) || null,
    output: pred.output || null,
    error: pred.error || null,
  };
  const terminal =
    pred.status === "succeeded" ||
    pred.status === "failed" ||
    pred.status === "canceled";
  const fileUrl = terminal ? firstFileUrl(pred.output) : null;
  if (fileUrl) {
    try {
      const fr = await fetch(fileUrl);
      const buf = Buffer.from(await fr.arrayBuffer());
      const m = fileUrl.split("?")[0].match(/\.(png|jpe?g|webp)$/i);
      const ext = m ? m[1].toLowerCase() : "bin";
      const storedPath =
        "spikes/" +
        new Date().toISOString().replace(/[:.]/g, "-") +
        "-" +
        String(pred.id || "pred") +
        "." +
        ext;
      await getStorage()
        .bucket("closet-404e9.firebasestorage.app")
        .file(storedPath)
        .save(buf, {
          contentType: fr.headers.get("content-type") || "image/png",
        });
      out.storedPath = storedPath;
    } catch (e) {
      out.storeError = String((e && e.message) || e);
    }
  }
  return out;
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
    if (body.diag === true) {
      // Safe credential diagnostics: shape only, never the value.
      res.status(200).json({
        tokenPresent: Boolean(apiKey),
        tokenLength: apiKey ? apiKey.length : 0,
        tokenPrefixOk: apiKey ? apiKey.startsWith("r8_") : false,
        tokenHasWhitespace: apiKey ? /\s/.test(apiKey) : false,
        tokenTrimmedLength: apiKey ? apiKey.trim().length : 0,
      });
      return;
    }
    if (body.list === true) {
      // The account's recent predictions — settles what an
      // earlier, interrupted run actually did on the server.
      const lr = await fetch(API_BASE + "/predictions", {
        headers: { Authorization: "Bearer " + apiKey },
      });
      const lj = await lr.json().catch(() => null);
      const results = (lj && lj.results) || [];
      res.status(200).json({
        predictions: results.slice(0, 8).map((p) => ({
          id: p.id,
          status: p.status,
          created_at: p.created_at,
          error: p.error || null,
        })),
      });
      return;
    }
    if (body.poll) {
      // One status read per call. Long predictions are polled
      // by the CALLER in short requests — a cold community
      // container can take minutes to boot, and holding one
      // HTTP request open for the whole run kept dying
      // against timeouts (learned live, 2026-10-27).
      const pr = await fetch(
        API_BASE + "/predictions/" + encodeURIComponent(String(body.poll)),
        { headers: { Authorization: "Bearer " + apiKey } }
      );
      const pred = await pr.json().catch(() => null);
      if (!pr.ok || !pred) {
        res.status(502).json({ error: "poll failed: " + pr.status });
        return;
      }
      res.status(200).json(await presentPrediction(pred));
      return;
    }
    const model = String(body.model || "");
    const input = body.input || {};
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(model)) {
      res.status(400).json({ error: "model must be owner/name" });
      return;
    }
    const pred = await createPrediction(model, input, apiKey);
    res.status(200).json({ status: pred.status, predictionId: pred.id });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}

module.exports = { spikeRunHandler, firstFileUrl };
