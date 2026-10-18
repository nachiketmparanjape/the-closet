// WX-1: weather-aware stylist. Client helpers are extracted from
// public/index.html (multi-line, 6-space closing indent); the sanitizer and
// prompt block are required from functions/stylist.js directly.
const fs = require("fs");
const path = require("path");
const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
  sanitizeItems,
  sanitizeWeatherContext,
  buildStylistRequest,
} = require("../functions/stylist.js");

function extractClientSrc(name, arg) {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "public", "index.html"),
    "utf8"
  );
  const m = html.match(
    new RegExp("function " + name + "\\(" + arg + "\\) \\{[\\s\\S]*?\\n      \\}")
  );
  assert.ok(m, name + " not found in client HTML");
  return m[0];
}

function extractClientFn(name, arg, preamble) {
  const src = extractClientSrc(name, arg);
  const body = src.replace(/^function \w+\(\w+\) \{/, "").replace(/\n      \}$/, "");
  return new Function(arg, (preamble || "") + body);
}

const weatherCodeToWord = extractClientFn("weatherCodeToWord", "code");
const formatWeatherSummary = extractClientFn(
  "formatWeatherSummary",
  "current",
  extractClientSrc("weatherCodeToWord", "code") + "\n"
);

describe("weatherCodeToWord", () => {
  test("maps common WMO codes", () => {
    assert.strictEqual(weatherCodeToWord(0), "clear");
    assert.strictEqual(weatherCodeToWord(2), "partly cloudy");
    assert.strictEqual(weatherCodeToWord(3), "overcast");
    assert.strictEqual(weatherCodeToWord(63), "rain");
    assert.strictEqual(weatherCodeToWord(71), "light snow");
    assert.strictEqual(weatherCodeToWord(95), "thunderstorm");
  });
  test("unknown codes yield empty string", () => {
    assert.strictEqual(weatherCodeToWord(999), "");
    assert.strictEqual(weatherCodeToWord("nope"), "");
  });
});

describe("formatWeatherSummary", () => {
  test("formats temp and condition", () => {
    assert.strictEqual(
      formatWeatherSummary({ temperature_2m: 68.4, weather_code: 0 }),
      "68°F, clear"
    );
  });
  test("omits condition when the code is unknown", () => {
    assert.strictEqual(
      formatWeatherSummary({ temperature_2m: 55.1, weather_code: 999 }),
      "55°F"
    );
  });
  test("returns null without a temperature", () => {
    assert.strictEqual(formatWeatherSummary({ weather_code: 0 }), null);
    assert.strictEqual(formatWeatherSummary(null), null);
  });
});

describe("sanitizeWeatherContext", () => {
  test("passes a short string through", () => {
    assert.strictEqual(sanitizeWeatherContext("68°F, clear"), "68°F, clear");
  });
  test("rejects non-strings, empties, and overlong input", () => {
    assert.strictEqual(sanitizeWeatherContext(null), null);
    assert.strictEqual(sanitizeWeatherContext("   "), null);
    assert.strictEqual(sanitizeWeatherContext(42), null);
    assert.strictEqual(sanitizeWeatherContext("x".repeat(500)).length, 200);
  });
});

describe("buildStylistRequest weather block (WX-1)", () => {
  const items = sanitizeItems([
    { id: "aaa", name: "Navy Tee", category: "Tops" },
    { id: "bbb", name: "Tan Shorts", category: "Bottoms" },
  ]);
  const messages = [{ role: "user", text: "suggest something right now" }];
  test("adds the CURRENT WEATHER block with the measured summary", () => {
    const { config } = buildStylistRequest(items, messages, [], null, null, "68°F, clear");
    assert.ok(config.systemInstruction.includes("CURRENT WEATHER"));
    assert.ok(config.systemInstruction.includes("68°F, clear"));
  });
  test("omits the block without weather context (backwards compatible)", () => {
    const { config } = buildStylistRequest(items, messages, [], null, null, null);
    assert.ok(!config.systemInstruction.includes("CURRENT WEATHER"));
  });
});
