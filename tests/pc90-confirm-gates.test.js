// PC-90: the last native confirm() gates are gone. Ten button
// gates two-tap via the shared armOrRun helper (first tap arms,
// second runs); three flow gates with no button (guest migration,
// two photo-dupe warnings) use one shared in-app confirm sheet.
// A native dialog is auto-dismissed by some browsers without ever
// showing (proven PC-82) — the in-app paths cannot be dismissed
// without a real tap. Run from hosting/: node --test "tests/*.test.js"
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractFn(name, args) {
  const m = html.match(new RegExp("function " + name + "\\(" + args + "\\) \\{[\\s\\S]*?\\n      \\}"));
  assert.ok(m, name + " not found");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + args + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(args.split(",").map((a) => a.trim()).filter(Boolean), body);
}

describe("PC-90 acceptance: no native confirm remains", () => {
  it("zero window.confirm( calls in the client", () => {
    const hits = html.match(/window\.confirm\(/g) || [];
    assert.strictEqual(hits.length, 0, hits.length + " native confirm gates remain");
  });

  it("the armed photo-delete ring exists in CSS", () => {
    assert.ok(html.includes(".thumb-del.armed"), "no .thumb-del.armed rule");
  });
});

describe("armOrRun (shared two-tap idiom)", () => {
  const armOrRun = extractFn("armOrRun", "btn, armedLabel");
  function fakeBtn(label) {
    return { textContent: label, dataset: {} };
  }

  it("first tap arms and relabels; second tap runs and restores the label", () => {
    const b = fakeBtn("Delete");
    assert.strictEqual(armOrRun(b, "Tap again to delete"), false);
    assert.strictEqual(b.dataset.confirm, "1");
    assert.strictEqual(b.textContent, "Tap again to delete");
    assert.strictEqual(armOrRun(b, "Tap again to delete"), true);
    assert.strictEqual(b.dataset.confirm, undefined);
    assert.strictEqual(b.textContent, "Delete");
  });

  it("a stale arm on a dynamic label restores the label it saved", () => {
    const b = fakeBtn("Plan packing");
    armOrRun(b, "Tap again to replace");
    assert.strictEqual(b.textContent, "Tap again to replace");
    assert.strictEqual(armOrRun(b, "Tap again to replace"), true);
    assert.strictEqual(b.textContent, "Plan packing");
  });
});

describe("askConfirm (shared in-app sheet)", () => {
  function fakeEl() {
    const el = {
      textContent: "", hidden: true, dataset: {},
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      click() { if (this.listeners.click) this.listeners.click(); },
    };
    return el;
  }
  function setup() {
    const els = {};
    ["confirmTitle", "confirmBody", "confirmGo", "confirmCancel", "confirmClose", "confirmOverlay"]
      .forEach((id) => { els[id] = fakeEl(); });
    const opened = [];
    const closed = [];
    const doc = { getElementById: (id) => els[id] };
    // The askConfirm block is contiguous: the var + the function +
    // the three wiring listeners. Run it against the fake document.
    const start = html.indexOf("// PC-90: one shared in-app confirm sheet.");
    assert.ok(start > -1, "askConfirm block missing");
    const endMarker = 'document.getElementById("confirmClose").addEventListener("click", function () {\n        confirmPending = null;\n        closeOverlay(document.getElementById("confirmOverlay"));\n      });';
    const end = html.indexOf(endMarker, start);
    assert.ok(end > -1, "confirmClose wiring missing");
    const block = html.slice(start, end + endMarker.length);
    const factory = new Function("document", "openOverlay", "closeOverlay",
      block + "\nreturn { askConfirm: askConfirm };");
    const { askConfirm } = factory(doc,
      (el) => opened.push(el), (el) => closed.push(el));
    return { els, opened, closed, askConfirm };
  }

  it("asks the question, arms the action, and the Go button runs it once", () => {
    const { els, opened, closed, askConfirm } = setup();
    let ran = 0;
    askConfirm({ title: "Move your guest wardrobe?", body: "Move it?", confirmLabel: "Move wardrobe", onConfirm: () => { ran++; } });
    assert.strictEqual(els.confirmTitle.textContent, "Move your guest wardrobe?");
    assert.strictEqual(els.confirmBody.textContent, "Move it?");
    assert.strictEqual(els.confirmGo.textContent, "Move wardrobe");
    assert.strictEqual(opened.length, 1);
    els.confirmGo.click();
    assert.strictEqual(ran, 1, "Go did not run the action");
    assert.strictEqual(closed.length, 1, "Go did not close the sheet");
    els.confirmGo.click();
    assert.strictEqual(ran, 1, "Go ran the action twice");
  });

  it("Cancel and Close drop the action without running it", () => {
    const { els, closed, askConfirm } = setup();
    let ran = 0;
    askConfirm({ title: "T", body: "B", onConfirm: () => { ran++; } });
    els.confirmCancel.click();
    assert.strictEqual(ran, 0);
    assert.strictEqual(closed.length, 1);
    askConfirm({ title: "T", body: "B", onConfirm: () => { ran++; } });
    els.confirmClose.click();
    assert.strictEqual(ran, 0);
    assert.strictEqual(closed.length, 2);
  });

  it("a second ask replaces the first pending action", () => {
    const { els, askConfirm } = setup();
    let first = 0, second = 0;
    askConfirm({ title: "First", onConfirm: () => { first++; } });
    askConfirm({ title: "Second", onConfirm: () => { second++; } });
    els.confirmGo.click();
    assert.strictEqual(first, 0, "the replaced action ran");
    assert.strictEqual(second, 1);
  });
});

describe("PC-90: every former gate now uses armOrRun or askConfirm", () => {
  const gates = [
    ["guest migration asks in the sheet", "Move wardrobe", "askConfirm"],
    ["sign-out two-taps for guest only", "Tap again to sign out", "armOrRun"],
    ["clear taste two-taps", "Tap again to clear", "armOrRun"],
    ["photo delete arms with a ring + toast", "Tap again to delete this photo.", "dataset.confirm"],
    ["dupe add asks in the sheet", "Add anyway", "askConfirm"],
    ["AI generate two-taps with a cost toast", "Tap again to generate", "armOrRun"],
    ["dupe upload asks in the sheet", "Upload anyway", "askConfirm"],
    ["packing replace two-taps", "Tap again to replace", "armOrRun"],
    ["trip delete two-taps", "Tap again to delete", "armOrRun"],
    ["draft discard two-taps (card + sheet)", "Tap again to discard", "armOrRun"],
    ["delete saved check two-taps", "Tap again to delete", "armOrRun"],
    ["clear all questions two-taps", "Tap again to clear", "armOrRun"],
    ["duplicate-slot save two-taps", "Tap again to save", "armOrRun"],
  ];
  for (const [name, label, mechanism] of gates) {
    it(name, () => {
      assert.ok(html.includes(label), "armed label / sheet text missing: " + label);
      assert.ok(html.includes(mechanism), "mechanism missing for " + name);
    });
  }

  it("a label reset clears the arm with it (no silent one-tap action)", () => {
    // The three places that reset a button label programmatically
    // must clear dataset.confirm too — otherwise the arm survives
    // invisibly and the next tap runs without asking.
    const resets = [
      'genBtn.textContent = "Generate standardized view"',
      'tpb.textContent =',
      'ddBtn.textContent = "Discard draft"',
    ];
    for (const r of resets) {
      const i = html.indexOf(r);
      assert.ok(i > -1, "reset site missing: " + r);
      const after = html.slice(i, i + 400);
      assert.ok(after.includes("delete ") && after.includes("dataset.confirm"),
        "label reset without an arm clear: " + r);
    }
  });

  it("sign-out stays one tap when signed in (the confirm was guest-only)", () => {
    const m = html.match(/function signOutAccount\(btn\) \{[\s\S]*?\n      \}/);
    assert.ok(m, "signOutAccount missing");
    assert.ok(m[0].includes("if (isGuest())"), "guest guard lost");
    assert.ok(m[0].includes("armOrRun(btn"), "guest two-tap missing");
    assert.ok(m[0].indexOf("armOrRun") > m[0].indexOf("if (isGuest())"),
      "the arm must sit inside the guest branch");
  });

  it("the dupe-upload flow still runs from proceedUpload", () => {
    assert.ok(html.includes("function proceedUpload()"), "proceedUpload missing");
    assert.ok(html.includes("onConfirm: proceedUpload"), "sheet does not resume the upload");
    assert.ok(html.includes("uploadOne(0);"), "upload never starts");
  });
});
