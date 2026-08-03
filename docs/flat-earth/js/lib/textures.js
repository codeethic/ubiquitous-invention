/**
 * Procedural texture generation. Canvas-dependent, so none of this is
 * reachable from `node --test` — everything testable was pushed down into
 * noise.js and map-projection.js on purpose.
 *
 * Lifetime: generated ONCE, cached in TEXTURES, NEVER disposed. This is
 * deliberately the same rule MATERIALS follows, so disposeTree's
 * `userData.ownsMaterial` logic keeps working untouched and no texture is ever
 * freed out from under a live scene. Switching phenomena 20 times allocates
 * nothing.
 *
 * Timing: that "once" is NOT during boot. generateTextures() is called from
 * main.js's scheduleTextureUpgrade(), after the first frame has been painted,
 * because generation costs ~1.7 s and nothing in the app needs it — every
 * readout comes from js/physics/ and every surface has a flat fallback colour.
 * applyMaterials() then upgrades the live scene in place. Consequences worth
 * knowing: TEXTURES.ready is false for the first ~1.7 s of a perfectly healthy
 * session, not only after a failure (see makeSun in primitives.js), and this
 * module must never be imported for its side effects.
 *
 * Failure policy: generateTextures() never throws. Every field stays null and
 * primitives.js falls back to flat colour — the app then looks exactly as it
 * did before this work, with every readout unaffected. Textures are an
 * enhancement, never a dependency.
 */
import * as THREE from 'three';
import { fbm, ridge, clamp01, smoothstep } from './noise.js';
import {
  equirectUV, discUV, densifyRing, EQUIRECT_FLIP_Y, DISC_FLIP_Y,
} from './map-projection.js';
import { fetchJson } from './fetch-json.js';

const EQUIRECT_W = 1024, EQUIRECT_H = 512;
const DISC_SIZE = 1024;
const DENSIFY_STEP_DEG = 2;

/**
 * Octave counts, gathered here because they are the app's stated first lever
 * for the boot-time texture budget: "reduce fbm octaves before reducing
 * resolution". See generateTextures() for the measured cost of each.
 */
const LAND_ELEV_OCTAVES = 4;
const LAND_ROUGH_OCTAVES = 3;
const SEA_DEPTH_OCTAVES = 3;
const OCEAN_RIPPLE_OCTAVES = 3;

/**
 * How many times the tiling ocean-ripple normal map repeats across a surface's
 * UV range. Deliberately low: on horizon's 200 km ocean plane this is one tile
 * per 25 km, i.e. a broad, gentle shading variation. A high repeat would put
 * high-frequency normal detail right along the limb at a grazing angle, which
 * is precisely where horizon reads how much of the hull is occluded — the
 * measurement outranks the realism.
 */
const OCEAN_TILE_REPEAT = 8;

/**
 * Regression tripwire for generateTextures(), milliseconds. NOT a boot budget.
 *
 * Generation used to run behind the loading screen, where every millisecond
 * was a millisecond the user spent looking at an overlay, and the design set a
 * 400 ms ceiling on it. It no longer runs there: main.js starts it after the
 * first frame has been painted, so this time is spent on an app the user is
 * already using and it gates nothing. Measured cost in-browser: ~1,735 ms.
 *
 * 2,600 ms is about 1.5x that — high enough not to cry wolf on a machine
 * slower than the one it was measured on, low enough that a real regression
 * (an octave count restored, a resolution doubled, an accidental O(n^2)) still
 * trips it. The number worth comparing against is the PREVIOUS run, which is
 * why the measured time is logged unconditionally either way.
 */
const SLOW_GENERATION_MS = 2600;

export const TEXTURES = {
  ready: false,
  earth: null, earthNormal: null,
  disc: null, discNormal: null,
  oceanNormal: null,
  sun: null,
};

let rings = null;

/**
 * Fetch the coastline rings. Throws on failure; the caller decides what that
 * means.
 *
 * Bounded by fetchJson, which is where the reasoning about STALLED versus
 * rejecting connections lives. This call used to sit on the path to
 * setLoading(false); it now runs after first paint, but an unbounded stall
 * would still pin a connection and leave the world without continents and
 * nothing on the console to say why.
 */
