// UX-16 (Sprint 32): context-handoff audit — every surface that
// opens the stylist must carry its subject into the payload, or be
// intentionally context-free. Each row below pins the wiring that
// the 2026-11-23 audit verified in public/index.html; if a future
// cut drops a handoff, this file fails first.
// Run from hosting/: node --test "tests/*.test.js"
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function must(fragment, why) {
  assert.ok(html.includes(fragment), why);
}

// The payload itself: every subject has a named field.
test("sendChat carries every subject field", () => {
  must("todayPick: todayPickCtx,", "todayPick missing from the payload");
  must("shopItem: tripChat ? null : currentShopAttach(),", "shopItem missing from the payload");
  must("references: {", "references missing from the payload");
  must("articleIds: chatRefs.articles.map(function (r) { return r.id; }),", "article refs missing from the payload");
  must("payload.tripContext = {", "tripContext missing from the payload");
  must("demoWardrobe: demoChat === true,", "demoWardrobe missing from the payload");
  must("payload.rejectedOutfits = rejected;", "rejectedOutfits missing from the payload");
});

// Today: the 2026-10-24 bug. The Ask button attaches the pick.
test("Today Ask attaches the pick (todayPick)", () => {
  must("attachTodayPick();", "todayAsk does not attach today's pick");
  must("function todayAsk()", "todayAsk missing");
});

// Piece doors: the piece rides as an @-reference (articleIds).
test("piece doors attach the piece as a reference", () => {
  must("chatRefs.articles.push({ kind: \"article\", id: item.id,", "Build a look does not attach the piece");
  must("chatInput.value = \"Build a look around this piece.\";", "Build a look sets no prompt text");
  must("if (!chatRefs.articles.some(function (a) { return a.id === r.id; })) chatRefs.articles.push(r);", "item page Style button does not attach the piece");
});

// Trip doors: the trip rides as tripContext.
test("trip doors carry the trip (tripContext)", () => {
  must("tripChat = { tripId: tripId };", "openTripChat does not set the trip");
  must("openTripChat(trip.id);", "no trip page door into trip chat");
});

// Shop doors: the check rides as shopItem.
test("shop doors attach the check (shopItem)", () => {
  must("chatAttachShopByThread[activeThreadKey] = item;", "askStylistAboutShop does not attach the check");
  must("askStylistBtn.addEventListener(\"click\", function () { askStylistAboutShop(r); });", "shop detail has no Ask door");
  must("openStylistBtn.addEventListener(\"click\", function () {", "follow-up sheet has no Open-in-chat door");
});

// The follow-up sheet's own Ask: a direct call, still carrying.
test("shop follow-up Ask carries the check and the trip", () => {
  must("var shopItem = shopItemFromCheck(r);", "follow-up Ask does not resolve the check");
  must("shopItem: shopItem,", "follow-up Ask does not send the check");
  must("tripContext: tripCtx", "follow-up Ask does not send the trip");
});

// Intentionally context-free: the generic room and Surprise me
// carry no subject — the request itself is the message text.
test("generic room and Surprise me carry no subject by design", () => {
  must("document.getElementById(\"chatFab\").addEventListener(\"click\", openChat);", "chatFab is not the generic door");
  must("\"Surprise me — pick an outfit in a vibe I rarely wear, something unexpected.\";", "Surprise me text missing");
});

// The composer and Today auto-compose carry their subject as the
// message text itself (occasion / rejection reason), not a field.
test("composer and Today auto-compose carry the subject as message text", () => {
  must("if (composerOccasion) parts.push(\"Occasion: \" + composerOccasion + \".\");", "composer does not put the occasion in the message");
  must("I just rejected your last pick: \" + reasonNote", "Today auto-compose does not carry the rejection reason");
});

// The PC-66 add-flow follow-up names the new pieces in its message.
test("add-flow follow-up names the new pieces", () => {
  must("\"(I just added these pieces to my wardrobe: \" + applied.names.join(\", \")", "add-flow follow-up does not name the pieces");
});
