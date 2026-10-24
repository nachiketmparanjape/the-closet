// PC-46 wiring guards: the check's outfit previews must show
// the CANDIDATE in the outfit (ringed, captioned, leading),
// with owned pieces named — in both the fresh result and the
// saved-check detail (one shared renderer). String-level.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the section is See it in an outfit", () => {
  assert.ok(html.includes('"See it in an outfit"'), "section title missing");
  assert.ok(!html.includes('"It would work with"'), "old title should be gone");
});

test("the candidate leads each preview, ringed and captioned", () => {
  assert.ok(html.includes('"shop-fig candidate"'), "candidate figure missing");
  assert.ok(html.includes("thumbs.insertBefore(cfig, thumbs.firstChild)"), "candidate must lead");
  assert.ok(html.includes(".shop-fig.candidate img"), "candidate ring CSS missing");
});

test("owned pieces render as captioned figures with real names", () => {
  assert.ok(html.includes('el("figure", "shop-fig")'), "figure missing");
  assert.ok(html.includes("it2.shortName || it2.name"), "caption must use the piece name");
});

test("the fragment guard survives (no outfit from <2 owned pieces)", () => {
  assert.ok(html.includes("if (rendered < 2) return;"), "guard missing");
});
