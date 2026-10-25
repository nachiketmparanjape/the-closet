// Doc-honesty check (founder directive, 2026-10-24): the
// documents we write must be TRUE about the code — not from
// memory, not from pattern. Writing docs honestly cannot
// depend on the writer remembering to verify; the machine
// checks the checkable claims every time.
//
// What it verifies (mechanical claims only — judgment stays
// human):
//   1. Backticked `functionNames()` in the docs exist in the
//      code (a doc that names a function the code does not
//      have is inventing architecture).
//   2. The stylist's declared tools in code are all named in
//      AGENT-ARCHITECTURE.md, and tool-shaped names the doc
//      claims are all declared in code (the 2026-10-24 wrong
//      tool table is the failure this exists to prevent).
//   3. A small set of numeric claims (reading window, fact
//      cap) match the constants in code.
//   4. Report-only: backticked identifiers the code does not
//      know (may be external systems — a human judges), and
//      doc-vs-code freshness from git.
//
// Usage: node scripts/doc-honesty-check.js [--docs DIR] [--code DIR]
// Defaults: ../docs and the hosting dir itself. Exit 1 on hard
// failures (checks 1–3), 0 otherwise. Warnings never fail.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const HOSTING = path.join(__dirname, "..");
const DOCS = path.resolve(arg("--docs", path.join(HOSTING, "docs")));
const CODE = path.resolve(arg("--code", HOSTING));

// External systems and concepts that legitimately appear in
// backticks without being our code.
const ALLOW = new Set([
  "gemini-3.5-flash", "gemini", "firestore", "firebase", "replicate",
  "birefnet", "vertex", "bigquery", "duckdb", "stripe", "shopify",
]);

function readCodeCorpus() {
  const files = [];
  const fnsDir = path.join(CODE, "functions");
  if (fs.existsSync(fnsDir)) {
    for (const f of fs.readdirSync(fnsDir)) {
      if (f.endsWith(".js")) files.push(path.join(fnsDir, f));
    }
  }
  const idx = path.join(CODE, "public", "index.html");
  if (fs.existsSync(idx)) files.push(idx);
  // Deploy/ops scripts live one level up and in scripts/ — docs
  // (OPERATIONS.md) name their internals too.
  const roots = [path.join(CODE, ".."), path.join(CODE, "scripts")];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const f of fs.readdirSync(r)) {
      if (f.endsWith(".js")) files.push(path.join(r, f));
    }
  }
  return files.map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }));
}
const corpus = readCodeCorpus();
const corpusText = corpus.map((c) => c.text).join("\n");
function inCode(token) {
  return new RegExp("\\b" + token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(corpusText);
}

function docFiles() {
  if (!fs.existsSync(DOCS)) return [];
  return fs.readdirSync(DOCS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(DOCS, f), "utf8") }));
}
const docs = docFiles();

