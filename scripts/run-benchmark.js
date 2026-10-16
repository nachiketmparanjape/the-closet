// Stylist benchmark runner (Sprint 5, E1).
//
// Sends each scenario in tests/benchmark/scenarios.js through the REAL
// prompt (via stylist.js buildStylistRequest) + the real model on Vertex,
// and saves the outputs for founder judging.
//
// Usage: node scripts/run-benchmark.js [label]
//   label defaults to a timestamp. Results go to tests/benchmark/results/<label>.json
//   and a judging-friendly summary prints to stdout.
//
// Auth: reuses the Firebase CI OAuth flow (same as deploy-update.js).
// Model/location: read from stylist.js's own request builder — the
// benchmark always tests what the code would actually send.
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildStylistRequest, mapOutfitToIds } = require("../functions/stylist");
const { SCENARIOS } = require("../tests/benchmark/scenarios");

async function accessToken() {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "deploy-update.js"), "utf8"
  );
  const cid = src.match(/CLIENT_ID = "([^"]+)"/)[1];
  const csec = src.match(/CLIENT_SECRET = "([^"]+)"/)[1];
  const refreshToken = fs
    .readFileSync(path.join(os.homedir(), ".config", "firebase-ci-token"), "utf8")
    .trim();
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: cid,
      client_secret: csec,
      refresh_token: refreshToken,
    }),
  });
  const json = await tr.json();
  if (!tr.ok) throw new Error("token exchange failed");
  return json.access_token;
}

async function runScenario(at, scenario) {
  const { model, contents, config } = buildStylistRequest(
    scenario.wardrobe,
    scenario.messages,
    scenario.styleProfile
  );
  // Mirror getClient()'s endpoint choice: 3.x models serve from global.
  const url =
    "https://aiplatform.googleapis.com/v1/projects/closet-404e9" +
    "/locations/global/publishers/google/models/" + model + ":generateContent";
  const body = {
    contents,
    // REST needs the Content shape; the SDK accepts a bare string.
    systemInstruction: { role: "system", parts: [{ text: config.systemInstruction }] },
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      thinkingConfig: config.thinkingConfig,
      responseMimeType: config.responseMimeType,
    },
  };
  const started = Date.now();
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 180000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      const ms = Date.now() - started;
      if (!res.ok) {
        return { id: scenario.id, error: "HTTP " + res.status + ": " + JSON.stringify(json).slice(0, 200), ms };
      }
      return finishOk(scenario, json, ms);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      console.log("(attempt " + attempt + " failed: " + (e.message || e) + ", retrying)");
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  return { id: scenario.id, error: "fetch failed after 3 attempts: " + (lastErr && lastErr.message), ms: Date.now() - started };
}

function finishOk(scenario, json, ms) {
  const text = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parseError = e.message;
  }
  // Validate the outfit against the scenario wardrobe, like the server does.
  let mapped = null;
  if (parsed && parsed.outfit) {
    try {
      mapped = mapOutfitToIds(parsed.outfit, scenario.wardrobe);
    } catch (e) {
      parseError = (parseError ? parseError + "; " : "") + "mapOutfitToIds: " + e.message;
    }
  }
  return {
    id: scenario.id,
    ms,
    finishReason: json.candidates?.[0]?.finishReason,
    thoughtTokens: json.usageMetadata?.thoughtsTokenCount ?? null,
    outputTokens: json.usageMetadata?.candidatesTokenCount ?? null,
    reply: parsed ? parsed.reply : null,
    outfitRaw: parsed ? parsed.outfit : null,
    outfitMapped: mapped,
    parseError,
    rawText: parseError ? text.slice(0, 500) : undefined,
    checks: scenario.checks,
  };
}

async function main() {
  const label = process.argv[2] || new Date().toISOString().replace(/[:.]/g, "-");
  const at = await accessToken();
  console.log("Benchmark label:", label);
  const results = [];
  for (const s of SCENARIOS) {
    process.stdout.write("  " + s.id + " ... ");
    const r = await runScenario(at, s);
    console.log(r.error || (r.parseError ? "PARSE-FAIL" : "ok (" + r.ms + "ms)"));
    results.push(r);
  }
  const dir = path.join(__dirname, "..", "tests", "benchmark", "results");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, label + ".json");
  fs.writeFileSync(file, JSON.stringify({ label, at: new Date().toISOString(), results }, null, 2));
  console.log("\nSaved:", file);

  // Judging summary
  console.log("\n================ JUDGING SUMMARY ================\n");
  for (const r of results) {
    console.log("## " + r.id + (r.error ? "  [ERROR: " + r.error + "]" : ""));
    if (r.error) continue;
    const sc = SCENARIOS.find((s) => s.id === r.id);
    console.log("Request:", sc.messages.map((m) => m.text).join(" / "));
    if (r.parseError) console.log("PARSE FAIL:", r.parseError);
    console.log("Outfit:", JSON.stringify(r.outfitMapped));
    console.log("Reasoning:", (r.outfitRaw && r.outfitRaw.reasoning) || "(none)");
    console.log("Reply:", (r.reply || "").slice(0, 300));
    console.log("Checks to judge:");
    for (const c of r.checks) console.log("  [ ] " + c);
    console.log("");
  }
}

main().catch((e) => { console.error("BENCHMARK FAILED:", e.message); process.exit(1); });
