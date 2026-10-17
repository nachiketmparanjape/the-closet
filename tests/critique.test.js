// Unit tests for PC-27 critique (Sprint 8). Pure prompt/parse logic plus
// handler auth/validation paths with a fake Firestore.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildCritiqueRequest, parseCritiqueJson, critiqueOutfit } = require("../functions/critique.js");

const outfit = { itemIds: ["a", "b"], occasion: "dinner", source: "manual" };
const items = [
  { id: "a", name: "Black tee", category: "Tops", colors: [{ name: "black", family: "black", primary: true }] },
  { id: "b", name: "Navy jeans", category: "Bottoms", colors: [{ name: "navy", family: "navy", primary: true }] },
];

describe("buildCritiqueRequest", () => {
  it("frames an honest-but-kind critique, never brutal", () => {
    const { contents, config } = buildCritiqueRequest(outfit, items, []);
    const sys = config.systemInstruction;
    assert.match(sys, /honest/i);
    assert.match(sys, /kind/i);
    assert.doesNotMatch(sys, /brutal/i);
    assert.match(sys, /did NOT pick/i);
    assert.match(sys, /JSON only/);
    assert.ok(contents[0].parts[0].text.includes("Black tee"));
  });
  it("includes style preferences when present", () => {
    const { contents } = buildCritiqueRequest(outfit, items, ["likes monochrome"]);
    assert.ok(contents[0].parts[0].text.includes("likes monochrome"));
  });
});

describe("parseCritiqueJson", () => {
  const good = JSON.stringify({
    scores: { color: 7, formality: 6, weather: 8, proportion: 5, occasion: 7 },
    critique: "Solid base; the proportions need work.",
  });
  it("parses a valid critique", () => {
    const r = parseCritiqueJson("Here you go: " + good);
    assert.equal(r.scores.color, 7);
    assert.equal(r.critique, "Solid base; the proportions need work.");
  });
  it("rejects missing scores", () => {
    assert.throws(() => parseCritiqueJson(JSON.stringify({ critique: "x" })), /scores/);
  });
  it("rejects missing critique text", () => {
    assert.throws(
      () => parseCritiqueJson(JSON.stringify({ scores: { color: 1, formality: 1, weather: 1, proportion: 1, occasion: 1 } })),
      /critique text/
    );
  });
  it("rejects non-JSON", () => {
    assert.throws(() => parseCritiqueJson("nope"), /non-JSON/);
  });
  it("clamps out-of-range scores", () => {
    const r = parseCritiqueJson(JSON.stringify({
      scores: { color: 99, formality: -3, weather: 8, proportion: 5, occasion: 7 },
      critique: "x",
    }));
    assert.equal(r.scores.color, 10);
    assert.equal(r.scores.formality, 0);
  });
});

// Fake Firestore rooted at users/{uid}: store keys look like "users/u/outfits/o1".
function makeDb(store) {
  return {
    collection: (name) => {
      if (name !== "users") throw new Error("unexpected " + name);
      return {
        doc: (uid) => ({
          collection: (c) => {
            const prefix = "users/" + uid + "/" + c;
            return {
              doc: (id) => ({
                get: async () => {
                  const d = store[prefix + "/" + id];
                  return { exists: !!d, id, data: () => d };
                },
                set: async (data) => { store[prefix + "/" + id] = data; },
              }),
              where: (field, op, val) => {
                const filters = [[field, val]];
                const q = {
                  where: (f2, o2, v2) => { filters.push([f2, v2]); return q; },
                  limit: () => q,
                  get: async () => {
                    const hits = Object.entries(store)
                      .filter(([p, d]) => p.startsWith(prefix + "/") && filters.every(([f, v]) => d[f] === v))
                      .map(([p, d]) => ({ id: p.split("/").pop(), data: () => d }));
                    return { empty: !hits.length, docs: hits };
                  },
                };
                return q;
              },
            };
          },
        }),
      };
    },
  };
}

describe("critiqueOutfit handler", () => {
  it("rejects stylist-picked outfits", async () => {
    const db = makeDb({ "users/u/outfits/o1": { source: "stylist", itemIds: ["a"] } });
    await assert.rejects(() => critiqueOutfit("u", "o1", db), /already carry scores/);
  });

  it("returns the cached critique without calling the model", async () => {
    const store = {
      "users/u/outfits/o1": { source: "manual", itemIds: ["a"] },
      "users/u/ratings/r1": {
        rater: "app", ratingKind: "critique", targetId: "o1", targetKind: "outfit",
        scores: { color: 7, formality: 7, weather: 7, proportion: 7, occasion: 7 },
        note: "Cached take.",
      },
    };
    const r = await critiqueOutfit("u", "o1", makeDb(store));
    assert.equal(r.cached, true);
    assert.equal(r.critique, "Cached take.");
  });

  it("throws when the outfit does not exist", async () => {
    await assert.rejects(() => critiqueOutfit("u", "nope", makeDb({})), /not found/);
  });
});
