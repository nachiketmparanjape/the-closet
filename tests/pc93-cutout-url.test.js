// PC-93: a cutout made from a photo never shows on the saved item.
// Founder report 2026-11-26 (mirror outfit photo; the sweatshirt's
// cutout "is not generated"). Cause, proven in live data: the parse
// flow cuts the garment (SAM-3 render stored, renderStatus "passed")
// and the review sheet shows it (URL minted in memory only), but
// outfitParsePhotoEntry never persisted renderUrl — so
// photoDisplayUrl fell back to the original photo on every surface.
// Fix: mint the render URL at confirm time (mintParseRenderUrls,
// one retry, never blocks the save) and stash it on the garment;
// outfitParsePhotoEntry carries it onto the photo entry. The
// backfill script (scripts/backfill-render-urls.js) heals items
// created before the fix. Run from hosting/:
// node --test "tests/*.test.js"
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractClientFn(name, args) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + args + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + args + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(args.split(",").map((a) => a.trim()).filter(Boolean), body);
}

const outfitParsePhotoEntry = extractClientFn("outfitParsePhotoEntry", "garment, ctx");
const mintParseRenderUrls = extractClientFn("mintParseRenderUrls", "kept");
const photoDisplayUrl = extractClientFn("photoDisplayUrl", "photo");

const CTX = { photoUrl: "https://example.com/outfit.jpg", storagePath: "users/u/outfit-photos/x.jpg" };
const RENDER_PATH = "users/u/renders/abc123.png";
const RENDER_URL = "https://example.com/renders/abc123.png?alt=media&token=t";

function garmentWithRender() {
  return { id: "g0", renderStoragePath: RENDER_PATH, rotation: 0 };
}

describe("outfitParsePhotoEntry", function () {
  test("carries the minted renderUrl onto the photo entry", function () {
    const g = garmentWithRender();
    g.renderUrlForEntry = RENDER_URL;
    const entry = outfitParsePhotoEntry(g, CTX);
    assert.equal(entry.renderUrl, RENDER_URL);
    assert.equal(entry.renderStoragePath, RENDER_PATH);
    assert.equal(entry.renderStatus, "passed");
    assert.equal(entry.url, CTX.photoUrl);
  });

  test("without a minted URL the entry is exactly the old shape (no renderUrl key)", function () {
    const entry = outfitParsePhotoEntry(garmentWithRender(), CTX);
    assert.equal("renderUrl" in entry, false);
    assert.equal(entry.renderStoragePath, RENDER_PATH);
    assert.equal(entry.renderStatus, "passed");
  });
});

describe("photoDisplayUrl (the other half of the contract)", function () {
  test("prefers renderUrl when the entry has one", function () {
    assert.equal(photoDisplayUrl({ url: "orig", renderUrl: RENDER_URL }), RENDER_URL);
  });
  test("falls back to url without renderUrl", function () {
    assert.equal(photoDisplayUrl({ url: "orig" }), "orig");
  });
});

describe("mintParseRenderUrls", function () {
  function fakeStorage(behavior) {
    const calls = {};
    global.storage = {
      ref: function () {
        return {
          child: function (p) {
            return {
              getDownloadURL: function () {
                calls[p] = (calls[p] || 0) + 1;
                return behavior(p, calls[p]);
              },
            };
          },
        };
      },
    };
    return calls;
  }

  test("mints the URL onto each garment with a render", async function () {
    fakeStorage(function () { return Promise.resolve(RENDER_URL); });
    const g1 = garmentWithRender();
    const g2 = { id: "g1", renderStoragePath: "users/u/renders/def456.png", rotation: 0 };
    await mintParseRenderUrls([g1, g2]);
    assert.equal(g1.renderUrlForEntry, RENDER_URL);
    assert.equal(g2.renderUrlForEntry, RENDER_URL);
  });

  test("skips garments with no render", async function () {
    const calls = fakeStorage(function () { return Promise.resolve(RENDER_URL); });
    const g = { id: "g0", rotation: 0 };
    await mintParseRenderUrls([g]);
    assert.equal(g.renderUrlForEntry, undefined);
    assert.deepEqual(calls, {});
  });

  test("retries once after a transient mint failure", async function () {
    const calls = fakeStorage(function (p, n) {
      if (n === 1) return Promise.reject(new Error("flaky"));
      return Promise.resolve(RENDER_URL);
    });
    const g = garmentWithRender();
    await mintParseRenderUrls([g]);
    assert.equal(g.renderUrlForEntry, RENDER_URL);
    assert.equal(calls[RENDER_PATH], 2);
  });

  test("a persistent mint failure never blocks the save (resolves, no URL)", async function () {
    fakeStorage(function () { return Promise.reject(new Error("down")); });
    const g = garmentWithRender();
    await mintParseRenderUrls([g]);
    assert.equal(g.renderUrlForEntry, undefined);
  });
});

describe("source pins", function () {
  test("applyParseGarmentDecisions mints before it saves", function () {
    assert.ok(
      /function applyParseGarmentDecisions\(ctx, kept\) \{\s*\n\s*return mintParseRenderUrls\(kept\)\.then/.test(html),
      "applyParseGarmentDecisions must call mintParseRenderUrls before the save chain"
    );
  });
});
