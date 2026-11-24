// PC-87 guards: outfit Delete works. Root cause: the outfit delete
// gated on a native window.confirm() dialog — the same failure class
// PC-82 fixed for piece + wear-entry deletes. The cloud browser
// auto-dismisses native dialogs without ever showing them, so the
// handler returned early and nothing happened: no delete, no toast,
// no error, across 7 taps in 4 attempts (Round 2). Fix: the same
// in-app two-tap confirm (dataset.confirm + relabeled button). The
// worn-count pre-query goes with the dialog — the detail view
// already shows the wear history, and wear events stay either way.
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

describe("PC-87: outfit delete", () => {
  const body = sliceFrom('outfitDelete").addEventListener("click"', 2200);

  it("does not gate on a native dialog", () => {
    assert.ok(!body.includes("confirm("), "outfit delete still uses a native dialog");
  });

  it("arms a two-tap confirm instead", () => {
    assert.ok(body.includes('btn.dataset.confirm = "1"'), "two-tap arm missing");
    assert.ok(body.includes('"Tap again to delete"'), "armed label missing");
  });

  it("still batch-deletes the version docs and toasts", () => {
    assert.ok(body.includes("batch.delete(col.collection(\"outfits\").doc(id))"), "batch delete missing");
    assert.ok(body.includes('batch.commit()'), "batch commit missing");
    assert.ok(body.includes('"Outfit deleted."'), "success toast missing");
  });

  it("openOutfit resets the armed state", () => {
    const open = sliceFrom("function openOutfit(groupId)", 800);
    assert.ok(open.includes("delete delBtn.dataset.confirm"), "armed state not reset on open");
    assert.ok(open.includes('delBtn.textContent = "Delete"'), "label not reset on open");
  });
});
