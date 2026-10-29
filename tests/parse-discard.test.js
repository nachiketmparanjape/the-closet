// Discard a draft parse (functions/discard.js) against fake
// Firestore + fake Storage: the parse lineage, its baked file,
// its renders and its uploaded photo go away; saved work and
// non-upload photos are never touched.
const test = require("node:test");
const assert = require("node:assert/strict");
const { discardParse } = require("../functions/discard.js");

function fakeDb(users) {
  return {
    collection(name) {
      if (name !== "users") throw new Error("unexpected " + name);
      return {
        doc(uid) {
          return {
            collection(sub) {
              if (sub !== "parses") throw new Error("unexpected " + sub);
              const parses = users[uid].parses;
              return {
                async get() {
                  return {
                    docs: Object.keys(parses).map((pid) => ({
                      id: pid,
                      data: () => parses[pid],
                    })),
                  };
                },
                doc(pid) {
                  return {
                    async get() {
                      const data = parses[pid];
                      return { exists: !!data, data: () => data };
                    },
                    async delete() {
                      delete parses[pid];
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function fakeBucket(deleted, failOn) {
  return {
    file(path) {
      return {
        async delete() {
          if (failOn && failOn.has(path)) throw new Error("gone already");
          deleted.push(path);
        },
      };
    },
  };
}

test("discard: deletes the parse, baked file, renders and uploaded photo", async () => {
  const users = {
    u1: {
      parses: {
        p1: {
          status: "review",
          sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" },
          bakedStoragePath: "users/u1/parses/p1/baked.jpg",
          garments: [
            { status: "ready", renderStoragePath: "users/u1/renders/r1.png" },
            { status: "ready", renderStoragePath: "users/u1/renders/r2.png" },
          ],
        },
      },
    },
  };
  const deleted = [];
  const res = await discardParse("u1", "p1", {
    db: fakeDb(users),
    bucket: fakeBucket(deleted),
  });
  assert.deepEqual(res.deletedParses, ["p1"]);
  assert.equal(res.deletedFiles, 4);
  assert.deepEqual(Object.keys(users.u1.parses), []);
  assert.deepEqual(deleted.sort(), [
    "users/u1/outfit-photos/a.jpg",
    "users/u1/parses/p1/baked.jpg",
    "users/u1/renders/r1.png",
    "users/u1/renders/r2.png",
  ].sort());
});

test("discard: deletes sibling parses sharing the photo", async () => {
  const users = {
    u1: {
      parses: {
        pOld: {
          status: "failed",
          sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" },
          bakedStoragePath: "users/u1/parses/pOld/baked.jpg",
          garments: [],
        },
        pNew: {
          status: "cutting",
          sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" },
          bakedStoragePath: "users/u1/parses/pNew/baked.jpg",
          garments: [],
        },
        pOther: {
          status: "review",
          sourcePhoto: { storagePath: "users/u1/outfit-photos/b.jpg" },
          garments: [],
        },
      },
    },
  };
  const deleted = [];
  const res = await discardParse("u1", "pNew", {
    db: fakeDb(users),
    bucket: fakeBucket(deleted),
  });
  assert.deepEqual(res.deletedParses.sort(), ["pNew", "pOld"]);
  assert.deepEqual(Object.keys(users.u1.parses), ["pOther"]);
  assert.ok(deleted.includes("users/u1/outfit-photos/a.jpg"));
  assert.ok(!deleted.includes("users/u1/outfit-photos/b.jpg"));
});

test("discard: refuses a saved (done) parse and deletes nothing", async () => {
  const users = {
    u1: {
      parses: {
        p1: {
          status: "done",
          sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" },
          bakedStoragePath: "users/u1/parses/p1/baked.jpg",
          garments: [{ status: "ready", renderStoragePath: "users/u1/renders/r1.png" }],
        },
      },
    },
  };
  const deleted = [];
  await assert.rejects(
    discardParse("u1", "p1", { db: fakeDb(users), bucket: fakeBucket(deleted) }),
    (e) => e.key === "PARSE_NOT_DISCARDABLE"
  );
  assert.deepEqual(Object.keys(users.u1.parses), ["p1"]);
  assert.deepEqual(deleted, []);
});

test("discard: missing parse throws PARSE_NOT_FOUND", async () => {
  const users = { u1: { parses: {} } };
  await assert.rejects(
    discardParse("u1", "nope", { db: fakeDb(users), bucket: fakeBucket([]) }),
    (e) => e.key === "PARSE_NOT_FOUND"
  );
});

test("discard: skips a source photo outside the upload area", async () => {
  const users = {
    u1: {
      parses: {
        p1: {
          status: "review",
          sourcePhoto: { storagePath: "users/u1/items/i1/photos/p.jpg" },
          bakedStoragePath: "users/u1/parses/p1/baked.jpg",
          garments: [{ status: "ready", renderStoragePath: "users/u1/renders/r1.png" }],
        },
      },
    },
  };
  const deleted = [];
  const res = await discardParse("u1", "p1", {
    db: fakeDb(users),
    bucket: fakeBucket(deleted),
  });
  assert.deepEqual(Object.keys(users.u1.parses), []);
  assert.ok(!deleted.includes("users/u1/items/i1/photos/p.jpg"));
  assert.equal(res.deletedFiles, 2);
});

test("discard: a failing file delete does not fail the discard", async () => {
  const users = {
    u1: {
      parses: {
        p1: {
          status: "failed",
          sourcePhoto: { storagePath: "users/u1/outfit-photos/a.jpg" },
          garments: [],
        },
      },
    },
  };
  const deleted = [];
  const res = await discardParse("u1", "p1", {
    db: fakeDb(users),
    bucket: fakeBucket(deleted, new Set(["users/u1/outfit-photos/a.jpg"])),
  });
  assert.deepEqual(Object.keys(users.u1.parses), []);
  assert.equal(res.deletedFiles, 0);
});
