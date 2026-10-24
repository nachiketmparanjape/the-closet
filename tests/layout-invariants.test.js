// Layout invariants for public/index.html — the "universal
// rules and checks" the founder asked for (2026-10-24) after
// repeated one-off formatting breaks. These guard the
// CLASSES of bug, not single instances: if a future change
// reintroduces a floating centered card on phones, a 100vh
// window, or a duplicate dismiss button, the suite fails
// before deploy.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("windows never use 100vh (taller than the visible screen on iOS) — dvh only", () => {
  // The page shell (body / .app min-height) is the one allowed
   // exception: a dvh shell jumps as the URL bar shows and hides.
  const stripped = html.split("100dvh").join("");
  const uses = [...stripped.matchAll(/100vh/g)].length;
  const shellUses = [...stripped.matchAll(/min-height: 100vh/g)].length;
  assert.equal(uses, shellUses, "100vh found outside the page shell — use 100dvh");
  assert.ok(uses <= 2, "new 100vh shell uses need a deliberate exception here");
});

test("the universal overlay rule is present (phones: every panel a bottom sheet)", () => {
  assert.ok(html.includes("UNIVERSAL OVERLAY RULE"), "rule comment missing");
  assert.ok(html.includes(".overlay:not(#captureOverlay)"), "rule selector missing");
});

test("removed duplicate dismiss buttons stay removed", () => {
  const gone = ["captureCancel", "bulkCancel", "feedbackCancel", "photoParseCancel",
    "tripCancel", "uploadCancel", "itemCancel", "builderCancel"];
  for (const id of gone) {
    assert.ok(!html.includes('id="' + id + '"'), id + " came back — dismiss is the × / backdrop / swipe only");
  }
});

test("typed inputs and textareas sit at 16px (smaller, and iOS zooms the page on focus)", () => {
  assert.ok(/input\[type="text"\], input\[type="search"\], input\[type="email"\], textarea \{ font-size: 16px; \}/.test(html),
    "the 16px rule for typed inputs/textareas is gone");
  assert.ok(/\.field textarea \{[^}]*font: inherit;/.test(html),
    ".field textarea lost font: inherit");
});

test("every overlay contains a modal or sheet panel (no third presentation kind)", () => {
  const overlays = [...html.matchAll(/<div class="overlay[^"]*" id="(\w+Overlay)"/g)];
  assert.ok(overlays.length >= 10, "expected the full overlay family, got " + overlays.length);
  for (const m of overlays) {
    const rest = html.slice(m.index, m.index + 3000);
    const panelAt = rest.search(/<section class="(modal|sheet)"/);
    const nextOverlayAt = rest.indexOf('<div class="overlay', 10);
    assert.ok(panelAt !== -1 && (nextOverlayAt === -1 || panelAt < nextOverlayAt),
      m[1] + " has no modal/sheet panel");
  }
});
