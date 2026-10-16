// GENERATED from functions/palette.js — do not edit by hand.
// (tests/palette-sync.test.js fails if the two drift.)
(function (global) {
"use strict";
// palette.js — the canonical color vocabulary (PC-8 follow-up).
//
// Why: free-text color names ("navy" vs "midnight blue") poison any future
// color-theory work (harmony / clash diagnosis needs stable families).
// The AI prompt is constrained to these names; user-added colors resolve
// to the nearest family by hex. Old free-text names map through aliases.
//
// Mirrored at public/js/palette.js for the client. Regenerate after edits:
//   node -e "const fs=require('fs');let s=fs.readFileSync('functions/palette.js','utf8').replace('\"use strict\";','').replace(/module\.exports = .*;/,'');fs.writeFileSync('public/js/palette.js','// GENERATED from functions/palette.js — do not edit by hand.\n// (tests/palette-sync.test.js fails if the two drift.)\n(function (global) {\n\"use strict\";\n'+s+'\n  global.Palette = { PALETTE: PALETTE, PALETTE_NAMES: PALETTE_NAMES, COLOR_ALIASES: COLOR_ALIASES, canonicalName: canonicalName, nearestFamily: nearestFamily, brandKey: brandKey };\n})(typeof window !== \"undefined\" ? window : globalThis);\n')"
// tests/palette-sync.test.js enforces the two stay identical.


const PALETTE = [
  // neutrals
  { name: "black", hex: "#1c1c1e" },
  { name: "charcoal", hex: "#3a3f45" },
  { name: "grey", hex: "#8e9399" },
  { name: "light grey", hex: "#c7cacc" },
  { name: "white", hex: "#f4f4f2" },
  { name: "cream", hex: "#f0e6d2" },
  { name: "ivory", hex: "#fbfbf3" },
  { name: "beige", hex: "#d8c39a" },
  { name: "tan", hex: "#c19a6b" },
  { name: "camel", hex: "#a97c50" },
  { name: "brown", hex: "#6f4e2e" },
  // blues
  { name: "navy", hex: "#22304f" },
  { name: "blue", hex: "#2f5da3" },
  { name: "light blue", hex: "#9fc3e0" },
  { name: "denim", hex: "#4a6b8a" },
  { name: "teal", hex: "#2a7f7f" },
  // greens
  { name: "forest green", hex: "#2f5d3a" },
  { name: "olive", hex: "#6b6b3a" },
  { name: "sage", hex: "#9caf88" },
  { name: "mint", hex: "#b8e0c8" },
  // reds / pinks
  { name: "burgundy", hex: "#6e1e2b" },
  { name: "red", hex: "#c0392b" },
  { name: "rust", hex: "#b0552f" },
  { name: "coral", hex: "#e8806c" },
  { name: "pink", hex: "#e8a0b4" },
  { name: "blush", hex: "#f2d3d8" },
  // yellows / oranges
  { name: "mustard", hex: "#d1a43c" },
  { name: "yellow", hex: "#f2d24b" },
  { name: "orange", hex: "#e07b39" },
  // purples
  { name: "purple", hex: "#6a4a8a" },
  { name: "lavender", hex: "#b9a7d6" },
  { name: "plum", hex: "#5d2f4a" },
];

const PALETTE_NAMES = PALETTE.map((p) => p.name);

// Common free-text variants from older AI outputs → canonical.
const COLOR_ALIASES = {
  "navy blue": "navy", "midnight blue": "navy", "dark blue": "navy",
  "royal blue": "blue", "cobalt": "blue", "cobalt blue": "blue",
  "baby blue": "light blue", "powder blue": "light blue", "sky blue": "light blue",
  "dark green": "forest green", "emerald": "forest green", "emerald green": "forest green",
  "army green": "olive", "khaki green": "olive",
  "maroon": "burgundy", "wine": "burgundy",
  "crimson": "red", "scarlet": "red", "cherry red": "red",
  "terracotta": "rust", "burnt orange": "rust",
  "peach": "coral", "salmon": "coral",
  "hot pink": "pink", "magenta": "pink", "fuchsia": "pink", "mauve": "pink",
  "nude": "beige", "khaki": "tan", "sand": "beige",
  "off white": "cream", "off-white": "cream", "eggshell": "cream",
  "charcoal grey": "charcoal", "charcoal gray": "charcoal",
  "dark grey": "charcoal", "dark gray": "charcoal", "graphite": "charcoal",
  "silver": "light grey", "light gray": "light grey",
  "chocolate": "brown", "chocolate brown": "brown", "espresso": "brown", "coffee": "brown",
  "aqua": "teal", "turquoise": "teal",
  "lilac": "lavender", "violet": "purple",
  "goldenrod": "mustard", "gold": "mustard",
};

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Map a raw color name to the canonical palette (exact → alias → null).
function canonicalName(raw) {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (PALETTE_NAMES.indexOf(key) !== -1) return key;
  return COLOR_ALIASES[key] || null;
}

// Nearest palette family for a hex (user-picked colors). Null when unusable.
// Sprint 5: distance is measured in OKLCH (perceptually uniform) — RGB
// distance calls dark navy and black "close" and can't tell mustard from
// gold reliably. Code measures; the model judges.
function nearestFamily(hex) {
  const target = hexToOklch(hex);
  if (!target) return null;
  let best = null;
  let bestDist = Infinity;
  for (const p of PALETTE) {
    const d = oklchDistance(target, hexToOklch(p.hex));
    if (d < bestDist) { bestDist = d; best = p.name; }
  }
  return best;
}

// hex → OKLCH {L 0..1, C, H 0..360}. Null for garbage input.
function hexToOklch(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = rgb.map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const r = lin[0], g = lin[1], b = lin[2];
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = Math.atan2(bb, a) * 180 / Math.PI;
  if (H < 0) H += 360;
  return { L: L, C: C, H: H };
}

function oklchDistance(c1, c2) {
  const dL = (c1.L - c2.L) * 1.2; // lightness dominates garment matching
  const dC = (c1.C - c2.C) * 0.8;
  let dH = Math.abs(c1.H - c2.H);
  if (dH > 180) dH = 360 - dH;
  // Hue is noise when chroma is low (greys) — weight it by saturation.
  const dHc = (dH / 180) * Math.min(c1.C, c2.C) * 1.5;
  return dL * dL + dC * dC + dHc * dHc;
}

// Brand grouping key: "UNIQLO" and "Uniqlo" → "uniqlo". Display casing is
// never touched (H&M must not become H&m).
function brandKey(brand) {
  if (typeof brand !== "string") return null;
  const key = brand.trim().toLowerCase().replace(/\s+/g, " ");
  return key || null;
}



  global.Palette = { PALETTE: PALETTE, PALETTE_NAMES: PALETTE_NAMES, COLOR_ALIASES: COLOR_ALIASES, canonicalName: canonicalName, nearestFamily: nearestFamily, hexToOklch: hexToOklch, oklchDistance: oklchDistance, brandKey: brandKey };
})(typeof window !== "undefined" ? window : globalThis);
