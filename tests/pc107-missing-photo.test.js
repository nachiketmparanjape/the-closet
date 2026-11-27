// PC-107: the sweatshirt's stored photo files were deleted from
// Storage (both 404 "No such object"), so its item page, tiles and
// packing rows showed a blank cream box — and a missing photo had
// no placeholder anywhere. A photo that cannot load at all now
// shows a named placeholder (a data-URI SVG) instead of a blank
// box, on every surface that renders a display photo.
// Run from hosting/: node --test tests/pc107-missing-photo.test.js
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

const photoPlaceholderDataUri = extractClientFn("photoPlaceholderDataUri", "name");
const handleDisplayPhotoError = extractClientFn("handleDisplayPhotoError", "imgEl, item");
const handleDisplayPhotoLoad = extractClientFn("handleDisplayPhotoLoad", "imgEl");
const showDisplayPhoto = extractClientFn("showDisplayPhoto", "imgEl, item, view, fit45");

function fakeImg(src) {
  return {
    src: src || "",
    dataset: {},
    style: {},
    onerror: null,
    onload: null,
    getAttribute: function (k) { return k === "src" ? this.src : null; },
  };
}

describe("photoPlaceholderDataUri", function () {
  test("a valid image source carrying 'Photo missing' and the item name", function () {
    const uri = photoPlaceholderDataUri("Burgundy yellow sweatshirt");
    assert.ok(uri.startsWith("data:image/svg+xml,"));
    const svg = decodeURIComponent(uri.replace("data:image/svg+xml,", ""));
    assert.match(svg, /Photo missing/);
    assert.match(svg, /Burgundy yellow sweatshirt/);
    assert.match(svg, /<svg[^>]*>/);
  });

  test("XML specials are escaped, never breaking the SVG", function () {
    const uri = photoPlaceholderDataUri("Tee & <cap> \"quoted\"");
    const svg = decodeURIComponent(uri.replace("data:image/svg+xml,", ""));
    assert.doesNotMatch(svg, /Tee & <cap>/);
    assert.match(svg, /Tee &amp; &lt;cap&gt; &quot;quoted&quot;/);
  });

  test("a long name is truncated to 28 characters", function () {
    const uri = photoPlaceholderDataUri("A very long garment name that goes on and on");
    const svg = decodeURIComponent(uri.replace("data:image/svg+xml,", ""));
    assert.match(svg, /A very long garment name tha/);
    assert.doesNotMatch(svg, /goes on and on/);
  });

  test("no name falls back to 'This piece'", function () {
    const svg = decodeURIComponent(photoPlaceholderDataUri(null).replace("data:image/svg+xml,", ""));
    assert.match(svg, /This piece/);
  });
});

describe("handleDisplayPhotoError: retry, fallback, placeholder", function () {
  const item = {
    shortName: "Burgundy yellow sweatshirt",
    photos: [{ url: "https://example.com/original.jpg", renderUrl: "https://example.com/render.png" }],
  };
  test("the sweatshirt's case: dead render, dead original → placeholder, never a blank box", function () {
    global.photoPlaceholderDataUri = photoPlaceholderDataUri;
    const img = fakeImg("https://example.com/render.png");
    handleDisplayPhotoError(img, item); // 1st: cache-busted retry
    assert.match(img.src, /cb=\d+/);
    handleDisplayPhotoError(img, item); // 2nd: fall back to the original
    assert.equal(img.src, "https://example.com/original.jpg");
    handleDisplayPhotoError(img, item); // 3rd: the original is dead too → placeholder
    assert.ok(img.src.startsWith("data:image/svg+xml,"));
    assert.match(decodeURIComponent(img.src), /Burgundy yellow sweatshirt/);
  });

  test("an error on the placeholder itself does nothing — no retry loop", function () {
    global.photoPlaceholderDataUri = photoPlaceholderDataUri;
    const img = fakeImg(photoPlaceholderDataUri("Black tee"));
    const before = img.src;
    handleDisplayPhotoError(img, item);
    assert.equal(img.src, before);
  });

  test("a successful load resets the retry state", function () {
    const img = fakeImg("https://example.com/render.png");
    img.dataset.loadFailedFor = "https://example.com/render.png";
    img.dataset.loadFails = "1";
    handleDisplayPhotoLoad(img);
    assert.equal(img.dataset.loadFailedFor, undefined);
    assert.equal(img.dataset.loadFails, undefined);
  });

  test("a new URL after a snapshot refresh starts the retry count over", function () {
    global.photoPlaceholderDataUri = photoPlaceholderDataUri;
    const img = fakeImg("https://example.com/render.png");
    img.dataset.loadFailedFor = "https://example.com/render.png";
    img.dataset.loadFails = "2";
    img.src = "https://example.com/render-v2.png"; // snapshot refresh set a new URL
    handleDisplayPhotoError(img, item);
    assert.match(img.src, /render-v2\.png\?cb=\d+/, "a new base URL retries once, it does not jump to the placeholder");
  });
});

