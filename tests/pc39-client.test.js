// PC-39 wiring guards: the trip weather pill + the silent
// stale re-check. String-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("the weather element is a button (a pill you can tap)", () => {
  assert.ok(html.includes('<button type="button" id="tripDetailWeather" hidden></button>'), "pill markup missing");
});

test("refresh helpers exist and the pill is bound", () => {
  assert.ok(html.includes("function refreshTripWeather(trip, manual)"), "refresh missing");
  assert.ok(html.includes("function maybeAutoRecheckWeather(trip, ws)"), "auto-check missing");
  assert.ok(html.includes('getElementById("tripDetailWeather").addEventListener("click"'), "click binding missing");
});

test("staleness covers missing, >24h, and first-day-with-fallback", () => {
  assert.ok(html.includes("now - ws.checkedMs > 86400000"), "24h rule missing");
  assert.ok(html.includes("!ws.forecastAvailable"), "fallback rule missing");
  assert.ok(html.includes("weatherAutoChecked[trip.id]"), "session guard missing");
});

test("planning stamps the trip-level weather fields", () => {
  assert.ok(html.includes("tripUpd.weatherSnapshot = weather.summary"), "planning stamp missing");
});
