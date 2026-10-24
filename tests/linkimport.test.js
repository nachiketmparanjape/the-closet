// PC-44: link-import extraction — the pure half of
// functions/linkimport.js. The fetch half is exercised live;
// extraction decides what a draft becomes, so it is pinned.
const test = require("node:test");
const assert = require("node:assert");
const { extractLinkMeta, assertPublicHttpUrl } = require("../functions/linkimport");

const OG_PAGE = `<!doctype html><html><head>
<title>Fallback Title — Store</title>
<meta property="og:title" content="Men's Chore Jacket">
<meta property="og:image" content="https://cdn.example.com/img/jacket.jpg">
</head><body></body></html>`;

test("Open Graph title + image win", () => {
  const m = extractLinkMeta(OG_PAGE, "https://store.example.com/p/1");
  assert.equal(m.title, "Men's Chore Jacket");
  assert.equal(m.imageUrl, "https://cdn.example.com/img/jacket.jpg");
});

test("relative og:image resolves against the page", () => {
  const html = `<meta content="/img/a.png" property="og:image"><title>Tee</title>`;
  const m = extractLinkMeta(html, "https://store.example.com/p/2");
  assert.equal(m.imageUrl, "https://store.example.com/img/a.png");
  assert.equal(m.title, "Tee");
});

test("JSON-LD product supplies name, image and brand", () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Trail Shoes","image":["https://cdn.example.com/shoe.webp"],"brand":{"@type":"Brand","name":"Salomon"}}</script>`;
  const m = extractLinkMeta(html, "https://store.example.com/p/3");
  assert.equal(m.title, "Trail Shoes");
  assert.equal(m.imageUrl, "https://cdn.example.com/shoe.webp");
  assert.equal(m.brand, "Salomon");
});

test("long titles trim at a word boundary", () => {
  const long = "Word ".repeat(30).trim();
  const html = `<meta property="og:title" content="${long}"><meta property="og:image" content="https://x.example.com/a.jpg">`;
  const m = extractLinkMeta(html, "https://store.example.com/p/4");
  assert.ok(m.title.length <= 80, "title should be capped");
  assert.ok(!m.title.endsWith("Wor"), "should not cut mid-word");
});

test("entities in titles decode", () => {
  const html = `<meta property="og:title" content="Fish &amp; Chips Tee">`;
  assert.equal(extractLinkMeta(html, "https://s.example.com/").title, "Fish & Chips Tee");
});

test("URL validation rejects junk and private hosts", () => {
  assert.throws(() => assertPublicHttpUrl("not a url"));
  assert.throws(() => assertPublicHttpUrl("ftp://example.com/x"));
  assert.throws(() => assertPublicHttpUrl("http://192.168.1.5/admin"));
  assert.throws(() => assertPublicHttpUrl("http://localhost:8080/x"));
  assert.equal(assertPublicHttpUrl("https://store.example.com/p").hostname, "store.example.com");
});
