// PC-82 guards: Delete works for wardrobe pieces and wear entries.
// Root cause: both deletes gated on a native confirm dialog, which
// the cloud browser auto-dismisses without ever showing it — the
// dialog returns false, the handler returns early, and nothing
// happens: no delete, no toast, no error (proven with a live test
// page in the same browser). Fix: in-app two-tap confirm, the
// Start-fresh idiom (dataset.confirm + relabeled button).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function sliceFrom(marker, len) {
  const i = html.indexOf(marker);
  assert.ok(i > -1, "marker missing: " + marker);
  return html.slice(i, i + len);
}

describe("PC-82: piece delete", () => {
  const body = sliceFrom('itemDelete.addEventListener("click"', 1800);

  it("does not gate on a native dialog", () => {
    assert.ok(!body.includes("confirm("), "piece delete still uses a native dialog");
  });

  it("arms a two-tap confirm instead", () => {
    assert.ok(body.includes('itemDelete.dataset.confirm = "1"'), "two-tap arm missing");
    assert.ok(body.includes('"Tap again to delete"'), "armed label missing");
  });

  it("still deletes the doc, toasts, and closes", () => {
    assert.ok(body.includes("itemDocRef().delete()"), "Firestore delete missing");
    assert.ok(body.includes('"Piece deleted."'), "success toast missing");
    assert.ok(body.includes("closeItem()"), "close after delete missing");
  });

  it("openItem resets the armed state", () => {
    const open = sliceFrom("function openItem(item)", 4200);
    assert.ok(open.includes("delete itemDelete.dataset.confirm"), "armed state not reset on open");
  });
});

describe("PC-82: wear-entry delete", () => {
  const body = sliceFrom('del.className = "wear-del"', 1600);

  it("does not gate on a native dialog", () => {
    assert.ok(!body.includes("confirm("), "wear delete still uses a native dialog");
  });

  it("arms a two-tap confirm instead", () => {
    assert.ok(body.includes('del.dataset.confirm = "1"'), "two-tap arm missing");
  });

  it("still deletes the wear event, toasts, and re-renders", () => {
    assert.ok(body.includes('collection("wear_events").doc(w._docId).delete()'), "wear delete missing");
    assert.ok(body.includes('"Wear entry deleted."'), "success toast missing");
    assert.ok(body.includes("renderWearHistory(outfit)"), "history re-render missing");
  });
});
