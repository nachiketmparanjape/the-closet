// PC-62 guards: the app shell must stay under LinkedIn's scrape
// limit (founder report 2026-11-21). LinkedIn's Post Inspector
// refused the URL because the page was 3,725,337 bytes — over the
// 3,145,728-byte threshold — so its crawler never read the OG
// tags. The weight was the four base64-inlined brand fonts (3.0MB);
// they are external files now. If the shell creeps back over the
// limit, link previews die again silently. House style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const htmlPath = path.join(__dirname, "..", "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

const LINKEDIN_LIMIT = 3145728;

test("the served shell is under LinkedIn's 3MB scrape limit", () => {
  const bytes = fs.statSync(htmlPath).size;
  assert.ok(bytes < LINKEDIN_LIMIT, `index.html is ${bytes} bytes, over the ${LINKEDIN_LIMIT}-byte scrape limit`);
});

test("no font is base64-inlined in the shell anymore", () => {
  assert.ok(!html.includes("data:application/octet-stream;base64"), "an inlined font data URI is back");
});

test("all four brand fonts are referenced as external files", () => {
  for (const name of ["ClosetSans-400", "ClosetSans-600", "ClosetSerif-500", "ClosetSerif-600"]) {
    assert.ok(html.includes(`url("/fonts/${name}.ttf")`), `@font-face src for ${name} missing`);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "public", "fonts", `${name}.ttf`)), `public/fonts/${name}.ttf missing`);
  }
});

test("the primary fonts are preloaded for first paint", () => {
  assert.ok(html.includes('<link rel="preload" as="font" type="font/ttf" href="/fonts/ClosetSans-400.ttf" crossorigin />'), "Sans 400 preload missing");
  assert.ok(html.includes('<link rel="preload" as="font" type="font/ttf" href="/fonts/ClosetSerif-600.ttf" crossorigin />'), "Serif 600 preload missing");
});
