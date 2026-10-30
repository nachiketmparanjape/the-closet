// PC-36 drafts + background: listParses (drafts list) and
// advanceAllParses (scheduled advancer) against fake Firestore.
const test = require("node:test");
const assert = require("node:assert/strict");
const { listParses, PARSE_ETA_MINUTES } = require("../functions/parse.js");
const { advanceAllParses } = require("../functions/advance.js");

const NOW = Date.parse("2026-10-29T04:00:00.000Z");
function ts(minutesAgo) {
  const d = new Date(NOW - minutesAgo * 60 * 1000);
  return { toDate: () => d };
}

// Minimal fake Firestore: users -> parses, with the where /
// orderBy / limit / get chain and doc get / update.
function fakeDb(users) {
  function usersColl() {
    return {
      async get() {
        return { docs: Object.keys(users).map((uid) => ({ exists: true, id: uid, data: () => ({}) })) };
      },
      doc(uid) {
        return {
          collection(sub) {
            if (sub !== "parses") throw new Error("unexpected " + sub);
            let docs = Object.keys(users[uid].parses).map((pid) => ({
              exists: true,
              id: pid,
              data: () => users[uid].parses[pid],
            }));
            const chain = {
              where(field, op, values) {
                if (op !== "in") throw new Error("fake where op " + op);
                docs = docs.filter((d) => values.includes(d.data()[field]));
                return chain;
              },
              orderBy(field, dir) {
                docs = docs.slice().sort((a, b) => {
                  const av = a.data()[field] && a.data()[field].toDate ? a.data()[field].toDate().getTime() : 0;
                  const bv = b.data()[field] && b.data()[field].toDate ? b.data()[field].toDate().getTime() : 0;
                  return dir === "desc" ? bv - av : av - bv;
                });
                return chain;
              },
              limit(n) {
                docs = docs.slice(0, n);
                return chain;
              },
              async get() {
                return { docs };
              },
              doc(pid) {
                return {
                  async get() {
                    const data = users[uid].parses[pid];
                    return { exists: !!data, data: () => data };
                  },
                  async update(patch) {
                    users[uid].parses[pid] = { ...users[uid].parses[pid], ...patch };
                  },
                };
              },
            };
            return chain;
          },
        };
      },
    };
  }
  return {
    collection(name) {
      if (name !== "users") throw new Error("unexpected " + name);
      return usersColl();
    },
  };
}

test("listParses: failed included, done excluded, one card per photo", async () => {
  const db = fakeDb({
    u1: {
      parses: {
        pOld: { status: "failed", createdAt: ts(90), sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" }, garments: [] },
        pNew: { status: "cutting", createdAt: ts(5), sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" }, garments: [{ status: "cutting" }] },
        pDone: { status: "done", createdAt: ts(120), sourcePhoto: { storagePath: "users/u1/outfit-photos/b.jpg" }, garments: [] },
        pReview: { status: "review", createdAt: ts(60), sourcePhoto: { storagePath: "users/u1/outfit-photos/c.jpg" }, garments: [{ status: "ready" }, { status: "ready" }] },
      },
    },
  });
  const res = await listParses("u1", { db });
  assert.equal(typeof res.etaMinutes, "number");
  assert.ok(res.etaMinutes > 0);
  assert.equal(res.etaMinutes, PARSE_ETA_MINUTES);
  // Newest per photo wins: a.jpg shows pNew (cutting), not pOld (failed).
  // pDone is excluded. pReview is listed.
  assert.deepEqual(res.parses.map((p) => p.parseId), ["pNew", "pReview"]);
  assert.equal(res.parses[0].garmentCount, 1);
  assert.equal(res.parses[1].readyCount, 2);
  assert.ok(!JSON.stringify(res.parses).includes("predictionId"));
});

test("advancer: cutting advances, fresh listing untouched, old listing fails", async () => {
  const users = {
    u1: {
      parses: {
        pCut: { status: "cutting", createdAt: ts(10), garments: [{ id: "g0", status: "cutting" }] },
        pListFresh: { status: "listing", createdAt: ts(5), garments: [] },
        pListOld: { status: "listing", createdAt: ts(20), garments: [] },
      },
    },
  };
  const db = fakeDb(users);
  const called = [];
  const summary = await advanceAllParses({
    db,
    bucket: {},
    apiKey: "x",
    now: NOW,
    advance: async (uid, pid) => {
      called.push(pid);
      return { parseId: pid, status: "review", garments: [] };
    },
  });
  assert.deepEqual(called, ["pCut"]);
  assert.equal(summary.advanced, 1);
  assert.equal(summary.reviewed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(users.u1.parses.pListOld.status, "failed");
  assert.equal(users.u1.parses.pListFresh.status, "listing");
  assert.deepEqual(summary.errors, []);
});

test("advancer: old cutting with a ready piece moves to review, rest failed", async () => {
  const users = {
    u1: {
      parses: {
        pStuck: {
          status: "cutting",
          createdAt: ts(70),
          garments: [
            { id: "g0", status: "ready", predictionId: "pred0" },
            { id: "g1", status: "cutting", predictionId: "pred1" },
          ],
        },
      },
    },
  };
  const db = fakeDb(users);
  const summary = await advanceAllParses({
    db,
    bucket: {},
    apiKey: "x",
    now: NOW,
    advance: async () => ({ parseId: "pStuck", status: "cutting", garments: [] }),
  });
  assert.equal(summary.reviewed, 1);
  const after = users.u1.parses.pStuck;
  assert.equal(after.status, "review");
  assert.equal(after.garments[0].status, "ready");
  assert.equal(after.garments[0].predictionId, "pred0");
  assert.equal(after.garments[1].status, "failed");
});

test("advancer: one bad parse never blocks the rest", async () => {
  const users = {
    u1: {
      parses: {
        pBad: { status: "cutting", createdAt: ts(10), garments: [] },
        pGood: { status: "cutting", createdAt: ts(10), garments: [] },
      },
    },
  };
  const db = fakeDb(users);
  const summary = await advanceAllParses({
    db,
    bucket: {},
    apiKey: "x",
    now: NOW,
    advance: async (uid, pid) => {
      if (pid === "pBad") throw new Error("boom");
      return { parseId: pid, status: "review", garments: [] };
    },
  });
  assert.equal(summary.advanced, 1);
  assert.equal(summary.reviewed, 1);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].parseId, "pBad");
});

test("listParses: entries carry public garments for instant sheet render", async () => {
  const db = fakeDb({
    u1: {
      parses: {
        p1: {
          status: "review",
          createdAt: ts(5),
          sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" },
          garments: [
            {
              id: "g0", status: "failed",
              error: '{"detail":"secret"}',
              userMessage: "Try again.",
              predictionId: "p1",
              type: "Shorts", colors: ["black"],
            },
            { id: "g1", status: "ready", type: "Tee", colors: ["white"] },
          ],
        },
      },
    },
  });
  const res = await listParses("u1", { db });
  assert.equal(res.parses.length, 1);
  const gs = res.parses[0].garments;
  assert.equal(gs.length, 2);
  // Instant render needs the friendly message and the basics…
  assert.equal(gs[0].userMessage, "Try again.");
  assert.equal(gs[0].type, "Shorts");
  // …but never the technical error or the prediction id.
  assert.ok(!("error" in gs[0]));
  assert.ok(!("predictionId" in gs[0]));
});
