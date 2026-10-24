// PC-44: non-photo catalogue intake — the server half. Given a
// product-page URL, fetch the page, pull the retail photo +
// title (Open Graph / Twitter card / JSON-LD), download the
// photo into the user's Storage, and hand back a storagePath.
// The client then runs the photo through the ordinary add
// flow (describe + piece form), so a link import produces a
// completely normal item whose cover photo carries a
// source: "retail" label — never a silent substitution, and
// the user's own photo can replace it anytime.
//
// Retailers that block server fetches fail friendly
// (LINK_UNREACHABLE) — scraping past a block is out of scope
// by the card. No prices, no affiliate data: title + photo
// only.
"use strict";

const { getStorage } = require("firebase-admin/storage");
const { fail } = require("./errors");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html, key) {
  // Both attribute orders, and the content capture respects
  // whichever quote opened it — real titles carry apostrophes
  // ("Men's Chore Jacket"), which a naive [^"']+ truncates.
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    '<meta[^>]+(?:property|name)="' + esc + '"[^>]+content="([^"]*)"',
    "<meta[^>]+(?:property|name)='" + esc + "'[^>]+content='([^']*)'",
    '<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="' + esc + '"',
    "<meta[^>]+content='([^']*)'[^>]+(?:property|name)='" + esc + "'",
  ];
  for (const p of patterns) {
    const m = html.match(new RegExp(p, "i"));
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

function jsonLdProduct(html) {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const raw = b.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of list) {
        if (!node || typeof node !== "object") continue;
        const graph = Array.isArray(node["@graph"]) ? node["@graph"] : [node];
        for (const g of graph) {
          if (g && (g["@type"] === "Product" || g.name)) return g;
        }
      }
    } catch (e) {
      // A malformed block says nothing; keep looking.
    }
  }
  return null;
}

// Pure + exported for tests: pull { title, image, brand } out
// of a product page's HTML. Image resolved against the page.
function extractLinkMeta(html, pageUrl) {
  const ld = jsonLdProduct(html);
  let image =
    metaContent(html, "og:image") ||
    metaContent(html, "twitter:image") ||
    null;
  if (!image && ld && ld.image) {
    image = Array.isArray(ld.image) ? ld.image[0] : ld.image;
    if (image && typeof image === "object") image = image.url || null;
  }
  let title =
    metaContent(html, "og:title") ||
    (ld && typeof ld.name === "string" ? decodeEntities(ld.name) : null);
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) title = decodeEntities(t[1]);
  }
  if (title && title.length > 80) {
    const cut = title.slice(0, 80);
    const sp = cut.lastIndexOf(" ");
    title = (sp > 40 ? cut.slice(0, sp) : cut).trim();
  }
  let brand = null;
  if (ld && ld.brand) {
    brand =
      typeof ld.brand === "string"
        ? decodeEntities(ld.brand)
        : ld.brand.name
          ? decodeEntities(ld.brand.name)
          : null;
  }
  let imageUrl = null;
  if (image) {
    try {
      imageUrl = new URL(image, pageUrl).toString();
    } catch (e) {
      imageUrl = null;
    }
  }
  return { title: title || null, imageUrl, brand };
}

function assertPublicHttpUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch (e) {
    fail("LINK_BAD_URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") fail("LINK_BAD_URL");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1"
  ) {
    fail("LINK_BAD_URL");
  }
  return u;
}

async function fetchTextWithTimeout(url, ms, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, redirect: "follow" });
    return { res, body: await res.text() };
  } finally {
    clearTimeout(t);
  }
}
async function fetchBufferWithTimeout(url, ms, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, redirect: "follow" });
    return { res, body: Buffer.from(await res.arrayBuffer()) };
  } finally {
    clearTimeout(t);
  }
}

async function fetchLinkItem(uid, rawUrl) {
  const pageUrl = assertPublicHttpUrl(rawUrl);
  let pageRes, pageBody;
  try {
    ({ res: pageRes, body: pageBody } = await fetchTextWithTimeout(pageUrl.toString(), 12000, {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
    }));
  } catch (e) {
    fail("LINK_UNREACHABLE");
  }
  if (!pageRes.ok) fail("LINK_UNREACHABLE");
  const html = String(pageBody || "").slice(0, 600000);
  const meta = extractLinkMeta(html, pageUrl.toString());
  if (!meta.imageUrl) fail("LINK_NO_IMAGE");

  let imgRes, imgBuf;
  try {
    ({ res: imgRes, body: imgBuf } = await fetchBufferWithTimeout(meta.imageUrl, 15000, { "User-Agent": UA, Referer: pageUrl.toString() }));
  } catch (e) {
    fail("LINK_UNREACHABLE");
  }
  if (!imgRes.ok) fail("LINK_UNREACHABLE");
  const ctype = (imgRes.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const extByType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  let ext = extByType[ctype];
  if (!ext) {
    const m = meta.imageUrl.split("?")[0].match(/\.(jpe?g|png|webp)$/i);
    if (m) ext = m[1].toLowerCase().replace("jpeg", "jpg");
  }
  if (!ext) fail("LINK_NO_IMAGE");
  const buf = imgBuf;
  if (!buf.length || buf.length > 10 * 1024 * 1024) fail("LINK_NO_IMAGE");

  const storagePath =
    "users/" + uid + "/link-imports/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  await getStorage()
    .bucket()
    .file(storagePath)
    .save(buf, { contentType: ctype.startsWith("image/") ? ctype : "image/" + (ext === "jpg" ? "jpeg" : ext) });
  return {
    storagePath,
    title: meta.title,
    brand: meta.brand,
    host: pageUrl.hostname.replace(/^www\./, ""),
    sourceUrl: pageUrl.toString(),
  };
}

module.exports = { fetchLinkItem, extractLinkMeta, assertPublicHttpUrl };
