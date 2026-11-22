// PC-66 guards: the stylist can propose adding the pictured
// pieces to the wardrobe; the client parses the photo with the
// existing pipeline and adds items ONLY on the user's confirm
// tap, through the SAME garment-decision chain the review sheet
// uses (one chain, two callers — never a duplicate).
// Server: parseStylistJson is exercised for real. Client: source
// assertions pin the wiring. House style (describe/it).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { parseStylistJson } = require("../functions/stylist.js");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const stylistSrc = fs.readFileSync(path.join(__dirname, "..", "functions", "stylist.js"), "utf8");

describe("PC-66 server: the add proposal is a single literal, gated on photos", () => {
  it("passes through exactly \"photoItems\"", () => {
    const out = parseStylistJson(JSON.stringify({ reply: "Let's add them — card below.", addProposal: "photoItems" }), "2026-11-21");
    assert.equal(out.addProposal, "photoItems");
  });

  it("drops anything the model invents in the field", () => {
    const out = parseStylistJson(JSON.stringify({ reply: "ok", addProposal: "everything" }), "2026-11-21");
    assert.equal(out.addProposal, null);
    const none = parseStylistJson(JSON.stringify({ reply: "ok" }), "2026-11-21");
    assert.ok(!none.addProposal);
  });

  it("the prompt teaches the proposal only when photos ride the turn", () => {
    assert.ok(stylistSrc.includes("ADD-TO-WARDROBE PROPOSAL"), "prompt section missing");
    assert.ok(stylistSrc.includes("never claim the pieces are already added"), "honesty rule missing from the prompt");
  });

  it("askStylist gates the proposal on refImages in general chat", () => {
    assert.ok(
      stylistSrc.includes("const addProposal = (!tripContext && Array.isArray(refImages) && refImages.length > 0)"),
      "the refImages gate is missing"
    );
  });
});

describe("PC-66 client: proposal → parse → confirm → shared chain", () => {
  it("sendChat captures the proposal and starts the parse with the sent photo", () => {
    assert.ok(html.includes("thinking.addProposal = d.addProposal || null;"), "reply handler drops addProposal");
    assert.ok(html.includes("startChatAddParse(thinking, sentPhotos[0], sentThreadKey);"), "parse never starts");
  });

  it("the card renders for every non-dismissed state", () => {
    assert.ok(html.includes('if (m.addProposal && m.addState && m.addState !== "dismissed")'), "render gate missing");
    assert.ok(html.includes("chatList.appendChild(renderAddProposalCard(m));"), "card not appended in renderChat");
  });

  it("the thread persists the parse pointers, not the garments", () => {
    assert.ok(html.includes("if (m.addParseId) o.addParseId = m.addParseId;"), "parseId not serialized");
    assert.ok(html.includes("if (m.addState) o.addState = m.addState;"), "addState not serialized");
    assert.ok(html.includes("if (m.addedNames) o.addedNames = m.addedNames;"), "addedNames not serialized");
  });

  it("confirm runs the shared garment-decision chain — the same one the sheet uses", () => {
    assert.ok(html.includes("applyParseGarmentDecisions(s, kept)"), "chat confirm does not use the shared chain");
    assert.ok(html.includes("applyParseGarmentDecisions(st, kept)"), "sheet save does not use the shared chain");
    const defs = html.split("function applyParseGarmentDecisions(").length - 1;
    assert.equal(defs, 1, "the chain must be defined exactly once");
  });

  it("nothing is added without the confirm tap", () => {
    assert.ok(html.includes('add.addEventListener("click", function () { confirmChatAdd(m); });'), "Add button not wired to confirm");
    assert.ok(html.includes('if (!s || m.addState !== "ready") return;'), "confirm is not state-gated");
  });

  it("after adding, the stylist is asked again to build the outfit", () => {
    assert.ok(html.includes("Now create the outfit with them, like I asked."), "follow-up wire line missing");
    assert.ok(html.includes("function continueChatAfterAdd(applied)"), "follow-up function missing");
  });
});
