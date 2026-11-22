// PC-68 guards: a reported wear becomes a record. The stylist
// proposes (wornProposal, gated server-side on an outfit being
// under discussion); the user confirms on the card or taps
// "Wore it today" on an outfit card; both run the ONE logging
// path (logWearForOutfit), which saves-or-matches the outfit
// first and checks today's wear_events before writing — a
// second log the same day is a no-op, never a duplicate.
// Server parser exercised for real; client pinned by source.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { parseStylistJson } = require("../functions/stylist.js");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const stylistSrc = fs.readFileSync(path.join(__dirname, "..", "functions", "stylist.js"), "utf8");

describe("PC-68 server: the worn proposal", () => {
  it("passes through exactly \"worn\" and drops inventions", () => {
    assert.equal(parseStylistJson(JSON.stringify({ reply: "Nice — log it below.", wornProposal: "worn" }), "2026-11-21").wornProposal, "worn");
    assert.equal(parseStylistJson(JSON.stringify({ reply: "ok", wornProposal: "everything" }), "2026-11-21").wornProposal, null);
  });

  it("is gated on an outfit under discussion", () => {
    assert.ok(stylistSrc.includes("const wornProposal = (!tripContext && (previousPick || todayPick))"), "gate missing");
    assert.ok(stylistSrc.includes("WORN PROPOSAL"), "prompt section missing");
    assert.ok(stylistSrc.includes("never claim it is logged until"), "honesty rule missing");
  });
});

describe("PC-68 client: one logging path, duplicate-safe", () => {
  it("logWearForOutfit is defined once and writes wear_events", () => {
    assert.equal(html.split("function logWearForOutfit(").length - 1, 1, "logging path must exist exactly once");
    assert.ok(html.includes('collection("wear_events").doc().set({'), "wear event write missing");
  });

  it("checks today's wear_events for the outfit before writing", () => {
    assert.ok(html.includes('.where("outfitId", "==", savedId)'), "duplicate guard query missing");
    assert.ok(html.includes('if (o.wornDate === localTodayStr()) { if (done) done(true); return; }'), "same-day local no-op missing");
  });

  it("saves or matches the outfit first so the event carries a real outfitId", () => {
    assert.ok(html.includes('findDuplicateOutfit(o.itemIds, "stylist")'), "duplicate-outfit match missing from the log path");
    assert.ok(html.includes("saveChatOutfit(msg, function () { writeEvent(o.savedId || null); });"), "save-first step missing");
  });

  it("outfit cards carry the Wore-it affordance only in thread context", () => {
    assert.ok(html.includes("if (msg.wearLoggable && o.itemIds && o.itemIds.length)"), "wear button not gated on wearLoggable");
    assert.ok(html.includes('wearBtn.textContent = "Wore it today";'), "wear button missing");
    assert.ok(html.includes('wearBtn.textContent = "Worn today ✓";'), "worn state missing");
    assert.ok(html.includes("wearLoggable: true"), "thread renders do not opt in");
  });

  it("the proposal binds its item set at reply time and persists state", () => {
    assert.ok(html.includes("thinking.wornProposal = { itemIds: previousPick.itemIds.slice(), lookName: wName };"), "binding missing");
    assert.ok(html.includes("if (m.wornProposal) o.wornProposal = m.wornProposal;"), "proposal not serialized");
    assert.ok(html.includes("if (m.wornState) o.wornState = m.wornState;"), "state not serialized");
    assert.ok(html.includes("chatList.appendChild(renderWornProposalCard(m));"), "card not rendered");
  });
});