describe("showDisplayPhoto wires the recovery", function () {
  function installGlobals() {
    global.photoPlaceholderDataUri = photoPlaceholderDataUri;
    global.handleDisplayPhotoError = handleDisplayPhotoError;
    global.handleDisplayPhotoLoad = handleDisplayPhotoLoad;
    global.resolveDisplayPhoto = function (item) {
      const photos = (item && item.photos) || [];
      if (!photos.length) return null;
      const photo = photos[0];
      return { photo: photo, url: photo.renderUrl || photo.url || "", rotationDeg: 0 };
    };
  }
  test("an item with no photos gets the placeholder, not a removed src", function () {
    installGlobals();
    const img = fakeImg("");
    showDisplayPhoto(img, { name: "Empty piece", photos: [] }, "clean");
    assert.ok(img.src.startsWith("data:image/svg+xml,"));
    assert.match(decodeURIComponent(img.src), /Empty piece/);
  });

  test("a normal photo sets src + the error handler", function () {
    installGlobals();
    const img = fakeImg("");
    showDisplayPhoto(img, { name: "Navy tee", photos: [{ url: "https://example.com/navy.jpg" }] }, "clean");
    assert.equal(img.src, "https://example.com/navy.jpg");
    assert.equal(typeof img.onerror, "function");
    assert.equal(typeof img.onload, "function");
    // The wired handler recovers: first error retries cache-busted.
    img.onerror();
    assert.match(img.src, /navy\.jpg\?cb=\d+/);
  });
});

describe("source pins", function () {
  test("no display-photo path removes src any more — the blank box is gone", function () {
    assert.equal(
      (html.match(/removeAttribute\("src"\)/g) || []).length,
      0,
      "showDisplayPhoto must never leave an <img> src-less"
    );
  });
});

describe("dialogPhotoNeedsRefresh (Sprint 40: the snapshot must not restart the error chain)", function () {
  const dialogPhotoNeedsRefresh = extractClientFn("dialogPhotoNeedsRefresh", "currentSrc, freshUrl");

  test("unchanged URL: no refresh — the error chain runs to the placeholder", function () {
    assert.equal(dialogPhotoNeedsRefresh("https://example.com/dead.jpg", "https://example.com/dead.jpg"), false);
  });

  test("a cache-busted retry URL compares equal to its base", function () {
    assert.equal(dialogPhotoNeedsRefresh("https://example.com/dead.jpg?cb=1730000000000", "https://example.com/dead.jpg"), false);
    assert.equal(dialogPhotoNeedsRefresh("https://example.com/dead.jpg?alt=media&cb=1730000000000", "https://example.com/dead.jpg?alt=media"), false);
  });

  test("a changed URL refreshes — a cutout landing, or a standardization completing", function () {
    assert.equal(dialogPhotoNeedsRefresh("https://example.com/original.jpg", "https://example.com/cutout.png"), true);
    assert.equal(dialogPhotoNeedsRefresh("https://example.com/cutout.png", "https://example.com/standardized.png"), true);
  });

  test("the placeholder stays put while the photo is still missing", function () {
    const placeholder = photoPlaceholderDataUri("Burgundy yellow sweatshirt");
    assert.equal(dialogPhotoNeedsRefresh(placeholder, null), false);
    assert.equal(dialogPhotoNeedsRefresh(placeholder, ""), false);
  });

  test("the placeholder refreshes when a real photo arrives (re-upload)", function () {
    const placeholder = photoPlaceholderDataUri("Burgundy yellow sweatshirt");
    assert.equal(dialogPhotoNeedsRefresh(placeholder, "https://example.com/readded.jpg"), true);
  });

  test("no current src always refreshes; no fresh URL refreshes so the placeholder is set", function () {
    assert.equal(dialogPhotoNeedsRefresh("", "https://example.com/x.jpg"), true);
    assert.equal(dialogPhotoNeedsRefresh(null, "https://example.com/x.jpg"), true);
    assert.equal(dialogPhotoNeedsRefresh("https://example.com/dead.jpg", null), true);
  });
});

describe("source pins (Sprint 40)", function () {
  test("the snapshot refresh gates showDisplayPhoto on the display URL changing", function () {
    assert.ok(/dialogPhotoNeedsRefresh\(itemPhoto && itemPhoto\.getAttribute\("src"\), freshPhoto && freshPhoto\.url\)/.test(html),
      "watchItems must gate the dialog photo refresh on the URL changing");
  });
});
