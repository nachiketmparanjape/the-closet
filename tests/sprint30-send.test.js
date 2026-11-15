// Sprint 30 send-latency regression guards (founder report 2026-11-14).
// The user's message sat invisible for several seconds after Send:
// sendChat awaited getWeatherSummary() (geolocation, up to 10s)
// BEFORE pushing + rendering the message. The fix moved the weather
// await after the optimistic render. These are string-level, house style.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

function sendChatBody() {
  const start = html.indexOf("async function sendChat(event)");
  assert.ok(start !== -1, "sendChat missing");
  const end = html.indexOf('chatForm.addEventListener("submit", sendChat);', start);
  assert.ok(end !== -1, "sendChat end marker missing");
  return html.slice(start, end);
}

test("the user's message renders before the weather lookup runs", () => {
  const body = sendChatBody();
  const push = body.indexOf("stylistMessages.push(userMsg)");
  const render = body.indexOf("renderChat();");
  const weather = body.indexOf("await getWeatherSummary()");
  assert.ok(push !== -1, "user message push missing");
  assert.ok(render !== -1, "renderChat missing");
  assert.ok(weather !== -1, "weather await missing");
  assert.ok(push < weather, "message must be pushed before the weather await");
  assert.ok(render < weather, "message must render before the weather await");
});

test("weather context still rides in the payload (moved, not deleted)", () => {
  const body = sendChatBody();
  assert.ok(body.includes("var weatherContext = tripChat ? null : await getWeatherSummary();"), "weather lookup missing");
  assert.ok(body.includes("weatherContext: weatherContext,"), "weather context missing from payload");
});

test("send still guards on busy/user and clears the input", () => {
  const body = sendChatBody();
  assert.ok(body.includes("if (chatBusy || !currentUser) return;"), "busy/user guard missing");
  assert.ok(body.includes('chatInput.value = "";'), "input clear missing");
});