export async function loadCoastlines() {
  const data = await fetchJson('./data/coastlines.json', { label: 'coastlines.json' });
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

/**
 * Paint albedo over a land/sea mask. Shapes are real; only the texture is
 * invented.
 *
 * `latOf(u, v)` receives BOTH texture coordinates, not just v. The equirect
 * map only needs v — latitude is a pure function of the row — but on the disc
 * the azimuthal-equidistant radius from the centre IS colatitude, so latitude
 * there depends on u and v together. Passing only v is what left Antarctica
 * green on the disc while it was white on the globe: the same continent,
 * shaded two different ways, in two panes shown side by side.
 *
 * Written with scalar r/g/b rather than colorLerp's arrays: this loop runs
 * 1.6 million times at boot and the three-element array each call allocated
 * was pure garbage-collector pressure. The arithmetic is unchanged.
 */
function paintSurface(w, h, mask, latOf) {
  const { c, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    const v = y / h, ny = v * 8;
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const land = mask ? mask[i] > 127 : false;
      const u = x / w, nx = u * 8;
      let r, g, b;
      if (land) {
        const elev = fbm(nx * 3, ny * 3, LAND_ELEV_OCTAVES);
        const rough = ridge(nx * 6, ny * 6, LAND_ROUGH_OCTAVES);
        let t = smoothstep(0.45, 0.75, elev);
        r = GRASS[0] + (ROCK[0] - GRASS[0]) * t;
        g = GRASS[1] + (ROCK[1] - GRASS[1]) * t;
        b = GRASS[2] + (ROCK[2] - GRASS[2]) * t;
        t = smoothstep(0.02, 0.12, elev);
        r = SAND[0] + (r - SAND[0]) * t;
        g = SAND[1] + (g - SAND[1]) * t;
        b = SAND[2] + (b - SAND[2]) * t;
        t = smoothstep(0.72, 0.95,
          elev * 0.6 + Math.abs(latOf(u, v)) / 90 * 0.7);
        r += (SNOW[0] - r) * t;
        g += (SNOW[1] - g) * t;
        b += (SNOW[2] - b) * t;
        const k = 0.85 + rough * 0.3;
        r = clamp01(r * k); g = clamp01(g * k); b = clamp01(b * k);
      } else {
        const t = smoothstep(0.35, 0.8, fbm(nx * 2, ny * 2, SEA_DEPTH_OCTAVES));
        r = DEEP[0] + (SHALLOW[0] - DEEP[0]) * t;
        g = DEEP[1] + (SHALLOW[1] - DEEP[1]) * t;
        b = DEEP[2] + (SHALLOW[2] - DEEP[2]) * t;
      }
      const o = i * 4;
      d[o] = r * 255;
      d[o + 1] = g * 255;
      d[o + 2] = b * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, image: img };
}

/**
 * Sobel a luminance field into a tangent-space normal map.
 *
 * `vDown` says which way texture v runs across the SOURCE CANVAS ROWS, and it
 * decides the sign of the green channel. Three.js builds its tangent frame
 * from d(position)/d(uv), so the green channel is the normal's component
 * along increasing *texture v* — and the correct value for a height field is
 * −∂h/∂v. This function only ever measures ∂h/∂(canvas row); the two are the
 * same thing only when v increases with the row index.
 *
 *   vDown = true  (flipY false — the disc maps): row 0 is v = 0, so
 *                 ∂h/∂v = +∂h/∂row and green = −dy.
 *   vDown = false (flipY true — the equirect and ocean maps): the upload
 *                 flips the image, so row 0 is v = 1, ∂h/∂v = −∂h/∂row, and
 *                 green must be +dy.
 *
 * Get this wrong and nothing looks broken — every hill is simply lit from the
 * wrong side, so relief that should catch the sun sits in shade and vice
 * versa. Red needs no such treatment: no flipX exists, and canvas x increases
 * with u on every map here.
 */
function normalFrom(sourceImage, { strength = 2, vDown } = {}) {
  const w = sourceImage.width, h = sourceImage.height;
  const read = sourceImage.data;
  // Precomputed rather than re-derived per neighbour: each pixel reads four
  // neighbours, so the luminance of every texel would otherwise be recomputed
  // four times over.
  const lum = new Float32Array(w * h);
  for (let i = 0; i < lum.length; i += 1) {
    lum[i] = (read[i * 4] * 0.299 + read[i * 4 + 1] * 0.587
      + read[i * 4 + 2] * 0.114) / 255;
  }
  const gSign = vDown ? -1 : 1;

  const { c, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    const rowC = y * w, rowUp = ((y - 1 + h) % h) * w, rowDn = ((y + 1) % h) * w;
    for (let x = 0; x < w; x += 1) {
      const xL = (x - 1 + w) % w, xR = (x + 1) % w;
      const dx = (lum[rowC + xR] - lum[rowC + xL]) * strength;
      const dy = (lum[rowDn + x] - lum[rowUp + x]) * strength;
      // sqrt, not Math.hypot: hypot's overflow-safe path costs ~10x here and
      // buys nothing — dx and dy are bounded by 2*strength and the result is
      // quantised to 8 bits immediately afterwards.
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const o = (rowC + x) * 4;
      d[o] = (-dx / len * 0.5 + 0.5) * 255;
      d[o + 1] = (gSign * dy / len * 0.5 + 0.5) * 255;
      d[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
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
      const v = clamp01(
        fbm(x / size * 12, y / size * 12, OCEAN_RIPPLE_OCTAVES) * 0.6 + 0.2);
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // vDown false: this map keeps CanvasTexture's default flipY = true.
  return normalFrom(img, { strength: 1.2, vDown: false });
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

// A moonSurface() generator and its TEXTURES.moon / MATERIALS.moon fields used
// to live here. They were never rendered: lunar-eclipse.js builds its own moon
// material. Deleted rather than wired up — the eclipse module measures the
// SHAPE of the shadow's edge, and cratered albedo across that edge is noise on
// the one thing it is asking the viewer to read.

/**
 * @param {HTMLCanvasElement} c
 * @param {{ flipY?: boolean, repeat?: number, crisp?: boolean }} opts
 */
function texture(c, { flipY = true, repeat = 0, crisp = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  configure(t, { flipY, repeat, crisp });
  return t;
}

function dataTexture(c, { flipY = true, repeat = 0 } = {}) {
  // Normal maps carry vectors, not colour: tagging them sRGB would gamma-decode
  // the vectors and tilt every surface normal the wrong way.
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  configure(t, { flipY, repeat, crisp: false });
  return t;
}

function configure(t, { flipY, repeat, crisp }) {
  // flipY decides whether canvas row 0 becomes texture v = 0 or v = 1, which
  // is the difference between a map and its mirror image. It is NOT a
  // per-texture taste setting: see EQUIRECT_FLIP_Y / DISC_FLIP_Y in
  // map-projection.js, where it is derived from each projection's v convention
  // and the geometry's UVs, and asserted against real geometry in
  // test/projection-vs-geometry.test.js.
  t.flipY = flipY;
  if (repeat > 0) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  if (crisp) {
    // The sun sprite's edge is the MEASURAND: sun-size reports apparent
    // angular diameter with maxDetail 0, meaning it claims the silhouette is
    // exactly where the geometry says it is. Mipmapping and anisotropic
    // filtering both blur that edge over a few pixels as the sprite shrinks,
    // which turns a declared-exact boundary into a soft gradient the viewer
    // has to guess at. LinearFilter with no mip chain keeps it a hard edge.
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 1;
  } else {
    t.anisotropy = 4;
  }
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

    // Equirect: latitude is a pure function of the row.
    const earth = paintSurface(EQUIRECT_W, EQUIRECT_H, equirectMask,
      (u, v) => 90 - v * 180);
    // Disc: texture-space distance from the centre IS colatitude, so latitude
    // needs both coordinates. The rim (radius 0.5) is the south pole at -90
    // and the centre is the north pole at +90 — which is what puts ice on
    // Antarctica's ring here as well as on the globe's cap.
    const disc = paintSurface(DISC_SIZE, DISC_SIZE, discMask,
      (u, v) => 90 - 180 * Math.hypot(u - 0.5, v - 0.5) / 0.5);

    TEXTURES.earth = texture(earth.canvas, { flipY: EQUIRECT_FLIP_Y });
    TEXTURES.earthNormal = dataTexture(
      normalFrom(earth.image, { vDown: !EQUIRECT_FLIP_Y }),
      { flipY: EQUIRECT_FLIP_Y });
    TEXTURES.disc = texture(disc.canvas, { flipY: DISC_FLIP_Y });
    TEXTURES.discNormal = dataTexture(
      normalFrom(disc.image, { vDown: !DISC_FLIP_Y }),
      { flipY: DISC_FLIP_Y });
    TEXTURES.oceanNormal = dataTexture(oceanDetail(), { repeat: OCEAN_TILE_REPEAT });
    TEXTURES.sun = texture(sunDisc(), { crisp: true });
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
    TEXTURES.sun = null;
    TEXTURES.ready = false;
  }
  const ms = Math.round(performance.now() - started);
  // Deliberately not called a "budget". This runs after first paint, on an app
  // that is already interactive, so the number is a cost to watch rather than
  // a promise to keep. History, so nobody re-derives it: the design assumed
  // <=400 ms behind the loading screen; measurement said 2,483 ms; octave
  // reduction and de-allocating the per-pixel loops brought it to ~1,735 ms;
  // and 400 ms turned out to be unreachable by the stated lever, because
  // collapsing every fbm and ridge in the app to ONE octave still floors at
  // ~376 ms of pure arithmetic before a single canvas call. The cost is 1.6
  // million per-pixel evaluations across 1024x512 plus 1024x1024, not the
  // octaves inside them. Rather than degrade the maps, generation moved off
  // the critical path entirely.
  console.info(
    `[flat-earth] textures generated in ${ms} ms (deferred; app was already interactive)`);
  if (ms > SLOW_GENERATION_MS) {
    console.warn(
      `[flat-earth] texture generation took ${ms} ms, well over the ~1735 ms ` +
      `baseline (tripwire ${SLOW_GENERATION_MS} ms). Nothing blocked on it, but ` +
      'this is long enough to be a regression — check octave counts and ' +
      'resolutions before assuming it is just a slow machine.');
  }
}
