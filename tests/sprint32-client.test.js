// Sprint 32 (UX-14a): demo wardrobe shape + demo flag persistence (client
// pure functions), extracted from public/index.html like the other
// client tests.
// Run from hosting/: node --test "tests/*.test.js"
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function extractClientFn(name, arg) {
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  const body = m[0]
    .replace(new RegExp("^function " + name + "\\(" + arg + "\\) \\{"), "")
    .replace(/\n      \}$/, "");
  return new Function(arg, body);
}

const demoWardrobeItems = extractClientFn("demoWardrobeItems", "");
const serializeMessages = extractClientFn("serializeMessages", "list");

describe("demoWardrobeItems (UX-14a)", () => {
  test("is 10 sample pieces with unique demo ids", () => {
    const items = demoWardrobeItems();
    assert.strictEqual(items.length, 10);
    const ids = items.map((it) => it.id);
    assert.strictEqual(new Set(ids).size, 10);
    ids.forEach((id) => assert.ok(/^demo-\d+$/.test(id), id));
  });

  test("covers tops and bottoms, so a real outfit can be built", () => {
    const items = demoWardrobeItems();
    const cats = new Set(items.map((it) => it.category));
    assert.ok(cats.has("Tops"));
    assert.ok(cats.has("Bottoms"));
    assert.ok(cats.has("Outerwear"));
    assert.ok(cats.has("Shoes"));
  });

  test("every piece has a name, a primary color, and a verified Unsplash photo", () => {
    const items = demoWardrobeItems();
    const urls = new Set();
    items.forEach((it) => {
      assert.ok(it.name && it.shortName, it.id);
      assert.ok(Array.isArray(it.colors) && it.colors.length, it.id);
      assert.ok(it.colors.some((c) => c.primary && c.name), it.id);
      assert.ok(Array.isArray(it.photos) && it.photos.length, it.id);
      const url = it.photos[0].url;
      assert.ok(/^https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9-]+[?]/.test(url), it.id + ": " + url);
      assert.ok(!urls.has(url), "duplicate photo: " + url);
      urls.add(url);
    });
  });
});

describe("serializeMessages keeps the demo flag (UX-14a)", () => {
  test("a demo reply round-trips demo: true; thinking placeholders still drop", () => {
    const out = serializeMessages([
      { role: "user", text: "casual dinner", at: 1 },
      { role: "model", text: "Try this", at: 2, demo: true, outfit: { itemIds: ["demo-2", "demo-3"] } },
      { role: "model", text: "Thinking…", thinking: true, at: 3 },
    ]);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[1].demo, true);
    assert.deepEqual(out[1].outfit, { itemIds: ["demo-2", "demo-3"] });
  });

  test("a real reply carries no demo flag", () => {
    const out = serializeMessages([{ role: "model", text: "Try this", at: 2 }]);
    assert.strictEqual(out[0].demo, undefined);
  });
});

describe("serializeMessages keeps the wardrobe snapshot (PC-64)", () => {
  test("wardrobeIds round-trips on a model reply", () => {
    const out = serializeMessages([
      { role: "model", text: "Try this", at: 2, wardrobeIds: ["a", "b", "c"] },
    ]);
    assert.deepEqual(out[0].wardrobeIds, ["a", "b", "c"]);
  });
});

const parseHandleSegments = extractClientFn("parseHandleSegments", "text");
const feedbackReasonLabel = extractClientFn("feedbackReasonLabel", "reason");
const rejectedOutfitsFrom = extractClientFn("rejectedOutfitsFrom", "list");

describe("feedbackReasonLabel + rejectedOutfitsFrom (PC-71)", () => {
  test("every reason chip has a plain label", () => {
    assert.strictEqual(feedbackReasonLabel("too-plain"), "Too plain");
    assert.strictEqual(feedbackReasonLabel("wrong-vibe"), "Wrong vibe");
    assert.strictEqual(feedbackReasonLabel("not-that-piece"), "Not that piece");
    assert.strictEqual(feedbackReasonLabel("wrong-weather"), "Wrong for the weather");
    assert.strictEqual(feedbackReasonLabel("bogus"), "Not for me");
  });

  test("rejected outfits come only from messages carrying feedback", () => {
    const out = rejectedOutfitsFrom([
      { role: "model", text: "Try this", outfit: { itemIds: ["a", "b"] }, outfitFeedback: { reason: "too-plain" } },
      { role: "model", text: "Or this", outfit: { itemIds: ["c"] } },
      { role: "model", text: "And this", outfit: { itemIds: ["d"] }, outfitFeedback: { reason: "bogus" } },
      { role: "user", text: "warmer please" },
    ]);
    assert.deepEqual(out, [{ itemIds: ["a", "b"], reason: "too-plain" }]);
  });

  test("serializeMessages keeps the feedback on the thread", () => {
    const out = serializeMessages([
      { role: "model", text: "Try this", at: 2, outfit: { itemIds: ["a"] }, outfitFeedback: { reason: "wrong-vibe" } },
    ]);
    assert.deepEqual(out[0].outfitFeedback, { reason: "wrong-vibe" });
  });
});

