// PC-85 guards: reloads never show wrong empty states. Root cause:
// the static HTML painted "0 pieces" / "0 outfits" / "0 saved" and
// a visible empty wardrobe, and the renderers built empty states
// from allItems === [] — which is also the value before the first
// Firestore snapshot arrives. A reload therefore flashed "0 pieces"
// with "Loading wardrobe", an empty stylist ("Tell me the occasion…",
// "Try the demo wardrobe") and "0 outfits" before the real data
// arrived. Fix: counts read "…" and the empty state starts hidden
// in the static markup; an itemsLoaded flag (set on the first items
// snapshot, success or error) gates every empty state and count.
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

describe("PC-85: static markup says loading, never zero", () => {
  it("counts read an ellipsis, not zero", () => {
    assert.ok(html.includes('<span class="count" id="itemCount">…</span>'), "itemCount still paints 0");
    assert.ok(html.includes('<span class="count" id="outfitCount">…</span>'), "outfitCount still paints 0");
    assert.ok(html.includes('<span class="count" id="shopCheckCount">…</span>'), "shopCheckCount still paints 0");
    assert.ok(!html.includes('id="itemCount">0 pieces'), "static 0 pieces remains");
    assert.ok(!html.includes('id="outfitCount">0 outfits'), "static 0 outfits remains");
  });

  it("the wardrobe empty state starts hidden", () => {
    assert.ok(html.includes('<div class="empty" id="emptyState" hidden>'), "emptyState paints visible");
  });
});

describe("PC-85: the load gate", () => {
  it("an itemsLoaded flag starts false and flips on the first snapshot", () => {
    assert.ok(html.includes("var itemsLoaded = false;"), "flag missing");
    const watch = sliceFrom("function watchItems(user)", 1200);
    assert.ok(watch.includes("itemsLoaded = true;"), "flag never set in watchItems");
  });

  it("renderGallery shows the empty state only after load", () => {
    const body = sliceFrom("function renderGallery()", 4500);
    assert.ok(body.includes("if (!itemsLoaded)"), "loading branch missing");
    assert.ok(body.includes("} else if (allItems.length === 0) {"), "empty branch not gated");
    assert.ok(body.includes("emptyState.hidden = false;"), "empty state never unhidden");
    assert.ok(body.includes('itemCount.textContent = itemsLoaded ?'), "count not gated");
  });

  it("renderChat shows a loading line, not the empty chat, before load", () => {
    const body = sliceFrom("function renderChat()", 2500);
    assert.ok(body.includes("if (!itemsLoaded && !demoChat)"), "chat loading branch missing");
    assert.ok(body.includes("Loading your wardrobe…"), "loading line missing");
  });

  it("the chat add-info block (incl. the demo door) waits for load", () => {
    const body = sliceFrom("function renderChat()", 6500);
    assert.ok(body.includes("if (itemsLoaded && !demoChat && !todayThresholdMet()"), "add-info not gated");
  });

  it("the outfits and shop intro cards wait for load", () => {
    const outfits = sliceFrom("function renderOutfits()", 1200);
    assert.ok(outfits.includes("if (itemsLoaded && allItems.length === 0 && list.length === 0)"), "outfits intro not gated");
    const shop = sliceFrom("function renderShopList()", 1500);
    assert.ok(shop.includes("if (itemsLoaded && allItems.length === 0)"), "shop intro not gated");
  });
});
