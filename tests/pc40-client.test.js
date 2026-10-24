// PC-40 client wiring guards. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the sheet carries the optional question field", () => {
  assert.ok(html.includes('id="shopQuestionInput"'), "question input missing");
  assert.ok(html.includes("Anything specific?"), "question label missing");
});

test("the question is snapshotted, cleared, and sent", () => {
  assert.ok(html.includes('question: (document.getElementById("shopQuestionInput").value || "").trim()'), "snapshot missing");
  assert.ok(html.includes('question: shopCheckState.question || undefined'), "payload missing");
  assert.ok(html.includes('tripId: shopCheckState.tripId || undefined'), "trip payload missing");
});

test("saved docs and the detail view carry the context", () => {
  assert.ok(html.includes("if (d.tripName) doc.tripName = d.tripName;"), "doc tripName missing");
  assert.ok(html.includes("if (d.question) doc.question = d.question;"), "doc question missing");
  assert.ok(html.includes('"You asked: “"'), "detail question line missing");
  assert.ok(html.includes('"Judged for: "'), "context line missing");
});
