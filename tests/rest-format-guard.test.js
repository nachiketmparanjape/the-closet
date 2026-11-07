// #131 Bug #5 (2026-11-04): REST-format lint check.
// The 2026-10-31 photo-swap corruption: code mixed Firestore REST format
// ({ fields: { name: { stringValue: "x" } } }) with the Admin SDK
// (which expects plain JS objects: { name: "x" }). The Admin SDK
// silently wrote the REST envelope as data, emptying `photos` on 6 items.
//
// This guard scans server source for REST-format markers being passed to
// Admin SDK write methods. It runs as a unit test so CI catches it.
//
// REST-format markers: stringValue, integerValue, booleanValue, doubleValue,
// timestampValue, mapValue, arrayValue, bytesValue, nullValue, referenceValue,
// geoPointValue, and the top-level `fields:` envelope.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert");

const REST_MARKERS = [
  "stringValue", "integerValue", "booleanValue", "doubleValue",
  "timestampValue", "mapValue", "arrayValue", "bytesValue",
  "nullValue", "referenceValue", "geoPointValue",
];

// Admin SDK write methods that take plain JS objects (NOT REST format).
const WRITE_METHODS = ["\\.set\\(", "\\.update\\(", "\\.add\\(", "\\.create\\("];

function scanFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const lines = src.split("\n");
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments and the guard's own marker list.
    if (line.trim().startsWith("//") || line.includes("REST_MARKERS")) continue;
    for (const marker of REST_MARKERS) {
      if (line.includes(marker)) {
        // Check if this line (or nearby lines) is part of a write call.
        // Look back up to 5 lines for a write method, or forward 2 lines.
        const window = lines.slice(Math.max(0, i - 5), i + 3).join("\n");
        const isWrite = WRITE_METHODS.some((m) => new RegExp(m).test(window));
        // Also flag direct object literals with REST markers in write context.
        if (isWrite) {
          violations.push(`${filePath}:${i + 1}: REST marker "${marker}" near Admin SDK write`);
        }
      }
    }
  }
  return violations;
}

test("no REST-format payloads passed to Admin SDK writes", () => {
  const funcsDir = path.join(__dirname, "..", "functions");
  const files = fs.readdirSync(funcsDir).filter((f) => f.endsWith(".js"));
  const allViolations = [];
  for (const f of files) {
    allViolations.push(...scanFile(path.join(funcsDir, f)));
  }
  assert.deepEqual(allViolations, [], "REST-format markers found near Admin SDK writes:\n" + allViolations.join("\n"));
});
