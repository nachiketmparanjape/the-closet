// NAMING-1: the short-name standard, shared by every callable that
// mints a display title. A shortName is a noun phrase of at most
// 5 words — no commas, no clauses, no "with/featuring" tails —
// because cards and headers render it verbatim. The full prose
// (name / note / description) stays in detail views where it
// belongs. Pure + dependency-free so the client backfill and the
// tests can share the exact same rule.
function capShortName(text, maxWords) {
  var max = maxWords || 5;
  var s = String(text == null ? "" : text).trim();
  if (!s) return "";
  s = s.split(/,| with | featuring | - | – | — |: /)[0].trim();
  s = s.replace(/^(a|an|the)\s+/i, ""); // card labels drop the article
  var words = s.split(/\s+/).filter(Boolean);
  if (words.length > max) s = words.slice(0, max).join(" ");
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1); // labels start a title
  return s.slice(0, 48);
}
module.exports = { capShortName };
