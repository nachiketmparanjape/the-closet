// PC-67 guards: the stylist's claims about what is or isn't in
// the wardrobe are grounded in photo-check verdicts (the client's
// garment matcher), never assumed. Founder's thread 2026-11-21:
// he wrote "both are not logged yet I think" and the stylist
// simply assumed, then silently substituted lookalikes.
// Server functions are exercised for real; client wiring is
// pinned by source assertions. House style (describe/it).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.paths.unshift(path.join(__dirname, "..", "functions", "node_modules"));
const { sanitizePhotoVerdicts, buildStylistRequest } = require("../functions/stylist.js");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

const VERDICTS = [
  { label: "Grey crewneck sweater", status: "matched", matchedName: "Grey crewneck sweater", altName: "" },
  { label: "Cargo jeans", status: "unmatched", matchedName: "", altName: "" },
  { label: "White sneakers", status: "ambiguous", matchedName: "White leather sneakers", altName: "Canvas sneakers" },
];

describe("PC-67 server: verdict sanitization", () => {
  it("keeps well-formed verdicts of all three kinds", () => {
    const out = sanitizePhotoVerdicts(VERDICTS);
    assert.equal(out.length, 3);
    assert.equal(out[0].status, "matched");
    assert.equal(out[2].altName, "Canvas sneakers");
  });

  it("drops invented statuses and junk, caps the list", () => {
    const junk = [{ label: "X", status: "probably" }, null, "nope", { label: "Y", status: "matched", matchedName: "Y" }];
    const out = sanitizePhotoVerdicts(junk);
    assert.equal(out.length, 1);
    assert.equal(out[0].label, "Y");
    assert.equal(sanitizePhotoVerdicts("nope").length, 0);
    assert.equal(sanitizePhotoVerdicts(Array(20).fill(VERDICTS[1])).length, 8);
  });
});

describe("PC-67 server: the brief grounds claims in the verdicts", () => {
  function brief(verdicts) {
    const req = buildStylistRequest([], [], null, null, null, null, null, null, null, [], "2026-11-21", null, null, [], null, null, [], verdicts);
    return req.config.systemInstruction;
  }

  it("renders matched / unmatched / ambiguous lines with the grounding rule", () => {
    const sys = brief(VERDICTS);
    assert.ok(sys.includes("PHOTO CHECK"), "section missing");
    assert.ok(sys.includes('"Grey crewneck sweater": MATCHED'), "matched line missing");
    assert.ok(sys.includes('"Cargo jeans": NO MATCH'), "unmatched line missing");
    assert.ok(sys.includes('"White sneakers": POSSIBLE match'), "ambiguous line missing");
    assert.ok(sys.includes("never describe a lookalike substitute as the pictured piece itself"), "honesty rule missing");
  });

  it("no verdicts → no section", () => {
    assert.ok(!brief([]).includes("PHOTO CHECK"));
    assert.ok(!brief(undefined).includes("PHOTO CHECK"));
  });
});

describe("PC-67 client: check trigger, verdict landing, payload", () => {
  it("a photo message whose words turn on logging starts a check parse", () => {
    assert.ok(html.includes("startChatPhotoCheck(userMsg, sentPhotos[0], sentThreadKey);"), "check never starts");
    assert.ok(html.includes("function startChatPhotoCheck(userMsg, photo, threadKey)"), "check function missing");
  });

  it("the add parse also writes verdicts onto the photo's message", () => {
    assert.ok(html.includes("startChatAddParse(thinking, sentPhotos[0], sentThreadKey, userMsg);"), "add parse not given the user message");
    assert.ok(html.includes("s.verdictMsg.photoVerdicts = verdictsFromGarments(s.garments);"), "poll does not land verdicts");
  });

  it("verdict derivation: one candidate matched, several ambiguous, none unmatched", () => {
    assert.ok(html.includes('if (cands.length === 1) return { label: label, status: "matched"'), "matched rule missing");
    assert.ok(html.includes('if (cands.length > 1) return { label: label, status: "ambiguous"'), "ambiguous rule missing");
    assert.ok(html.includes('return { label: label, status: "unmatched" };'), "unmatched rule missing");
  });

  it("verdicts persist on the message and ride the next payloads", () => {
    assert.ok(html.includes("if (m.photoVerdicts) o.photoVerdicts = m.photoVerdicts;"), "verdicts not serialized");
    assert.ok(html.includes("photoVerdicts: latestVerdicts,"), "payload does not carry verdicts");
  });
});
