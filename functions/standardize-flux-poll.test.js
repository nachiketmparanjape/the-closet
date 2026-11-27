// PC-105: the FLUX poll respects the pipeline deadline and never
// hangs on a single fetch.
//
// The old poll ran 40 x 5s with no deadline and no per-fetch
// timeout: one slow fal day could eat the whole function budget
// from inside a single attempt, and the pipeline's 240s deadline
// (checked only between attempts and inside the SAM poll) never
// saw it. The poll now takes opts.deadlineAt and stops with a
// standardization_timeout, and every fal call carries a per-fetch
// timeout (default 30s).
// Run from hosting/: node --test functions/standardize-flux-poll.test.js
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { runFluxStandardization } = require("./standardize");

const STATUS_URL = "https://fal/status/flux";
const RESPONSE_URL = "https://fal/response/flux";
const OUT_URL = "https://fal.output/flux.png";

const json = (o) => ({ ok: true, status: 200, json: async () => o });

// A fetch that hangs until its AbortSignal fires, then rejects the
// way Node's fetch does on abort.
function hungFetch(_url, opts = {}) {
  return new Promise((_resolve, reject) => {
    const signal = opts.signal;
    if (!signal) return; // never settles: a real hang
    if (signal.aborted) {
      const e = new Error("aborted");
      e.name = "AbortError";
      reject(e);
      return;
    }
    signal.addEventListener("abort", () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      reject(e);
    });
  });
}

function makeFetch({ statusSequence, hangStatus = false, hangSubmit = false } = {}) {
  let statusCalls = 0;
  const fetch = async (url, opts = {}) => {
    if (url === "https://queue.fal.run/fal-ai/flux-kontext/dev" && opts.method === "POST") {
      if (hangSubmit) return hungFetch(url, opts);
      return json({ request_id: "req-1", status_url: STATUS_URL, response_url: RESPONSE_URL });
    }
    if (url === STATUS_URL) {
      if (hangStatus) return hungFetch(url, opts);
      const next = statusSequence
        ? statusSequence[Math.min(statusCalls, statusSequence.length - 1)]
        : "IN_QUEUE";
      statusCalls++;
      if (next === "COMPLETED") return json({ status: "COMPLETED", response_url: RESPONSE_URL });
      return json({ status: next });
    }
    if (url === RESPONSE_URL) return json({ images: [{ url: OUT_URL }] });
    throw new Error("unexpected fetch: " + url);
  };
  return { fetch, statusCalls: () => statusCalls };
}

let realFetch;
beforeEach(() => { realFetch = global.fetch; });
afterEach(() => { global.fetch = realFetch; });

describe("PC-105: FLUX poll deadline + per-fetch timeout", function () {
  it("returns the image URL when the status flips to COMPLETED", async function () {
    const { fetch } = makeFetch({ statusSequence: ["IN_QUEUE", "COMPLETED"] });
    global.fetch = fetch;
    const url = await runFluxStandardization("https://example.com/in.jpg", "fake-key", {}, "", null, { pollIntervalMs: 5 });
    assert.equal(url, OUT_URL);
  });

  it("stops with standardization_timeout when the deadline passes mid-poll", async function () {
    const { fetch } = makeFetch({ statusSequence: ["IN_QUEUE"] });
    global.fetch = fetch;
    await assert.rejects(
      runFluxStandardization("https://example.com/in.jpg", "fake-key", {}, "", null, {
        deadlineAt: Date.now() + 30,
        pollIntervalMs: 5,
      }),
      /standardization_timeout: FLUX poll exceeded the pipeline budget/
    );
  });

  it("a hung status fetch aborts after fetchTimeoutMs instead of hanging", async function () {
    const { fetch } = makeFetch({ hangStatus: true });
    global.fetch = fetch;
    await assert.rejects(
      runFluxStandardization("https://example.com/in.jpg", "fake-key", {}, "", null, {
        fetchTimeoutMs: 30,
        pollIntervalMs: 5,
      }),
      /FLUX request timed out after 30ms/
    );
  });

  it("a hung submit aborts after fetchTimeoutMs", async function () {
    const { fetch } = makeFetch({ hangSubmit: true });
    global.fetch = fetch;
    await assert.rejects(
      runFluxStandardization("https://example.com/in.jpg", "fake-key", {}, "", null, {
        fetchTimeoutMs: 30,
        pollIntervalMs: 5,
      }),
      /FLUX request timed out after 30ms/
    );
  });

  it("the 40-poll cap still ends the poll when no deadline is given", async function () {
    const { fetch, statusCalls } = makeFetch({ statusSequence: ["IN_QUEUE"] });
    global.fetch = fetch;
    await assert.rejects(
      runFluxStandardization("https://example.com/in.jpg", "fake-key", {}, "", null, { pollIntervalMs: 5 }),
      /FLUX timed out after/
    );
    assert.equal(statusCalls(), 40, "the cap is 40 polls, unchanged");
  });
});
