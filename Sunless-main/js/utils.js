// js/utils.js
// Small shared helpers. Keep this file dependency-free.

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Deterministic pseudo-random generator (so every client can generate the
// same forest layout from the same seed without syncing tree positions).
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
