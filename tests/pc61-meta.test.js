// PC-61 guards: link-preview metadata (founder report 2026-11-20).
// LinkedIn refused the app URL because the JS-rendered page served
// no preview metadata. These tags are the whole fix — if one is
// dropped, previews break again silently. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("meta description carries PRODUCT.md's one-liner", () => {
  assert.ok(html.includes('<meta name="description" content="An AI wardrobe stylist: catalogue your clothes, get outfit picks." />'), "meta description missing or copy drifted");
});

test("Open Graph tags are complete", () => {
  assert.ok(html.includes('<meta property="og:title" content="Closet — your wardrobe, styled" />'), "og:title missing");
  assert.ok(html.includes('<meta property="og:description" content="An AI wardrobe stylist: catalogue your clothes, get outfit picks." />'), "og:description missing");
  assert.ok(html.includes('<meta property="og:type" content="website" />'), "og:type missing");
  assert.ok(html.includes('<meta property="og:url" content="https://closet-404e9.web.app/" />'), "og:url missing");
  assert.ok(html.includes('<meta property="og:image" content="https://closet-404e9.web.app/icons/icon-512.png" />'), "og:image missing");
});

test("Twitter card tags are present and match the OG copy", () => {
  assert.ok(html.includes('<meta name="twitter:card" content="summary" />'), "twitter:card missing");
  assert.ok(html.includes('<meta name="twitter:title" content="Closet — your wardrobe, styled" />'), "twitter:title missing");
  assert.ok(html.includes('<meta name="twitter:image" content="https://closet-404e9.web.app/icons/icon-512.png" />'), "twitter:image missing");
});

test("the og:image asset actually ships in public/", () => {
  const p = path.join(__dirname, "..", "public", "icons", "icon-512.png");
  assert.ok(fs.existsSync(p), "icon-512.png missing from public/icons/");
});
