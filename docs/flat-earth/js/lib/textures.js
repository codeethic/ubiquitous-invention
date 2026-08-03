/**
 * Procedural texture generation. Canvas-dependent, so none of this is
 * reachable from `node --test` — everything testable was pushed down into
 * noise.js and map-projection.js on purpose.
 *
 * Lifetime: generated once at boot, cached in TEXTURES, NEVER disposed. This
 * is deliberately the same rule MATERIALS follows, so disposeTree's
 * `userData.ownsMaterial` logic keeps working untouched and no texture is ever
 * freed out from under a live scene. Switching phenomena 20 times allocates
 * nothing.
 *
 * Failure policy: generateTextures() never throws. Every field stays null and
 * primitives.js falls back to flat colour — the app then looks exactly as it
 * did before this work, with every readout unaffected. Textures are an
 * enhancement, never a dependency.
 */
import * as THREE from 'three';
import { fbm, ridge, clamp01, lerp, smoothstep, colorLerp } from './noise.js';
import { equirectUV, discUV, densifyRing } from './map-projection.js';

const EQUIRECT_W = 1024, EQUIRECT_H = 512;
const DISC_SIZE = 1024;
const DENSIFY_STEP_DEG = 2;

export const TEXTURES = {
  ready: false,
  earth: null, earthNormal: null,
  disc: null, discNormal: null,
  oceanNormal: null,
  sun: null, moon: null,
};

let rings = null;

