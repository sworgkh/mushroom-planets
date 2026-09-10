// Seeded randomness and noise. Everything here that "looks random" goes
// through here so a seed reproduces the exact same world.

/** FNV-1a string hash → 32-bit unsigned int. Lets a seed be a word, not a number. */
export function hashSeed(input) {
  if (typeof input === 'number') return input >>> 0;
  let h = 0x811c9dc5;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for art. */
export class Rng {
  constructor(seed = 1) {
    this.state = hashSeed(seed) || 1;
  }

  /** Uniform float in [0, 1). */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  /** A child generator, so one subsystem's draw count cannot shift another's. */
  fork(label) {
    return new Rng(hashSeed(`${this.state}:${label}`));
  }
}

// --- Value noise --------------------------------------------------------------

function hash3(x, y, z, seed) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647 >>> 3);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth 3D value noise in [0, 1]. */
export function valueNoise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  const y0 = lerp(x00, x10, yf);
  const y1 = lerp(x01, x11, yf);
  return lerp(y0, y1, zf);
}

/** Layered noise in [-1, 1]: a few octaves of valueNoise3. */
export function fbm3(x, y, z, { octaves = 4, seed = 0, lacunarity = 2, gain = 0.5 } = {}) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise3(x * freq, y * freq, z * freq, seed + i * 101) * 2 - 1);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// --- Cellular (Worley) noise -----------------------------------------------

/**
 * Distance to the nearest jittered grid point, normalised so 0 = on a point
 * and ~1 = as far as you can get. Pits/cells/honeycomb.
 */
export function worley3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let best = 9;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const cx = xi + dx, cy = yi + dy, cz = zi + dz;
    const px = cx + hash3(cx, cy, cz, seed);
    const py = cy + hash3(cx, cy, cz, seed + 7);
    const pz = cz + hash3(cx, cy, cz, seed + 13);
    const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
    if (d < best) best = d;
  }
  return Math.min(1, Math.sqrt(best) / 0.9);
}

/** Nearest and second-nearest feature distances [F1, F2] in grid units. F2−F1 is small on cell edges. */
export function worleyF12(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let f1 = 9, f2 = 9;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const cx = xi + dx, cy = yi + dy, cz = zi + dz;
    const px = cx + hash3(cx, cy, cz, seed);
    const py = cy + hash3(cx, cy, cz, seed + 7);
    const pz = cz + hash3(cx, cy, cz, seed + 13);
    const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [Math.sqrt(f1), Math.sqrt(f2)];
}
