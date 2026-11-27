// PC-108: after a bulk run finished, the "Add 2 pieces" button
// stayed disabled for ~2 minutes while the items were already
// created in the background — bulkFinish() never touched the
// button, so the sheet read as stuck. The button state now lives
// in one helper (syncBulkStartBtn) used by file selection, the
// duplicate-skip path, and the finish.
// Run from hosting/: node --test tests/pc108-bulk-button.test.js
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

const syncBulkStartBtn = extractClientFn("syncBulkStartBtn", "");
const bulkFinish = extractClientFn("bulkFinish", "");

function installFakes(jobs, btn) {
  global.bulkJobs = jobs;
  global.bulkStartBtn = btn;
  global.bulkInput = { disabled: true };
  global.bulkRunning = true;
  global.showToast = function () {};
  global.renderBulkList = function () {};
  global.document = { getElementById: function () { return { hidden: false }; } };
  global.syncBulkStartBtn = syncBulkStartBtn;
}

describe("syncBulkStartBtn", function () {
  test("two queued jobs: enabled, 'Add 2 pieces'", function () {
    const btn = { disabled: true, textContent: "Add pieces" };
    installFakes([{ status: "queued" }, { status: "queued" }], btn);
    syncBulkStartBtn();
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "Add 2 pieces");
  });

  test("one queued job: singular label", function () {
    const btn = { disabled: true, textContent: "Add pieces" };
    installFakes([{ status: "queued" }], btn);
    syncBulkStartBtn();
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "Add 1 piece");
  });

  test("nothing queued: disabled, idle label", function () {
    const btn = { disabled: false, textContent: "Add 2 pieces" };
    installFakes([{ status: "done" }, { status: "failed" }], btn);
    syncBulkStartBtn();
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "Add pieces");
  });
});

describe("bulkFinish (the Round 6 case)", function () {
  test("after two files show Done, the button resets to the idle state", function () {
    // The stuck state Round 6 saw: disabled, still reading "Add 2 pieces".
    const btn = { disabled: true, textContent: "Add 2 pieces" };
    installFakes([{ status: "done" }, { status: "done" }], btn);
    bulkFinish();
    assert.equal(global.bulkRunning, false);
    assert.equal(global.bulkInput.disabled, false);
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "Add pieces");
  });

  test("a failed job left behind does not re-enable the button — retry lives on the job row", function () {
    const btn = { disabled: true, textContent: "Add 2 pieces" };
    installFakes([{ status: "done" }, { status: "failed" }], btn);
    bulkFinish();
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "Add pieces");
  });
});

describe("source pins", function () {
  test("bulkFinish resets the button through the shared helper", function () {
    assert.ok(/function bulkFinish\(\) \{[\s\S]*?syncBulkStartBtn\(\);/.test(html), "bulkFinish must call syncBulkStartBtn");
  });

  test("the label logic lives in exactly one place — the shared helper", function () {
    const direct = html.match(/bulkStartBtn\.textContent = n > 0/g) || [];
    assert.equal(direct.length, 1, "only syncBulkStartBtn may compute the label");
    assert.ok(/function syncBulkStartBtn\(\) \{[\s\S]*?bulkStartBtn\.textContent = n > 0/.test(html));
  });
});
