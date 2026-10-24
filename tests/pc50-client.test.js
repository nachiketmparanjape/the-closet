// PC-50 park guards: the shop-check link route shipped and
// was REMOVED the same day (2026-10-24, founder call — link
// fetching is too store-dependent to offer users; paste is
// the sanctioned path). What must survive the removal: the
// shared context snapshot the photo flow also uses, and the
// reportError-only rule for catch blocks (the logError
// ghost froze both link buttons — OPERATIONS rule 8).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the link route is gone from the check sheet (parked)", () => {
  assert.ok(!html.includes('id="shopLinkInput"'), "link input still present");
  assert.ok(!html.includes('id="shopLinkBtn"'), "check-link button still present");
  assert.ok(!html.includes("startShopCheckFromPath"), "link check entry still present");
});

test("the context snapshot stays one shared helper for the photo flow", () => {
  assert.ok(html.includes("function snapshotShopContext()"), "helper missing");
  assert.ok(html.includes("function callShopCheckAnalysis()"), "shared analysis caller missing");
  assert.ok(html.includes("var snap = snapshotShopContext();"), "photo flow no longer snapshots via the helper");
});

test("no logError ghosts anywhere in the client", () => {
  assert.ok(!html.includes("logError("), "a logError( call survives — that function does not exist");
});
