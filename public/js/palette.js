// GENERATED from functions/palette.js — do not edit by hand.
// Regenerate: node -e "<see functions/palette.js header>"
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
// This file is mirrored at public/js/palette.js for the client — keep the
// PALETTE arrays identical. tests/palette-sync.test.js enforces it.


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
function nearestFamily(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let best = null;
  let bestDist = Infinity;
  for (const p of PALETTE) {
    const prgb = hexToRgb(p.hex);
    const d =
      (rgb[0] - prgb[0]) * (rgb[0] - prgb[0]) +
      (rgb[1] - prgb[1]) * (rgb[1] - prgb[1]) +
      (rgb[2] - prgb[2]) * (rgb[2] - prgb[2]);
    if (d < bestDist) { bestDist = d; best = p.name; }
  }
  return best;
}

// Brand grouping key: "UNIQLO" and "Uniqlo" → "uniqlo". Display casing is
// never touched (H&M must not become H&m).
function brandKey(brand) {
  if (typeof brand !== "string") return null;
  const key = brand.trim().toLowerCase().replace(/\s+/g, " ");
  return key || null;
}



  global.Palette = { PALETTE: PALETTE, PALETTE_NAMES: PALETTE_NAMES, COLOR_ALIASES: COLOR_ALIASES, canonicalName: canonicalName, nearestFamily: nearestFamily, brandKey: brandKey };
})(typeof window !== "undefined" ? window : globalThis);
