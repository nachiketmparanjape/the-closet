// PC-38: reference photos in the general stylist chat.
// Pinned here: (1) the sanitizer — at most 4, known image
// MIME types, plausible base64 sizes, malformed dropped;
// (2) the threading — photos attach as inlineData parts to
// the LAST user turn, and the brief carries the REFERENCE
// PHOTOS section saying they are inspiration, never
// inventory; (3) trip mode ignores them entirely (general
// chat first, per the card).
const { describe, test } = require("node:test");
const assert = require("node:assert");
const {
  buildStylistRequest, sanitizeRefImages,
} = require("../functions/stylist.js");

const IMG = { mimeType: "image/jpeg", data: "x".repeat(500) };
const ITEMS = [
  { id: "a", name: "Navy crewneck tee", category: "top" },
  { id: "b", name: "Khaki chinos", category: "bottom" },
];
const MSGS = [
  { role: "user", text: "hi" },
  { role: "model", text: "hello" },
  { role: "user", text: "more like this with what I own" },
];

function build(refImages, tripContext) {
  return buildStylistRequest(
    ITEMS, MSGS, null, null, null, null, null, null,
    tripContext || null, [], "2026-10-24",
    null, null, null, null, null, refImages || null
  );
}

describe("sanitizeRefImages", () => {
  test("keeps valid images, caps at 4", () => {
    const five = [IMG, IMG, IMG, IMG, IMG];
    assert.equal(sanitizeRefImages(five).length, 4);
    assert.deepEqual(sanitizeRefImages([IMG]), [IMG]);
  });
  test("drops bad mime, bad sizes, malformed entries", () => {
    assert.deepEqual(sanitizeRefImages([{ mimeType: "text/html", data: "x".repeat(500) }]), []);
    assert.deepEqual(sanitizeRefImages([{ mimeType: "image/png", data: "tiny" }]), []);
    assert.deepEqual(sanitizeRefImages([{ mimeType: "image/png", data: "x".repeat(2000001) }]), []);
    assert.deepEqual(sanitizeRefImages([null, "nope", {}]), []);
    assert.deepEqual(sanitizeRefImages(null), []);
    assert.deepEqual(sanitizeRefImages("nope"), []);
  });
});

describe("reference photos in the request", () => {
  test("brief names them inspiration, never inventory", () => {
    const req = build([IMG, IMG]);
    assert.match(req.config.systemInstruction, /REFERENCE PHOTOS/);
    assert.match(req.config.systemInstruction, /INSPIRATION/);
    assert.match(req.config.systemInstruction, /never put them in an outfit/);
    assert.match(req.config.systemInstruction, /attached 2 photo/);
  });
  test("images ride the LAST user turn as inlineData, after its text", () => {
    const req = build([IMG, IMG]);
    const last = req.contents[req.contents.length - 1];
    assert.equal(last.role, "user");
    assert.equal(last.parts.length, 3);
    assert.equal(last.parts[0].text, "more like this with what I own");
    assert.deepEqual(last.parts[1], { inlineData: { mimeType: "image/jpeg", data: IMG.data } });
    assert.deepEqual(last.parts[2], { inlineData: { mimeType: "image/jpeg", data: IMG.data } });
    // Earlier turns stay text-only.
    assert.equal(req.contents[0].parts.length, 1);
  });
  test("no photos → no section, plain text turns", () => {
    const req = build(null);
    assert.doesNotMatch(req.config.systemInstruction, /REFERENCE PHOTOS/);
    const last = req.contents[req.contents.length - 1];
    assert.equal(last.parts.length, 1);
  });
  test("trip mode ignores reference photos entirely", () => {
    const trip = {
      tripId: "t1", tripName: "Hong Kong",
      leg: { location: "Hong Kong", resolvedName: "Hong Kong", startDate: "2026-11-23", endDate: "2026-11-29" },
      packing: { articleIds: [], articleReasons: {}, outfits: [] },
    };
    const req = build([IMG], trip);
    assert.doesNotMatch(req.config.systemInstruction, /REFERENCE PHOTOS/);
    assert.ok(!JSON.stringify(req.contents).includes("inlineData"));
  });
});