/** Fetch the coastline rings. Throws on failure; the caller decides what that means. */
export async function loadCoastlines() {
  const res = await fetch('./data/coastlines.json');
  if (!res.ok) throw new Error(`coastlines.json returned HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.rings) || data.rings.length === 0) {
    throw new Error('coastlines.json contained no rings');
  }
  rings = data.rings;
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

/**
 * Rasterise the land rings into a Uint8Array mask, 255 = land.
 *
 * Uses the canvas fill() rasteriser rather than per-pixel point-in-polygon.
 * The naive version is 524,288 pixels x 5,143 points = 2.7 BILLION operations
 * and hangs the tab; this is a native fill and a single readback.
 */
function landMask(w, h, project) {
  if (!rings) return null;
  const { c, ctx } = canvas2d(w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const ring of rings) {
    const dense = densifyRing(ring, DENSIFY_STEP_DEG);
    for (let i = 0; i < dense.length; i += 1) {
      const [lon, lat] = dense[i];
      const { u, v } = project(lat, lon);
      const x = u * w, y = v * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill();

  const src = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i += 1) mask[i] = src[i * 4];
  return mask;
}

const DEEP    = [0.04, 0.13, 0.28];
const SHALLOW = [0.10, 0.32, 0.48];
const SAND    = [0.68, 0.62, 0.44];
const GRASS   = [0.18, 0.34, 0.20];
const ROCK    = [0.38, 0.35, 0.30];
const SNOW    = [0.92, 0.94, 0.96];

/** Paint albedo over a land/sea mask. Shapes are real; only the texture is invented. */
function paintSurface(w, h, mask, latOf) {
  const { c, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const land = mask ? mask[i] > 127 : false;
      const nx = x / w * 8, ny = y / h * 8;
      let rgb;
      if (land) {
        const elev = fbm(nx * 3, ny * 3, 5);
        const rough = ridge(nx * 6, ny * 6, 4);
        rgb = colorLerp(GRASS, ROCK, smoothstep(0.45, 0.75, elev));
        rgb = colorLerp(SAND, rgb, smoothstep(0.02, 0.12, elev));
        rgb = colorLerp(rgb, SNOW,
          smoothstep(0.72, 0.95, elev * 0.6 + Math.abs(latOf(y / h)) / 90 * 0.7));
        rgb = rgb.map(v => clamp01(v * (0.85 + rough * 0.3)));
      } else {
        const depth = fbm(nx * 2, ny * 2, 4);
        rgb = colorLerp(DEEP, SHALLOW, smoothstep(0.35, 0.8, depth));
      }
      const o = i * 4;
      img.data[o] = rgb[0] * 255;
      img.data[o + 1] = rgb[1] * 255;
      img.data[o + 2] = rgb[2] * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Sobel a luminance field into a tangent-space normal map. */
function normalFrom(sourceCanvas, strength = 2) {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const read = sourceCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const lum = i => (read[i * 4] * 0.299 + read[i * 4 + 1] * 0.587
    + read[i * 4 + 2] * 0.114) / 255;

  const { c, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  const at = (x, y) => lum(((y + h) % h) * w + ((x + w) % w));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * w + x) * 4;
      img.data[o] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (-dy / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Seamless tiling ocean ripple. Shading only — it displaces no geometry. */
function oceanDetail(size = 512) {
  const { c, ctx } = canvas2d(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = clamp01(fbm(x / size * 12, y / size * 12, 4) * 0.6 + 0.2);
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return normalFrom(c, 1.2);
}

/**
 * Limb-darkened solar disc on a transparent square.
 *
 * NO bloom, NO halo, NO flare: sun-size measures apparent angular diameter,
 * and any glow beyond the disc edge makes that edge unreadable, destroying the
 * 0.533 deg vs 0.177 deg comparison the module exists to show. The alpha falls
 * to zero exactly at the geometric edge.
 */
function sunDisc(size = 256) {
  const { c, ctx } = canvas2d(size, size);
  const img = ctx.createImageData(size, size);
  const R = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - R + 0.5, y - R + 0.5) / R;
      const o = (y * size + x) * 4;
      if (r > 1) { img.data[o + 3] = 0; continue; }
      const mu = Math.sqrt(Math.max(0, 1 - r * r));
      const b = 0.35 + 0.65 * mu;                 // classic limb darkening
      img.data[o] = 255 * clamp01(b * 1.0);
      img.data[o + 1] = 255 * clamp01(b * 0.93);
      img.data[o + 2] = 255 * clamp01(b * 0.75);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Cratered lunar surface. Relief stays far below the eclipse curvature signal. */
function moonSurface(w = 512, h = 256) {
  const { c, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = x / w * 10, ny = y / h * 10;
      const base = fbm(nx, ny, 5);
      const maria = smoothstep(0.42, 0.58, fbm(nx * 0.5, ny * 0.5, 3));
      const v = clamp01(lerp(0.62, 0.32, maria) * (0.8 + base * 0.4));
      const o = (y * w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function texture(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function dataTexture(c, { repeat = false } = {}) {
  // Normal maps carry vectors, not colour: tagging them sRGB would gamma-decode
  // the vectors and tilt every surface normal the wrong way.
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

/**
 * Generate every texture once. Never throws — on any failure the cache stays
 * null and the app renders exactly as it did before this work.
 */
export async function generateTextures() {
  const started = performance.now();
  try {
    const equirectMask = landMask(EQUIRECT_W, EQUIRECT_H,
      (lat, lon) => equirectUV(lat, lon));
    const discMask = landMask(DISC_SIZE, DISC_SIZE,
      (lat, lon) => discUV(lat, lon));

    const earthC = paintSurface(EQUIRECT_W, EQUIRECT_H, equirectMask,
      vy => 90 - vy * 180);
    // On the disc, texture-space distance from the centre IS colatitude.
    const discC = paintSurface(DISC_SIZE, DISC_SIZE, discMask, () => 0);

    TEXTURES.earth = texture(earthC);
    TEXTURES.earthNormal = dataTexture(normalFrom(earthC));
    TEXTURES.disc = texture(discC);
    TEXTURES.discNormal = dataTexture(normalFrom(discC));
    TEXTURES.oceanNormal = dataTexture(oceanDetail(), { repeat: true });
    TEXTURES.sun = texture(sunDisc());
    TEXTURES.moon = texture(moonSurface());
    TEXTURES.ready = true;
  } catch (err) {
    console.warn('Texture generation failed; falling back to flat colour.', err);
    // Null out EVERY field, not just ready: a throw partway through the try
    // block above leaves every field assigned before the throw point still
    // populated. Partial texture state is indistinguishable from success to
    // a consumer that only checks its own field (e.g. makeSun checking
    // TEXTURES.sun) instead of TEXTURES.ready, so a half-populated cache is
    // as dangerous as a wrongly-flagged one.
    TEXTURES.earth = null; TEXTURES.earthNormal = null;
    TEXTURES.disc = null; TEXTURES.discNormal = null;
    TEXTURES.oceanNormal = null;
    TEXTURES.sun = null; TEXTURES.moon = null;
    TEXTURES.ready = false;
  }
  const ms = Math.round(performance.now() - started);
  console.info(`[flat-earth] textures generated in ${ms} ms`);
  if (ms > 400) {
    console.warn(`[flat-earth] texture budget exceeded: ${ms} ms > 400 ms. ` +
      'Reduce fbm octaves before reducing resolution.');
  }
}