describe("PC-71 wiring (source pins)", () => {
  test("the feedback row is chat-only, never on demo outfits, and rides the next request", () => {
    assert.ok(html.includes("if (msg.chatActions && !msg.demo && sourceMsg)"), "feedback row is not gated");
    assert.ok(html.includes('sourceMsg.outfitFeedback = { reason: pair[0] };'), "a reason tap does not store feedback");
    assert.ok(html.includes("delete sourceMsg.outfitFeedback;"), "no undo path");
    assert.ok(html.includes("payload.rejectedOutfits = rejected;"), "feedback does not ride the next request");
    assert.ok(html.includes("undefined, m));"), "renderChat does not pass the source message");
  });
});

const cardActionText = extractClientFn("cardActionText", "kind, pieceName");

describe("cardActionText (PC-69)", () => {
  test("swap names the piece; warmer and formal read as revisions", () => {
    assert.strictEqual(cardActionText("swap", "Dark Jeans"), "Swap the Dark Jeans for something else");
    assert.strictEqual(cardActionText("swap"), "Swap the piece for something else");
    assert.strictEqual(cardActionText("warmer"), "Make this outfit warmer");
    assert.strictEqual(cardActionText("formal"), "Make this outfit more formal");
  });
});

describe("PC-69 wiring (source pins)", () => {
  test("outfit tiles are tappable and open the item page", () => {
    assert.ok(html.includes('fig.setAttribute("role", "button")'), "tile has no button role");
    assert.ok(html.includes('fig.addEventListener("click", openTile)'), "tile has no tap handler");
    assert.ok(html.includes("openItem(it);"), "tile tap does not open the item");
  });

  test("action chips render on chat cards only and force the card's outfit as the base", () => {
    assert.ok(html.includes('if (msg.chatActions && o.itemIds && o.itemIds.length)'), "actions row is not gated on chatActions");
    assert.ok(html.includes('swap.textContent = "Swap the " + (it.shortName || it.name) + " →"'), "no per-piece Swap chip");
    assert.ok(html.includes('forcedPreviousPick = { itemIds: outfit.itemIds.slice() }'), "chip does not force the card's outfit");
    assert.ok(html.includes('if (forcedPreviousPick) {'), "sendChat does not consume the forced base");
    assert.ok(html.includes("chatActions: true"), "renderChat does not pass chatActions");
  });
});
const itemFromWardrobeHandle = extractClientFn("itemFromWardrobeHandle", "index, wardrobeIds, byId");

describe("parseHandleSegments (PC-64)", () => {
  test("a bold unit '**Name [iN]**' becomes one handle segment", () => {
    const segs = parseHandleSegments("Pair the **White Tee [i2]** with jeans.");
    assert.deepEqual(segs, [
      { type: "text", text: "Pair the " },
      { type: "handle", index: 2, fallback: "**White Tee**" },
      { type: "text", text: " with jeans." },
    ]);
  });

  test("a handle outside the bold also becomes one segment", () => {
    const segs = parseHandleSegments("Try the **White Tee** [i2] today.");
    assert.deepEqual(segs, [
      { type: "text", text: "Try the " },
      { type: "handle", index: 2, fallback: "**White Tee**" },
      { type: "text", text: " today." },
    ]);
  });

  test("a bare handle becomes a segment with an empty fallback", () => {
    const segs = parseHandleSegments("Go with [i3] and [i1].");
    assert.deepEqual(segs, [
      { type: "text", text: "Go with " },
      { type: "handle", index: 3, fallback: "" },
      { type: "text", text: " and " },
      { type: "handle", index: 1, fallback: "" },
      { type: "text", text: "." },
    ]);
  });

  test("plain text with no handles is one text segment", () => {
    assert.deepEqual(parseHandleSegments("No pieces named here."), [
      { type: "text", text: "No pieces named here." },
    ]);
    assert.deepEqual(parseHandleSegments(""), []);
  });

  test("handles at the start and end are kept", () => {
    const segs = parseHandleSegments("[i1] anchors it, and so does **Dark Jeans [i5]**");
    assert.strictEqual(segs[0].type, "handle");
    assert.strictEqual(segs[0].index, 1);
    assert.strictEqual(segs[segs.length - 1].type, "handle");
    assert.strictEqual(segs[segs.length - 1].index, 5);
  });
});

describe("itemFromWardrobeHandle (PC-64)", () => {
  const byId = (id) => ({ a: "Tee", b: "Jeans", c: "Shoes" })[id] || null;

  test("maps 1-based handles against the snapshot, not the live list", () => {
    assert.strictEqual(itemFromWardrobeHandle(1, ["a", "b", "c"], byId), "Tee");
    assert.strictEqual(itemFromWardrobeHandle(3, ["a", "b", "c"], byId), "Shoes");
  });

  test("returns null for out-of-range handles, missing snapshots, and deleted items", () => {
    assert.strictEqual(itemFromWardrobeHandle(4, ["a", "b", "c"], byId), null);
    assert.strictEqual(itemFromWardrobeHandle(0, ["a", "b", "c"], byId), null);
    assert.strictEqual(itemFromWardrobeHandle(1, undefined, byId), null);
    assert.strictEqual(itemFromWardrobeHandle(1, null, byId), null);
    assert.strictEqual(itemFromWardrobeHandle(2, ["a", "gone", "c"], byId), null);
  });
});
