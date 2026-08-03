/**
 * Value noise and fbm, used to generate every texture in the app.
 *
 * Deliberately imports nothing — not Three.js, not the DOM — so it runs under
 * `node --test`. The texture generators that consume it cannot be tested
 * headlessly (they need a 2D canvas), so pushing every testable line down
 * here is what keeps automated coverage on the maths.
 *
 * Adapted from the same approach used in src/solar-system-explorer/js/textures.js.
 */

export function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Value noise with a quintic fade. The fade curve matters: a linear blend
 * leaves visible lattice seams, and those seams read as a regular grid across
 * an ocean that is supposed to look natural.
 */
export function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Fractal Brownian motion. Normalised by the amplitude sum so the result stays
 * in [0,1] for any octave count — without that division, dropping octaves to
 * meet the boot-time budget would also darken every texture.
 */
export function fbm(x, y, octaves = 6, lacunarity = 2, gain = 0.5) {
  let val = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i += 1) {
    val += amp * noise2D(x * freq, y * freq);
    total += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return total > 0 ? val / total : 0;
}

/** Ridged noise, for coastline crenellation and mountain detail. */
export function ridge(x, y, octaves = 5) {
  let val = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i += 1) {
    let n = noise2D(x * freq, y * freq);
    n = 1 - Math.abs(n * 2 - 1);
    val += amp * n * n;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total > 0 ? val / total : 0;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = v => Math.max(0, Math.min(1, v));
export function smoothstep(lo, hi, t) {
  const x = clamp01((t - lo) / (hi - lo));
  return x * x * (3 - 2 * x);
}
export const colorLerp = (c1, c2, t) => [
  lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t),
];