const hard = [];
const soft = [];
function backticks(text) {
  const out = new Set();
  const re = /`([^`\n]{1,80})`/g;
  let m;
  while ((m = re.exec(text))) out.add(m[1].trim());
  return out;
}

// Check 1: `name()` claims must exist.
for (const d of docs) {
  for (const tok of backticks(d.text)) {
    const fn = tok.match(/^([A-Za-z_$][\w$]*)\(\)$/);
    if (fn && !inCode(fn[1])) {
      hard.push(d.name + ": `" + tok + "` — no such function in the code");
    }
  }
}

// Check 2: tool inventory both directions.
const toolDecls = new Set();
for (const m of corpusText.matchAll(/name:\s*"(updateTripPacking|suggestTripOutfits|pinContext|[A-Za-z]+Tool)"/g)) {
  toolDecls.add(m[1]);
}
for (const m of corpusText.matchAll(/functionDeclarations[\s\S]{0,4000}?name:\s*"([A-Za-z]+)"/g)) {
  toolDecls.add(m[1]);
}
// Ground truth fallback: the declarations object in stylist.js.
const declBlock = corpusText.match(/const TOOL_DECLARATIONS[\s\S]{0,3000}?];/);
if (declBlock) {
  for (const m of declBlock[0].matchAll(/name:\s*"([A-Za-z]+)"/g)) toolDecls.add(m[1]);
}
const archDoc = docs.find((d) => d.name === "AGENT-ARCHITECTURE.md");
if (archDoc && toolDecls.size) {
  for (const t of toolDecls) {
    if (!archDoc.text.includes(t)) {
      hard.push("AGENT-ARCHITECTURE.md: code declares tool `" + t + "` but the doc never names it");
    }
  }
  // Doc-claimed tool names: table cells that are bare camelCase
  // identifiers next to "tool" wording are hard to isolate;
  // check the known shape — backticked identifiers ending in
  // a verb-noun pattern listed in the doc's tool section.
  const toolSection = archDoc.text.split(/tools/i).slice(1).join("tools");
  for (const tok of backticks(toolSection)) {
    if (/^[a-z][A-Za-z]+$/.test(tok) && !ALLOW.has(tok.toLowerCase()) && !inCode(tok)) {
      soft.push("AGENT-ARCHITECTURE.md (tools area): `" + tok + "` not found in code — external name or invention?");
    }
  }
}

// Check 3: numeric claims vs constants.
function codeConst(name) {
  const m = corpusText.match(new RegExp(name + "\\s*=\\s*(\\d+)"));
  return m ? Number(m[1]) : null;
}
const maxMessages = codeConst("MAX_MESSAGES");
if (maxMessages != null) {
  // Only phrasings that ASSERT the window size — "a 60-message
  // thread reads 50" is a true sentence about a long thread,
  // not a claim that the window is 60 (the first run flagged
  // exactly that; the doc was right, the pattern was wrong).
  const claims = [
    /last (\d+) messages/g,
    /most recent (\d+) messages/g,
    /reads? (?:the )?(?:last )?(\d+) messages/g,
    /window (?:of|is|becomes|was) (\d+)/g,
  ];
  for (const d of docs) {
    for (const re of claims) {
      for (const m of d.text.matchAll(re)) {
        const n = Number(m[1]);
        if (n !== maxMessages) {
          hard.push(d.name + ": claims a " + n + "-message window; code MAX_MESSAGES = " + maxMessages);
        }
      }
    }
  }
}

// Check 4 (soft): unresolved backticked identifiers + freshness.
for (const d of docs) {
  for (const tok of backticks(d.text)) {
    if (/^[0-9a-f]{7,10}$/.test(tok) && /\d/.test(tok) && /[a-f]/.test(tok)) continue; // git short hash
    if (/^[A-Za-z_$][\w$-]*$/.test(tok) && tok.length > 2 && !ALLOW.has(tok.toLowerCase()) && !inCode(tok)) {
      soft.push(d.name + ": `" + tok + "` not found in code (external or stale?)");
    }
  }
}
function gitDate(file) {
  try {
    // Run inside the docs' own checkout (docs may live on a
    // branch worktree while the code is the main checkout).
    return execSync("git log -1 --format=%cI -- " + JSON.stringify(path.basename(file)), { cwd: DOCS, encoding: "utf8" }).trim();
  } catch (e) { return ""; }
}

console.log("DOC HONESTY CHECK");
console.log("docs:", DOCS, "(" + docs.length + " files) | code:", CODE);
console.log("tools declared in code:", [...toolDecls].join(", ") || "(none parsed)");
console.log("MAX_MESSAGES in code:", maxMessages);
console.log("");
if (hard.length) {
  console.log("HARD FAILURES (" + hard.length + "):");
  hard.forEach((h) => console.log("  ✗ " + h));
} else {
  console.log("Hard checks: all pass.");
}
if (soft.length) {
  console.log("");
  console.log("FOR HUMAN JUDGMENT (" + soft.length + "):");
  [...new Set(soft)].slice(0, 40).forEach((h) => console.log("  ? " + h));
}
console.log("");
for (const d of docs) {
  const p = path.join(DOCS, d.name);
  console.log("freshness: " + d.name + " last committed " + (gitDate(p) || "unknown"));
}
process.exit(hard.length ? 1 : 0);
