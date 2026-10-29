"use strict";

// Server-side perceptual hash for RENDERS, in PC-19's
// hash space. phashFromGray / phashDistance are exact
// ports of the client functions in public/index.html
// (32x32 gray -> 8x8 low-frequency DCT coeffs minus DC
// -> 63 bits, median threshold), so the <= 5 Hamming
// threshold and its "same image lineage" meaning carry
// over unchanged. The only deliberate difference from
// the client's computePHash: a render is transparent,
// so it is composited over white before graying — the
// hash describes the garment as displayed, and the
// compositing ground is fixed so render-to-render
// comparisons are consistent. Render-vs-original
// cross-comparison is NOT claimed (different inputs,
// different grounds); render hashes compare renders.

const sharp = require("sharp");

function phashFromGray(g) {
  const N = 32;
  const coeffs = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      if (u === 0 && v === 0) continue; // skip DC (avg brightness)
      let sum = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          sum +=
            g[y * N + x] *
            Math.cos((Math.PI / N) * (x + 0.5) * u) *
            Math.cos((Math.PI / N) * (y + 0.5) * v);
        }
      }
      coeffs.push(sum);
    }
  }
  const sorted = coeffs.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let maxAbs = 0;
  for (let i = 0; i < coeffs.length; i++) {
    const a = Math.abs(coeffs[i]);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs < 1e-6) return "0000000000000000"; // degenerate: no AC energy
  let h = 0n;
  for (let i = 0; i < coeffs.length; i++) {
    if (coeffs[i] > med) h |= 1n << BigInt(i);
  }
  return h.toString(16).padStart(16, "0");
}

function phashDistance(a, b) {
  if (!a || !b || a.length !== 16 || b.length !== 16) return 99;
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let d = 0;
  while (x > 0n) {
    d += Number(x & 1n);
    x >>= 1n;
  }
  return d;
}

// Hash a render PNG: composite over white (the display
// ground), stretch to 32x32, gray with the client's
// exact luma weights, DCT-hash.
async function renderHash(pngBuffer) {
  const raw = await sharp(pngBuffer)
    .flatten({ background: "#ffffff" })
    .resize(32, 32, { fit: "fill" })
    .raw()
    .toBuffer();
  const g = new Array(1024);
  for (let i = 0; i < 1024; i++) {
    g[i] =
      0.299 * raw[i * 3] + 0.587 * raw[i * 3 + 1] + 0.114 * raw[i * 3 + 2];
  }
  return phashFromGray(g);
}

module.exports = { phashFromGray, phashDistance, renderHash };
