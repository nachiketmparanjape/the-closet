// Sprint 30 attach-persistence guards (founder report 2026-11-14).
// The pick attach lived only in memory: a phone attach vanished on
// desktop, the card that would re-attach it never came back (its
// stored state was already "accepted"), and the reply text still said
// "tap the card below". The attach now rides on the thread doc, a
// same-day acceptance heals itself, and an accepted card leaves a
// plain note instead of a dangling pointer. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("saveThread persists the pick attach on the thread doc", () => {
  assert.ok(html.includes("attach: chatAttachByThread[key] || null,"), "attach missing from saveThread");
});

test("loadThread restores the saved attach, healing otherwise", () => {
  assert.ok(html.includes("if (d.attach && d.attach.itemIds && d.attach.itemIds.length) {"), "saved-attach restore missing");
  assert.ok(html.includes("chatAttachByThread[key] = d.attach;"), "attach restore assignment missing");
  assert.ok(html.includes("healAcceptedAttach(key, msgs);"), "heal call missing from loadThread");
});

test("the heal re-attaches today's pick for a same-day acceptance", () => {
  assert.ok(html.includes("function healAcceptedAttach(key, msgs)"), "heal function missing");
  assert.ok(html.includes('m.attachState !== "accepted"'), "heal must key on accepted state");
  assert.ok(html.includes("var o = todayPickReady();"), "heal must use today's pick");
  assert.ok(html.includes("chatAttachByThread[key] = {"), "heal must set the attach");
  // A full saveThread here could overwrite messages mid-load — the
  // heal writes the attach field only.
  assert.ok(html.includes("threadRef(key).set({ attach: chatAttachByThread[key] }, { merge: true })"), "heal must write attach only");
});

test("the heal retries when today's picks land after the thread", () => {
  assert.ok(html.includes("healAcceptedAttach(activeThreadKey, stylistMessages);"), "picks-arrival heal retry missing");
});

test("removing the pick from the context sheet persists the detach", () => {
  const i = html.indexOf('if (e.action === "detachPick")');
  assert.ok(i !== -1, "detachPick action missing");
  const block = html.slice(i, i + 400);
  assert.ok(block.includes("saveThread(activeThreadKey);"), "detach must save the thread");
});

test("an accepted card leaves a plain note under its reply", () => {
  assert.ok(html.includes('if (m.attachProposal && m.attachState === "accepted")'), "accepted-note condition missing");
  assert.ok(html.includes('"Today\'s pick is attached to this conversation."'), "accepted-note text missing");
});
