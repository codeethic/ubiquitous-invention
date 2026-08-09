# Flat Earth Lab Realistic Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Flat Earth Lab's flat-shaded solid-colour rendering with procedurally textured surfaces, real coastline geography, and physically-cast shadows — without letting any added detail obscure the measurement its module exists to demonstrate.

**Architecture:** A shared world kit under `js/lib/` gains the realism; the eight phenomenon modules are almost untouched. Pure, browser-free logic (noise, projections, the signal budget, coastline data) lives in its own modules so `node --test` covers it. Canvas- and Three.js-dependent code sits above that line and is covered by the manual visual checklist.

**Tech Stack:** Vanilla ES modules, Three.js r185 (vendored), 2D canvas for texture generation, `node --test` for the headless suite. No bundler, no transpiler, no runtime dependencies.

## Global Constraints

Every task's requirements implicitly include this section.

- **No build step, no bundler, no runtime dependencies.** Browser code is vanilla ES modules loaded directly.
- **Three.js is vendored at r185** in `docs/flat-earth/third-party/` as two files and imported as `'three'` via the importmap in `index.html`. Never import from a CDN. Never import `three.core.js` directly.
- **`js/physics/` imports nothing external and does not change in this plan.** The 43 existing tests must stay green and untouched.
- **The module contract frozen in `docs/superpowers/specs/2026-08-02-flat-earth-design.md` does not change.** `build()` still returns `{ flat: {root, camera, rig}, globe: {root, camera, rig} }`; `rig` is still both-or-neither; `readout()` still must not throw and must not depend on `build()`.
- **Test command:** `node --test "docs/flat-earth/test/**/*.test.js"` (quoted glob — an unquoted path fails on Node 24/Windows).
- **Local server:** `cd docs/flat-earth && python serve.py`. Never `python -m http.server`; it serves `.js` as `text/plain` on Windows and the page goes blank.
- **The governing rule:** no visual detail may exceed the magnitude of the phenomenon its module measures. Where realism and measurement conflict, the measurement wins.
- **Nothing in this plan may introduce a new way for the page to go blank.** Every new asset and every new generation step degrades to the current appearance on failure.
- **Ocean vertical displacement is exactly 0.** Not small — zero. This keeps `hiddenHeightM()`'s 3.8 m signal intact by construction.
- **Jekyll excludes:** anything added under `docs/flat-earth/` that is not part of the running site must be added to `exclude:` in `docs/_config.yml`.

---

## File Structure

**Create — pure, browser-free, headless-tested:**

| File | Responsibility |
|---|---|
| `docs/flat-earth/js/lib/noise.js` | `hash`, `noise2D`, `fbm`, `ridge`, `lerp`, `clamp01`, `smoothstep`, `colorLerp`. No DOM, no Three.js. |
| `docs/flat-earth/js/lib/signal-budget.js` | `SIGNAL_BUDGET` table and `OCEAN_DISPLACEMENT_M`. Plain data, zero imports. |
| `docs/flat-earth/js/lib/map-projection.js` | `equirectUV`, `discUV`, `discToLatLon`, `densifyRing`. Imports `js/physics/geodesy.js` only. |

**Create — browser-side, covered by the visual checklist:**

| File | Responsibility |
|---|---|
| `docs/flat-earth/js/lib/textures.js` | Canvas texture generation and the `TEXTURES` cache. Owns all `CanvasTexture` objects for the app's lifetime. |
| `docs/flat-earth/js/lib/world.js` | Lighting rig helpers: `makeParallelSun`, `makeLocalSun`. |

**Create — data and tooling:**

| File | Responsibility |
|---|---|
| `docs/flat-earth/data/coastlines.json` | Natural Earth 110m land rings. Generated once, committed. |
| `docs/flat-earth/tools/build-coastlines.mjs` | Shapefile → JSON. Node-only, dev-only, never shipped to the browser. |

**Modify:**

| File | Change |
|---|---|
| `js/lib/materials.js` | Real PBR materials; keeps the shared-singleton pattern. |
| `js/lib/primitives.js` | Internals gain textures; **signatures unchanged**. `makeGnomon` loses its shadow plane. `makeSun` gains an attached light. |
| `js/viewport.js` | Colour space, tone mapping, shadow maps; the hard-coded `(1,1,1)` key light is removed. |
| `js/main.js` | Generate textures at boot behind the loading screen, with fallback. |
| `js/phenomena/eratosthenes.js` | Gains two differently-typed lights; drops `setShadow`. |
| `js/phenomena/midnight-sun.js` | One line: point the sun light's target at the root. |
| `js/phenomena/sun-size.js` | One line: point the sun light's target at the root. |
| `docs/_config.yml` | Exclude `flat-earth/tools`. |
| `docs/flat-earth/README.md` | Checklist rows for texture and geography; Natural Earth attribution. |

**Task dependency order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Tasks 1–4 are pure and change nothing visible. Task 5 populates textures without consuming them. Task 6 is the first visible change.

---

### Task 1: Pure noise module

**Files:**
- Create: `docs/flat-earth/js/lib/noise.js`
- Test: `docs/flat-earth/test/noise.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `hash(x, y) -> number`, `noise2D(x, y) -> number`, `fbm(x, y, octaves = 6, lacunarity = 2, gain = 0.5) -> number`, `ridge(x, y, octaves = 5) -> number`, `lerp(a, b, t) -> number`, `clamp01(v) -> number`, `smoothstep(lo, hi, t) -> number`, `colorLerp(c1, c2, t) -> [r, g, b]`. All values in `[0, 1]` except `lerp`/`colorLerp`, which follow their inputs.

- [ ] **Step 1: Write the failing test**

Create `docs/flat-earth/test/noise.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hash, noise2D, fbm, ridge, lerp, clamp01, smoothstep, colorLerp,
} from '../js/lib/noise.js';

test('hash is deterministic and in [0,1)', () => {
  for (const [x, y] of [[0, 0], [1.5, -2.25], [1000, 1000]]) {
    const a = hash(x, y);
    assert.equal(a, hash(x, y), 'same input must give same output');
    assert.ok(a >= 0 && a < 1, `hash(${x},${y}) = ${a} out of range`);
  }
});

test('noise2D is continuous across a lattice boundary', () => {
  // Approaching an integer from below and above must not jump. A discontinuity
  // here shows up as visible grid seams in every generated texture.
  const below = noise2D(0.999999, 0.3);
  const above = noise2D(1.000001, 0.3);
  assert.ok(Math.abs(below - above) < 1e-3,
    `seam at lattice boundary: ${below} vs ${above}`);
});

test('noise2D stays within [0,1]', () => {
  for (let i = 0; i < 500; i += 1) {
    const v = noise2D(i * 0.37, i * 0.91);
    assert.ok(v >= 0 && v <= 1, `noise2D out of range: ${v}`);
  }
});

test('fbm stays within [0,1] and varies with position', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const v = fbm(i * 0.13, i * 0.29);
    assert.ok(v >= 0 && v <= 1, `fbm out of range: ${v}`);
    seen.add(v.toFixed(4));
  }
  assert.ok(seen.size > 100, `fbm too flat: only ${seen.size} distinct values`);
});

test('ridge stays within [0,1]', () => {
  for (let i = 0; i < 200; i += 1) {
    const v = ridge(i * 0.17, i * 0.41);
    assert.ok(v >= 0 && v <= 1, `ridge out of range: ${v}`);
  }
});

test('clamp01 and smoothstep bound their outputs', () => {
  assert.equal(clamp01(-5), 0);
  assert.equal(clamp01(5), 1);
  assert.equal(clamp01(0.25), 0.25);
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});

test('lerp and colorLerp interpolate componentwise', () => {
  assert.equal(lerp(10, 20, 0.5), 15);
  assert.deepEqual(colorLerp([0, 0, 0], [1, 0.5, 0.25], 0.5), [0.5, 0.25, 0.125]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "docs/flat-earth/test/noise.test.js"`
Expected: FAIL — `Cannot find module .../js/lib/noise.js`

- [ ] **Step 3: Write the implementation**

Create `docs/flat-earth/js/lib/noise.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "docs/flat-earth/test/noise.test.js"`
Expected: PASS, 7 tests

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 50 tests (43 existing + 7 new)

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/js/lib/noise.js docs/flat-earth/test/noise.test.js
git commit -m "Add pure noise module for procedural textures"
```

---

### Task 2: Signal budget

**Files:**
- Create: `docs/flat-earth/js/lib/signal-budget.js`
- Test: `docs/flat-earth/test/signal-budget.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `SIGNAL_BUDGET` — an object keyed by module id, each value `{ signal: string, magnitude: number, maxDetail: number, unit: string }`. Also `OCEAN_DISPLACEMENT_M` (number, must be 0), imported by `primitives.js` in Task 6 so the constraint is a real code path rather than a comment.

- [ ] **Step 1: Write the failing test**

Create `docs/flat-earth/test/signal-budget.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNAL_BUDGET, OCEAN_DISPLACEMENT_M } from '../js/lib/signal-budget.js';

const MODULE_IDS = [
  'horizon', 'eratosthenes', 'midnight-sun', 'sun-size',
  'lunar-eclipse', 'southern-stars', 'flight-routes', 'time-zones',
];

test('every phenomenon module has a budget entry', () => {
  for (const id of MODULE_IDS) {
    assert.ok(SIGNAL_BUDGET[id], `no signal budget declared for "${id}"`);
  }
  assert.equal(Object.keys(SIGNAL_BUDGET).length, MODULE_IDS.length,
    'budget has entries for modules that do not exist');
});

test('every entry is fully specified', () => {
  for (const [id, e] of Object.entries(SIGNAL_BUDGET)) {
    assert.equal(typeof e.signal, 'string', `${id}.signal`);
    assert.ok(e.signal.length > 0, `${id}.signal is empty`);
    assert.equal(typeof e.unit, 'string', `${id}.unit`);
    assert.ok(Number.isFinite(e.magnitude), `${id}.magnitude not finite`);
    assert.ok(e.magnitude > 0, `${id}.magnitude must be positive`);
    assert.ok(Number.isFinite(e.maxDetail), `${id}.maxDetail not finite`);
    assert.ok(e.maxDetail >= 0, `${id}.maxDetail must not be negative`);
  }
});

test('no added detail comes within 10x of the signal it sits beside', () => {
  for (const [id, e] of Object.entries(SIGNAL_BUDGET)) {
    if (e.maxDetail === 0) continue;      // zero is always safe
    assert.ok(e.maxDetail * 10 <= e.magnitude,
      `${id}: detail ${e.maxDetail}${e.unit} is not 10x clear of ` +
      `signal ${e.magnitude}${e.unit} ("${e.signal}")`);
  }
});

test('ocean displacement is exactly zero', () => {
  // Not "small". Zero. A normal map perturbs shading only and adds no
  // geometry, so hiddenHeightM() stays exactly 3.79 m at 12 km. Any non-zero
  // value here puts wave crests taller than the entire effect the horizon
  // module exists to demonstrate.
  assert.equal(OCEAN_DISPLACEMENT_M, 0);
  assert.equal(SIGNAL_BUDGET.horizon.maxDetail, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "docs/flat-earth/test/signal-budget.test.js"`
Expected: FAIL — `Cannot find module .../js/lib/signal-budget.js`

- [ ] **Step 3: Write the implementation**

Create `docs/flat-earth/js/lib/signal-budget.js`:

```js
/**
 * What each phenomenon measures, and the ceiling on any visual detail placed
 * near it.
 *
 * Seven of the eight modules shipped a defect during the original build where
 * the readout was numerically correct and the picture showed something else,
 * and all seven passed the automated suite. Realism is a new and generous
 * source of exactly that failure: a wave taller than the hidden hull, a glow
 * wider than the solar disc, a cloud over the terminator.
 *
 * `magnitude` is the size of the effect the module demonstrates. `maxDetail`
 * is the largest visual perturbation the renderer is permitted to add near it,
 * in the SAME unit. test/signal-budget.test.js enforces a 10x separation.
 *
 * This locks the declared numbers. It cannot verify the renderer honours them
 * — nothing headless can, which is why README.md's manual visual checklist
 * still runs. What it converts is "someone remembers the ocean must stay flat"
 * into "the build fails if someone writes a displacement value".
 *
 * Zero imports, so it loads under `node --test`.
 */

export const SIGNAL_BUDGET = {
  horizon: {
    signal: 'hull height hidden by curvature at 12 km, 2 m eye height',
    magnitude: 3.79, maxDetail: 0, unit: ' m',
  },
  eratosthenes: {
    signal: 'gnomon shadow length at world scale',
    magnitude: 300, maxDetail: 6, unit: ' km',
  },
  'midnight-sun': {
    signal: 'daylight hours disagreement between models',
    magnitude: 17, maxDetail: 1, unit: ' h',
  },
  'sun-size': {
    signal: 'apparent solar diameter change from noon to 18:00',
    magnitude: 0.356, maxDetail: 0, unit: '°',
  },
  'lunar-eclipse': {
    signal: 'curvature radius of the cast shadow edge',
    magnitude: 555, maxDetail: 55, unit: ' km',
  },
  'southern-stars': {
    signal: 'apparent rotation rate about the celestial pole',
    magnitude: 15, maxDetail: 0, unit: '°/h',
  },
  'flight-routes': {
    signal: 'route length difference between models',
    magnitude: 14337, maxDetail: 200, unit: ' km',
  },
  'time-zones': {
    signal: 'terminator position error in the flat model',
    magnitude: 6, maxDetail: 0, unit: ' h',
  },
};

/**
 * Ocean vertical displacement, in metres. MUST be zero.
 *
 * Imported by primitives.js so this is a live code path, not a comment: the
 * ocean geometry is built flat and the sea's appearance comes entirely from a
 * normal map, which perturbs shading and adds no geometry. hiddenHeightM()
 * therefore stays exactly 3.79 m at 12 km.
 */
export const OCEAN_DISPLACEMENT_M = 0;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "docs/flat-earth/test/signal-budget.test.js"`
Expected: PASS, 4 tests

- [ ] **Step 5: Run the full suite**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 54 tests

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/js/lib/signal-budget.js docs/flat-earth/test/signal-budget.test.js
git commit -m "Add signal budget: realism may not exceed the measurement"
```

---

### Task 3: Coastline data pipeline

**Files:**
- Create: `docs/flat-earth/tools/build-coastlines.mjs`
- Create: `docs/flat-earth/data/coastlines.json` (generated by running the tool)
- Test: `docs/flat-earth/test/coastlines.test.js`
- Modify: `docs/_config.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `data/coastlines.json` with shape `{ source: string, licence: string, rings: Array<Array<[lon, lat]>> }`. Task 5 fetches this. Coordinates are `[longitude, latitude]` in degrees, **lon first** — matching the shapefile's own order, and the opposite of the `{lat, lon}` objects used elsewhere in the app.

- [ ] **Step 1: Write the tool**

Create `docs/flat-earth/tools/build-coastlines.mjs`:

```js
/**
 * Natural Earth 110m land shapefile -> data/coastlines.json
 *
 * Dev-only, run once, output committed. No shapefile parsing ships to the
 * browser and this file is excluded from the Jekyll build.
 *
 * Usage:
 *   curl -o ne.zip https://naciscdn.org/naturalearth/110m/physical/ne_110m_land.zip
 *   python -m zipfile -e ne.zip ne/
 *   node tools/build-coastlines.mjs ne/ne_110m_land.shp data/coastlines.json
 *
 * Natural Earth is public domain: "No permission is needed to use Natural
 * Earth", commercial use included. Crediting is appreciated, not required, and
 * we credit it in README.md anyway.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SHAPE_TYPE_POLYGON = 5;
const DECIMALS = 2;   // ~1.1 km at the equator; the 110m source is coarser

const [, , shpPath, outPath] = process.argv;
if (!shpPath || !outPath) {
  console.error('usage: node build-coastlines.mjs <input.shp> <output.json>');
  process.exit(1);
}

const buf = readFileSync(shpPath);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const round = v => Number(v.toFixed(DECIMALS));

const rings = [];
let off = 100;                                   // fixed 100-byte file header
while (off < buf.length) {
  // Record header is big-endian; record content is little-endian.
  const contentWords = dv.getInt32(off + 4, false);
  const p = off + 8;
  if (dv.getInt32(p, true) === SHAPE_TYPE_POLYGON) {
    // p+0 shapeType, p+4..p+35 bounding box, p+36 numParts, p+40 numPoints
    const numParts = dv.getInt32(p + 36, true);
    const numPoints = dv.getInt32(p + 40, true);
    const partsOff = p + 44;
    const ptsOff = partsOff + numParts * 4;

    const starts = [];
    for (let i = 0; i < numParts; i += 1) {
      starts.push(dv.getInt32(partsOff + i * 4, true));
    }
    starts.push(numPoints);

    for (let i = 0; i < numParts; i += 1) {
      const ring = [];
      for (let j = starts[i]; j < starts[i + 1]; j += 1) {
        ring.push([
          round(dv.getFloat64(ptsOff + j * 16, true)),       // longitude
          round(dv.getFloat64(ptsOff + j * 16 + 8, true)),   // latitude
        ]);
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  off += 8 + contentWords * 2;
}

const out = {
  source: 'Natural Earth 4.1.0, ne_110m_land',
  licence: 'Public domain. No permission is needed to use Natural Earth.',
  rings,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));

const points = rings.reduce((n, r) => n + r.length, 0);
console.log(`${rings.length} rings, ${points} points, ` +
  `${(JSON.stringify(out).length / 1024).toFixed(0)} KB -> ${outPath}`);
```

- [ ] **Step 2: Run the tool to generate the data**

```bash
cd docs/flat-earth
curl -o /tmp/ne.zip https://naciscdn.org/naturalearth/110m/physical/ne_110m_land.zip
python -m zipfile -e /tmp/ne.zip /tmp/ne/
node tools/build-coastlines.mjs /tmp/ne/ne_110m_land.shp data/coastlines.json
```

Expected output: `128 rings, 5143 points, ~70 KB -> data/coastlines.json`

If the ring or point count differs materially from 128 / 5143, the parser is wrong — stop and fix it rather than committing the data.

- [ ] **Step 3: Write the failing test**

Create `docs/flat-earth/test/coastlines.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(
  readFileSync(new URL('../data/coastlines.json', import.meta.url), 'utf8'));

test('carries its source and licence', () => {
  assert.match(data.source, /Natural Earth/);
  assert.match(data.licence, /[Pp]ublic domain/);
});

test('ring and point counts match the 110m source', () => {
  assert.ok(data.rings.length >= 120 && data.rings.length <= 140,
    `expected ~128 rings, got ${data.rings.length}`);
  const points = data.rings.reduce((n, r) => n + r.length, 0);
  assert.ok(points >= 4800 && points <= 5500,
    `expected ~5143 points, got ${points}`);
});

test('every coordinate is a plausible [lon, lat] pair', () => {
  for (const [i, ring] of data.rings.entries()) {
    assert.ok(ring.length >= 4, `ring ${i} has only ${ring.length} points`);
    for (const p of ring) {
      assert.equal(p.length, 2, `ring ${i}: point is not a pair`);
      const [lon, lat] = p;
      assert.ok(lon >= -180 && lon <= 180, `ring ${i}: longitude ${lon}`);
      assert.ok(lat >= -90 && lat <= 90, `ring ${i}: latitude ${lat}`);
    }
  }
});

test('every ring is closed', () => {
  // An unclosed ring fills as an open path and bleeds colour across the map.
  for (const [i, ring] of data.rings.entries()) {
    const a = ring[0], b = ring[ring.length - 1];
    assert.deepEqual(a, b, `ring ${i} is not closed: ${a} vs ${b}`);
  }
});

test('the data covers both hemispheres and reaches Antarctica', () => {
  // Guards against a truncated parse that silently keeps only the first
  // records — which would look fine until McMurdo sat in open ocean.
  let minLat = 90, maxLat = -90;
  for (const ring of data.rings) {
    for (const [, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  assert.ok(minLat < -60, `southernmost land is only ${minLat}`);
  assert.ok(maxLat > 70, `northernmost land is only ${maxLat}`);
});
```

- [ ] **Step 4: Run the test**

Run: `node --test "docs/flat-earth/test/coastlines.test.js"`
Expected: PASS, 5 tests. If ring closure fails, the parser dropped the final point of each part — fix `starts` handling rather than loosening the test.

- [ ] **Step 5: Exclude the tool from the Jekyll build**

In `docs/_config.yml`, add to `exclude:` immediately after the `flat-earth/serve.py` entry:

```yaml
  # Coastline build tool; its output (data/coastlines.json) does publish.
  - flat-earth/tools
```

- [ ] **Step 6: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 59 tests

```bash
git add docs/flat-earth/tools/build-coastlines.mjs docs/flat-earth/data/coastlines.json \
        docs/flat-earth/test/coastlines.test.js docs/_config.yml
git commit -m "Add public-domain coastline data and its build tool"
```

---

### Task 4: Map projections

**Files:**
- Create: `docs/flat-earth/js/lib/map-projection.js`
- Test: `docs/flat-earth/test/map-projection.test.js`

**Interfaces:**
- Consumes: `azimuthalEquidistantXY` from `js/physics/geodesy.js`; `FLAT_DISC_RADIUS_KM`, `RAD` from `js/physics/constants.js`.
- Produces:
  - `equirectUV(lat, lon) -> { u, v }` — both in `[0,1]`, `v = 0` at the north pole.
  - `discUV(lat, lon) -> { u, v }` — both in `[0,1]`, `(0.5, 0.5)` at the north pole, radius 0.5 at the south pole.
  - `discToLatLon(u, v) -> { lat, lon }` — inverse of `discUV`.
  - `densifyRing(ring, maxStepDeg) -> Array<[lon, lat]>` — inserts intermediate vertices so no edge spans more than `maxStepDeg` degrees.

- [ ] **Step 1: Write the failing test**

Create `docs/flat-earth/test/map-projection.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  equirectUV, discUV, discToLatLon, densifyRing,
} from '../js/lib/map-projection.js';

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ±${tol}, got ${actual}`);

test('equirectUV maps the corners of the world', () => {
  const nw = equirectUV(90, -180);
  near(nw.u, 0, 1e-9, 'north-west u');
  near(nw.v, 0, 1e-9, 'north-west v');
  const se = equirectUV(-90, 180);
  near(se.u, 1, 1e-9, 'south-east u');
  near(se.v, 1, 1e-9, 'south-east v');
  const origin = equirectUV(0, 0);
  near(origin.u, 0.5, 1e-9, 'null island u');
  near(origin.v, 0.5, 1e-9, 'null island v');
});

test('discUV puts the north pole at the centre', () => {
  const p = discUV(90, 0);
  near(p.u, 0.5, 1e-9, 'north pole u');
  near(p.v, 0.5, 1e-9, 'north pole v');
});

test('discUV puts the south pole on the rim at every longitude', () => {
  // Antarctica becomes the outer edge. If this collapses to a point, the
  // projection is inverted and the flat map is upside down.
  for (const lon of [0, 90, -90, 180]) {
    const p = discUV(-90, lon);
    const r = Math.hypot(p.u - 0.5, p.v - 0.5);
    near(r, 0.5, 1e-9, `south pole radius at lon ${lon}`);
  }
});

test('discUV radius grows monotonically as latitude falls', () => {
  let last = -1;
  for (let lat = 90; lat >= -90; lat -= 10) {
    const p = discUV(lat, 0);
    const r = Math.hypot(p.u - 0.5, p.v - 0.5);
    assert.ok(r > last, `radius not increasing at lat ${lat}: ${r} <= ${last}`);
    last = r;
  }
});

test('discToLatLon round-trips discUV', () => {
  // The map painted on the disc and the distances flight-routes reports come
  // from the same projection. If this round-trip drifts, the picture and the
  // readout are using different maps.
  for (const lat of [80, 45, 0, -45, -80]) {
    for (const lon of [0, 60, -120, 179]) {
      const { u, v } = discUV(lat, lon);
      const back = discToLatLon(u, v);
      near(back.lat, lat, 1e-6, `lat round-trip at ${lat},${lon}`);
      const dLon = ((back.lon - lon + 540) % 360) - 180;
      near(dLon, 0, 1e-6, `lon round-trip at ${lat},${lon}`);
    }
  }
});

test('densifyRing bounds the step of every edge', () => {
  const ring = [[0, 0], [90, 0], [90, 60], [0, 0]];
  const dense = densifyRing(ring, 5);
  assert.ok(dense.length > ring.length, 'ring was not densified');
  for (let i = 1; i < dense.length; i += 1) {
    const step = Math.hypot(
      dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    assert.ok(step <= 5 + 1e-9, `edge ${i} spans ${step}°`);
  }
});

test('densifyRing leaves an already-fine ring alone', () => {
  const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
  assert.deepEqual(densifyRing(ring, 5), ring);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "docs/flat-earth/test/map-projection.test.js"`
Expected: FAIL — `Cannot find module .../js/lib/map-projection.js`

- [ ] **Step 3: Write the implementation**

Create `docs/flat-earth/js/lib/map-projection.js`:

```js
/**
 * Texture-space projections for the globe and the disc.
 *
 * The disc projection delegates to azimuthalEquidistantXY — the SAME function
 * flight-routes uses to compute its 25,684 km readout. The map drawn on the
 * disc and the number printed above it therefore come from one function and
 * cannot disagree. That is the whole reason this file imports geodesy rather
 * than reimplementing the projection.
 *
 * Imports only js/physics/, so it runs under `node --test`.
 */
import { FLAT_DISC_RADIUS_KM, RAD } from '../physics/constants.js';
import { azimuthalEquidistantXY } from '../physics/geodesy.js';

/** Equirectangular UV, as SphereGeometry's default UVs expect. v = 0 is north. */
export function equirectUV(lat, lon) {
  return { u: (lon + 180) / 360, v: (90 - lat) / 180 };
}

/**
 * Azimuthal-equidistant UV on the unit square: the north pole at (0.5, 0.5),
 * the south pole on a circle of radius 0.5. This is the classic flat-earth
 * map, with Antarctica smeared into a ring around the rim.
 *
 * v is flipped relative to the projection's +y because texture space runs
 * downward while the map's north-up y runs upward.
 */
export function discUV(lat, lon) {
  const { x, y } = azimuthalEquidistantXY({ lat, lon });
  const s = 2 * FLAT_DISC_RADIUS_KM;
  return { u: 0.5 + x / s, v: 0.5 - y / s };
}

/** Inverse of discUV. */
export function discToLatLon(u, v) {
  const s = 2 * FLAT_DISC_RADIUS_KM;
  const x = (u - 0.5) * s, y = (0.5 - v) * s;
  const r = Math.hypot(x, y);
  // azimuthalEquidistantRadiusKm(lat) = R * (PI/2 - lat*DEG), inverted here.
  const lat = (Math.PI / 2 - r / (FLAT_DISC_RADIUS_KM / Math.PI)) * RAD;
  return { lat, lon: Math.atan2(x, y) * RAD };
}

/**
 * Insert intermediate vertices so no edge spans more than maxStepDeg.
 *
 * Required before projecting a ring through discUV: the AE projection is
 * non-linear, so a long straight edge in lat/lon is a curve on the disc. Fill
 * the projected polygon without densifying and the rasteriser cuts the corner,
 * which shows up as continents with chunks sliced off near the rim — exactly
 * where Antarctica lives.
 */
export function densifyRing(ring, maxStepDeg) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxStepDeg));
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "docs/flat-earth/test/map-projection.test.js"`
Expected: PASS, 7 tests

- [ ] **Step 5: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests

```bash
git add docs/flat-earth/js/lib/map-projection.js docs/flat-earth/test/map-projection.test.js
git commit -m "Add map projections sharing flight-routes' AE function"
```

---

### Task 5: Texture generation and the boot-time cache

**Files:**
- Create: `docs/flat-earth/js/lib/textures.js`
- Modify: `docs/flat-earth/js/main.js`

**Interfaces:**
- Consumes: `noise.js` (Task 1), `map-projection.js` (Task 4), `data/coastlines.json` (Task 3).
- Produces:
  - `await loadCoastlines() -> void` — fetches and caches the rings; throws on HTTP failure.
  - `await generateTextures() -> void` — populates `TEXTURES`; never throws.
  - `TEXTURES` — `{ ready: boolean, earth: Texture|null, earthNormal: Texture|null, disc: Texture|null, discNormal: Texture|null, oceanNormal: Texture|null, sun: Texture|null, moon: Texture|null }`. Every field is `null` until `generateTextures()` succeeds; consumers in Task 6 must handle `null` by falling back to plain colour.

**No visible change lands in this task.** Textures are generated and cached but nothing consumes them yet. That is deliberate: it isolates "does generation work and stay inside the time budget" from "does the app look different", so a reviewer can reject one without the other.

- [ ] **Step 1: Write the texture module**

Create `docs/flat-earth/js/lib/textures.js`:

```js
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
    TEXTURES.ready = false;
  }
  const ms = Math.round(performance.now() - started);
  console.info(`[flat-earth] textures generated in ${ms} ms`);
  if (ms > 400) {
    console.warn(`[flat-earth] texture budget exceeded: ${ms} ms > 400 ms. ` +
      'Reduce fbm octaves before reducing resolution.');
  }
}
```

- [ ] **Step 2: Wire generation into boot**

In `docs/flat-earth/js/main.js`, add to the import block at the top:

```js
import { loadCoastlines, generateTextures } from './lib/textures.js';
```

Then in `boot()`, immediately after the `try/catch` that creates the viewport and before `renderSelector(...)`, insert:

```js
  // Textures are an enhancement, never a dependency. A missing or malformed
  // coastlines.json must not take the app down: seven of the eight modules
  // need no geography at all, and the eighth degrades to an untextured globe
  // with every readout intact. Nothing here may add a new way to go blank.
  try {
    await loadCoastlines();
  } catch (err) {
    console.warn('Coastline data unavailable; surfaces render without land.', err);
  }
  await generateTextures();
```

- [ ] **Step 3: Verify generation runs and stays in budget**

```bash
cd docs/flat-earth && python serve.py 8130
```

Open `http://localhost:8130/`, open DevTools console.

Expected:
- `[flat-earth] textures generated in NNN ms` with NNN ≤ 400
- No `Texture generation failed` warning
- No `Coastline data unavailable` warning
- The app looks **exactly as before** — nothing consumes the textures yet
- All eight phenomena still switch without error

If the budget is exceeded, reduce the octave counts in `paintSurface` (5 → 4, 4 → 3) before reducing `EQUIRECT_W`/`DISC_SIZE`.

- [ ] **Step 4: Verify the failure path degrades**

Temporarily rename the data file and reload:

```bash
mv docs/flat-earth/data/coastlines.json docs/flat-earth/data/coastlines.json.bak
```

Expected: the console shows `Coastline data unavailable`, the page still boots fully, all eight phenomena still work, and **no error card appears**. Then restore:

```bash
mv docs/flat-earth/data/coastlines.json.bak docs/flat-earth/data/coastlines.json
```

- [ ] **Step 5: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests (unchanged — this task adds no headless-testable code)

```bash
git add docs/flat-earth/js/lib/textures.js docs/flat-earth/js/main.js
git commit -m "Generate procedural textures at boot, with flat-colour fallback"
```

---

### Task 6: Materials and primitives consume the textures

**Files:**
- Modify: `docs/flat-earth/js/lib/materials.js`
- Modify: `docs/flat-earth/js/lib/primitives.js`

**Interfaces:**
- Consumes: `TEXTURES` (Task 5), `OCEAN_DISPLACEMENT_M` (Task 2).
- Produces: `makeOcean(sizeKm)`, `makeGlobeOcean(radiusKm)`, `makeGlobeCap(radiusKm, extentKm, radialSegments, angularSegments)`, `makeShip(scaleKm)`, `makeObserverMarker(scaleKm = 200)`, `makeGnomon(heightKm)`, `makeDisc(radiusKm)`, `makeSun(diameterKm)`, `disposeTree(root)`.
  - **Unchanged signatures:** `makeOcean`, `makeGlobeOcean`, `makeGlobeCap`, `makeShip`, `makeDisc`, `makeSun`, `disposeTree`.
  - **Changed signature:** `makeGnomon(heightKm)` **drops its second parameter** — the shadow plane it sized is gone, so `shadowLengthKm` has nothing to size. Task 8 updates its only caller. `makeObserverMarker(scaleKm = 200)` gains an optional parameter; existing zero-argument calls keep working.
  - **Changed behaviour:** `makeSun` now returns a `THREE.Group` (was a `Mesh`) carrying `userData.light` — a `THREE.DirectionalLight` parented to the group. Callers that treated the result as a plain `Object3D` (setting `.position`, `.scale`) are unaffected.
  - **Removed behaviour:** `makeGnomon` no longer sets `userData.setShadow`. Task 8 removes its only caller.
  - **New:** `applyMaterials()` — called once by Task 5's boot path after `generateTextures()`, it upgrades the shared `MATERIALS` singletons in place with whatever textures exist.

- [ ] **Step 1: Upgrade the materials**

Replace `docs/flat-earth/js/lib/materials.js` with:

```js
import * as THREE from 'three';
import { TEXTURES } from './textures.js';

/**
 * Shared material singletons, upgraded in place once textures exist.
 *
 * Still singletons, still never disposed per-module — disposeTree only frees
 * materials a mesh explicitly owns via `userData.ownsMaterial`. Mutating them
 * in applyMaterials() rather than replacing them means every mesh already
 * built keeps working, and no phenomenon needs to know textures arrived.
 */
export const MATERIALS = {
  ocean:     new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.7 }),
  land:      new THREE.MeshStandardMaterial({ color: 0x2f4f3a, roughness: 0.9 }),
  hull:      new THREE.MeshStandardMaterial({ color: 0x8a3324, roughness: 0.55, metalness: 0.05 }),
  deck:      new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.85 }),
  sail:      new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.8 }),
  sunGlow:   new THREE.MeshBasicMaterial({ color: 0xffd27f }),
  moon:      new THREE.MeshStandardMaterial({ color: 0xb9b9b4, roughness: 1.0 }),
  domeGlass: new THREE.MeshBasicMaterial({
    color: 0x4a6fa5, transparent: true, opacity: 0.12, side: THREE.BackSide,
  }),
  shadow:    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.85, transparent: true }),
  starPoint: new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.6, sizeAttenuation: false }),
};

/** Per-surface material used where a textured globe/disc map is wanted. */
export const SURFACE = {
  globe: new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.85 }),
  disc:  new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.85 }),
};

/**
 * Attach whatever textures were generated. Safe to call when generation
 * failed: every field is null then, nothing is assigned, and the materials
 * keep the flat colours they were constructed with.
 */
export function applyMaterials() {
  if (!TEXTURES.ready) return;

  SURFACE.globe.map = TEXTURES.earth;
  SURFACE.globe.normalMap = TEXTURES.earthNormal;
  SURFACE.globe.normalScale = new THREE.Vector2(0.6, 0.6);
  SURFACE.globe.needsUpdate = true;

  SURFACE.disc.map = TEXTURES.disc;
  SURFACE.disc.normalMap = TEXTURES.discNormal;
  SURFACE.disc.normalScale = new THREE.Vector2(0.6, 0.6);
  SURFACE.disc.needsUpdate = true;

  // Shading detail only. The ocean geometry stays perfectly flat; see
  // OCEAN_DISPLACEMENT_M in signal-budget.js.
  MATERIALS.ocean.normalMap = TEXTURES.oceanNormal;
  MATERIALS.ocean.normalScale = new THREE.Vector2(0.35, 0.35);
  MATERIALS.ocean.roughness = 0.45;
  MATERIALS.ocean.needsUpdate = true;

  MATERIALS.moon.map = TEXTURES.moon;
  MATERIALS.moon.needsUpdate = true;

  MATERIALS.sunGlow.map = TEXTURES.sun;
  MATERIALS.sunGlow.transparent = true;
  MATERIALS.sunGlow.needsUpdate = true;
}

export function disposeMaterials() {
  for (const m of Object.values(MATERIALS)) m.dispose();
  for (const m of Object.values(SURFACE)) m.dispose();
}
```

- [ ] **Step 2: Call applyMaterials() at boot**

In `docs/flat-earth/js/main.js`, change the import added in Task 5 and the call site:

```js
import { loadCoastlines, generateTextures } from './lib/textures.js';
import { applyMaterials } from './lib/materials.js';
```

and immediately after `await generateTextures();` add:

```js
  applyMaterials();
```

- [ ] **Step 3: Upgrade the primitives**

In `docs/flat-earth/js/lib/primitives.js`:

Replace the import block at the top with:

```js
import * as THREE from 'three';
import { MATERIALS, SURFACE } from './materials.js';
import { OCEAN_DISPLACEMENT_M } from './signal-budget.js';
```

Replace `makeOcean` with:

```js
/**
 * Flat ocean plane, sizeKm across, lying in the XZ plane at y = 0.
 *
 * Segmented for normal-map sampling ONLY. The plane is built at exactly
 * y = 0 with no vertical displacement: OCEAN_DISPLACEMENT_M is asserted zero
 * in test/signal-budget.test.js because wave crests of even a metre or two
 * would be comparable to the 3.79 m of hidden hull the horizon module exists
 * to measure, and would swallow the entire effect.
 */
export function makeOcean(sizeKm) {
  const geo = new THREE.PlaneGeometry(sizeKm, sizeKm, 64, 64);
  if (OCEAN_DISPLACEMENT_M !== 0) {
    throw new Error('Ocean displacement must be zero; see signal-budget.js');
  }
  const mesh = new THREE.Mesh(geo, MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}
```

Change `makeGlobeOcean` and `makeDisc` to use the textured surface materials:

```js
/** Whole sphere of radius radiusKm centred at the origin. For whole-globe views. */
export function makeGlobeOcean(radiusKm) {
  const geo = new THREE.SphereGeometry(radiusKm, 96, 64);
  const mesh = new THREE.Mesh(geo, SURFACE.globe);
  mesh.receiveShadow = true;
  return mesh;
}
```

```js
/** Flat disc of the whole world, radius radiusKm, in the XZ plane. */
export function makeDisc(radiusKm) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radiusKm, 256), SURFACE.disc);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}
```

Leave `makeGlobeCap` using `MATERIALS.ocean` — it is a close-range sea surface, not a world map — but add `mesh.receiveShadow = true;` before returning.

Replace `makeShip` with a properly built hull:

```js
/**
 * Ship: tapered hull, deck, mast, boom and two sails, total height ~scaleKm.
 * Origin sits at the waterline so it can be placed directly on a surface.
 *
 * Detail here is free: horizon measures how much of the hull is OCCLUDED, and
 * occlusion depends on the hull's silhouette against the limb, not on how the
 * hull is shaded. A more convincing ship makes the disappearing-hull effect
 * easier to read, not harder.
 */
export function makeShip(scaleKm) {
  const group = new THREE.Group();
  const hullH = scaleKm * 0.35;

  // CylinderGeometry with 4 radial segments and a smaller top radius gives a
  // tapered, boat-like hull for one geometry instead of a box.
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.30, scaleKm * 0.16, hullH, 4, 1),
    MATERIALS.hull);
  hull.rotation.y = Math.PI / 4;
  hull.scale.set(1.5, 1, 0.55);
  hull.position.y = hullH / 2;
  hull.castShadow = true;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(scaleKm * 0.78, scaleKm * 0.03, scaleKm * 0.24),
    MATERIALS.deck);
  deck.position.y = hullH;
  deck.castShadow = true;

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.015, scaleKm * 0.022, scaleKm * 0.75, 8),
    MATERIALS.deck);
  mast.position.y = hullH + scaleKm * 0.375;
  mast.castShadow = true;

  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.01, scaleKm * 0.01, scaleKm * 0.34, 6),
    MATERIALS.deck);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(scaleKm * 0.10, hullH + scaleKm * 0.10, 0);

  // The sails need DoubleSide. They get their OWN material: writing
  // `sail.material.side` would mutate the shared MATERIALS.sail singleton and
  // silently make every later phenomenon's use of it double-sided too, with
  // nothing ever reverting it.
  const sailMat = MATERIALS.sail.clone();
  sailMat.side = THREE.DoubleSide;

  const main = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.34, scaleKm * 0.46), sailMat);
  main.position.set(scaleKm * 0.10, hullH + scaleKm * 0.36, 0);
  main.castShadow = true;
  main.userData.ownsMaterial = true;

  const jib = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.22, scaleKm * 0.32), sailMat);
  jib.position.set(scaleKm * -0.16, hullH + scaleKm * 0.30, 0);
  jib.castShadow = true;

  group.add(hull, deck, mast, boom, main, jib);
  return group;
}
```

Replace `makeObserverMarker` — the visual checklist found it a near-invisible speck:

```js
/**
 * Observer marker: a post with a bright cap, sized against the scene it sits
 * in rather than a fixed 0.5 km.
 *
 * The last visual checklist recorded this as "present at the southern limb but
 * a near-invisible speck" — correct, and unreadable. midnight-sun's claim is
 * about where this marker points, so it has to be visible to be evidence.
 */
export function makeObserverMarker(scaleKm = 200) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.06, scaleKm * 0.06, scaleKm, 8),
    MATERIALS.sail);
  post.position.y = scaleKm / 2;
  post.castShadow = true;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(scaleKm * 0.16, 12, 8), MATERIALS.sunGlow);
  cap.position.y = scaleKm;
  g.add(post, cap);
  return g;
}
```

Replace `makeGnomon` — the asserted shadow plane goes away:

```js
/**
 * Vertical stick that CASTS a real shadow.
 *
 * The old version drew its own shadow: a black plane whose length physics
 * computed and wrote via `userData.setShadow`. That made the picture an
 * illustration of the number rather than evidence for it. The shadow is now
 * cast by the light, so a disagreement between the rendered shadow and the
 * reported sun angle would be visible instead of impossible.
 *
 * The old second parameter (shadowLengthKm) is gone with the plane it sized.
 */
export function makeGnomon(heightKm) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(heightKm * 0.04, heightKm * 0.05, heightKm, 12),
    MATERIALS.sail);
  stick.position.y = heightKm / 2;
  stick.castShadow = true;
  stick.receiveShadow = true;
  g.add(stick);
  return g;
}
```

Replace `makeSun` — it now carries its own light:

```js
/**
 * Emissive sun sphere of the given diameter, WITH its light attached.
 *
 * Before this, both scenes lit from a DirectionalLight hard-coded at (1,1,1)
 * while the sun mesh was moved independently by physics. The glowing sphere
 * and the illumination already disagreed; nothing cast shadows, so it never
 * showed. Parenting the light to the sun means every existing physics call
 * that moves the sun moves the light too, permanently in sync.
 *
 * The caller must set `sun.userData.light.target` to an object at the world
 * origin — normally its own root — or Three.js aims the light at a default
 * target that is never added to the scene.
 */
export function makeSun(diameterKm) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(diameterKm / 2, 48, 32), MATERIALS.sunGlow);
  const light = new THREE.DirectionalLight(0xfff4e0, 2.2);
  g.add(mesh, light);
  g.userData.light = light;
  g.userData.mesh = mesh;
  return g;
}
```

- [ ] **Step 4: Verify the app renders with textures**

```bash
cd docs/flat-earth && python serve.py 8130
```

Check every phenomenon. Expected:
- The globe is recognisably Earth, with continents in the right places
- The disc shows the flat-earth map: north pole centred, Antarctica around the rim
- The ocean has visible surface texture and **no waves**
- The ship reads as a ship
- No console errors, and no error card on any module

- [ ] **Step 5: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests

```bash
git add docs/flat-earth/js/lib/materials.js docs/flat-earth/js/lib/primitives.js \
        docs/flat-earth/js/main.js
git commit -m "Render textured surfaces, a real ship, and a sun that carries its light"
```

---

### Task 7: Renderer upgrade

**Files:**
- Modify: `docs/flat-earth/js/viewport.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: the returned object is unchanged — `{ renderer, flatScene, globeScene, render, resize, paneIndexAt, setCameras, dispose }`. `main.js` needs no change.

- [ ] **Step 1: Update the renderer and lighting**

In `docs/flat-earth/js/viewport.js`, replace the renderer construction and the light loop (lines 9–21) with:

```js
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setScissorTest(true);
  renderer.setClearColor(0x0b0e13, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES compresses highlights globally, and horizon reads hull occlusion
  // against a bright limb. If that contrast measurably suffers, this comes
  // back off: the measurement outranks the look.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const flatScene = new THREE.Scene();
  const globeScene = new THREE.Scene();
  // Ambient plus a weak hemisphere fill only.
  //
  // The old fixed DirectionalLight at (1,1,1) is deliberately gone: it lit
  // every scene from a corner that had nothing to do with where the sun was,
  // which was invisible while nothing cast shadows and becomes a contradiction
  // the moment something does. Modules that have a sun now bring their own
  // light with it (see makeSun); modules that do not are lit by this fill,
  // which is intentionally too weak to cast anything.
  for (const scene of [flatScene, globeScene]) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    scene.add(new THREE.HemisphereLight(0x93b4d8, 0x0b0e13, 0.45));
  }
```

- [ ] **Step 2: Verify no module went dark**

```bash
cd docs/flat-earth && python serve.py 8130
```

Step through all eight. Expected: every module is still legible. `midnight-sun` and `sun-size` are lit by their own sun. The five with no sun (horizon, lunar eclipse, southern stars, flight routes, time zones) are lit by ambient plus hemisphere fill and must not be black.

If any module is too dark, raise the `HemisphereLight` intensity — do **not** re-add a directional key light, which would reintroduce the contradiction this step removes.

- [ ] **Step 3: Check the horizon contrast specifically**

Select **Horizon**, set distance to 12 km. Confirm the hull is still clearly occluded against the limb and the waterline is still readable.

If ACES has visibly flattened that contrast, set `renderer.toneMapping = THREE.NoToneMapping;` and note it in the commit message. The spec authorises this fallback.

- [ ] **Step 4: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests

```bash
git add docs/flat-earth/js/viewport.js
git commit -m "Upgrade renderer; remove the key light that ignored the sun"
```

---

### Task 8: Eratosthenes casts real shadows

**Files:**
- Create: `docs/flat-earth/js/lib/world.js`
- Modify: `docs/flat-earth/js/phenomena/eratosthenes.js`

**Interfaces:**
- Consumes: `FLAT_SUN_ALTITUDE_KM`, `R_EARTH_KM`, `DEG` from `js/physics/constants.js`.
- Produces:
  - `makeParallelSun(spanKm) -> THREE.DirectionalLight` — parallel rays, shadow camera fitted to a `spanKm`-wide region. Has `.target` already added as a child of the light's parent by the caller.
  - `makeLocalSun(altitudeKm, spanKm) -> THREE.SpotLight` — diverging rays from a point `altitudeKm` above the surface.

**This is the task the whole design turns on.** The two panes get physically different light types because that difference *is* Eratosthenes' argument: a nearby sun produces different shadow angles at different latitudes, a distant one does not. Rendering each model correctly makes the differing shadow lengths a product of the geometry rather than a value written by hand.

- [ ] **Step 1: Write the lighting helpers**

Create `docs/flat-earth/js/lib/world.js`:

```js
import * as THREE from 'three';

/**
 * Lighting rigs whose TYPE encodes the model being tested.
 *
 * Eratosthenes' argument is entirely about ray divergence: the flat model
 * needs a nearby sun so that rays strike observers at different latitudes at
 * different angles, and the globe model has a sun 1 AU away whose rays are
 * parallel. Using a DirectionalLight for both panes would silently give the
 * flat model the globe's geometry and destroy the comparison. The light type
 * is therefore load-bearing, not a rendering detail.
 */

/**
 * Parallel-ray sun for the globe pane.
 *
 * spanKm sizes the orthographic shadow frustum. At the default 3,000 km span
 * with a 2048 map that is 1.5 km per texel against a 300 km gnomon shadow — a
 * 200x margin, comfortably clear of the acne/peter-panning regime.
 */
export function makeParallelSun(spanKm) {
  const light = new THREE.DirectionalLight(0xfff4e0, 2.4);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const h = spanKm / 2;
  const cam = light.shadow.camera;
  cam.left = -h; cam.right = h; cam.top = h; cam.bottom = -h;
  cam.near = 1; cam.far = spanKm * 8;
  cam.updateProjectionMatrix();
  // normalBias, not constant bias: it scales with surface orientation, which
  // is what a 300 km stick standing on a 6,371 km sphere needs.
  light.shadow.normalBias = spanKm * 1e-3;
  return light;
}

/**
 * Diverging-ray sun for the flat pane, at the flat model's own stated sun
 * altitude. Gnomon sites sit at AE radii of roughly 5,000-7,200 km, so the
 * frustum spans ~10,000 km: 4.9 km per texel at 2048, a 60x margin against a
 * 300 km shadow.
 */
export function makeLocalSun(altitudeKm, spanKm) {
  const half = Math.atan2(spanKm / 2, altitudeKm);
  const light = new THREE.SpotLight(0xfff4e0, 2.4, 0, Math.min(half * 1.2, 1.4), 0.15, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = altitudeKm * 0.05;
  light.shadow.camera.far = altitudeKm * 4;
  light.shadow.normalBias = spanKm * 1e-3;
  return light;
}
```

- [ ] **Step 2: Give eratosthenes its lights**

In `docs/flat-earth/js/phenomena/eratosthenes.js`:

Add to the imports:

```js
import { FLAT_SUN_ALTITUDE_KM } from '../physics/constants.js';
import { makeParallelSun, makeLocalSun } from '../lib/world.js';
```

(`FLAT_SUN_ALTITUDE_KM` joins the existing `../physics/constants.js` import line.)

Extend the module-level state declaration:

```js
let flatRoot, globeRoot, flatRig, globeRig, flatGnomons, globeGnomons;
let flatSun, globeSun, flatSunTarget, globeSunTarget;
```

In `build()`, after the gnomon loop and before the rigs are created, add:

```js
    // The flat model's sun is 5,000 km up, so its rays DIVERGE and strike each
    // observer at a different angle. The globe's sun is 1 AU away, so its rays
    // are parallel. That difference is the entire argument of this module, so
    // each pane gets the light type its model actually claims.
    // Span half the disc radius: gnomon sites sit at AE radii of roughly
    // 5,000-7,200 km and the subsolar point between ~4,500 and ~8,900 km, so
    // a +/-5,000 km frustum covers every reachable configuration at 4.9 km per
    // texel — a 60x margin against a 300 km shadow.
    flatSun = makeLocalSun(FLAT_SUN_ALTITUDE_KM, FLAT_DISC_RADIUS_KM / 2);
    flatSunTarget = new THREE.Object3D();
    flatSun.target = flatSunTarget;
    flatRoot.add(flatSun, flatSunTarget);

    globeSun = makeParallelSun(R_EARTH_KM * 0.5);
    globeSunTarget = new THREE.Object3D();
    globeSun.target = globeSunTarget;
    globeRoot.add(globeSun, globeSunTarget);
```

- [ ] **Step 3: Drive the lights from the same declination the readout uses**

Replace the whole `update(state)` body with:

```js
  update(state) {
    const decl = solarDeclinationDeg(state.dayOfYear);
    const lats = [state.latA, state.latB, state.latC];

    lats.forEach((lat, i) => {
      // Flat pane: observers laid out along the AE radius from the disc centre.
      const r = azimuthalEquidistantRadiusKm(lat);
      flatGnomons[i].position.set(0, 0, r);

      // Globe pane: observers on the surface, sticks along the local vertical.
      const phi = lat * DEG;
      const pos = new THREE.Vector3(
        0, R_EARTH_KM * Math.sin(phi), R_EARTH_KM * Math.cos(phi));
      globeGnomons[i].position.copy(pos);
      globeGnomons[i].lookAt(pos.clone().multiplyScalar(2));
      globeGnomons[i].rotateX(Math.PI / 2);
    });

    // Both suns are placed from `decl` — the same value readout() feeds to
    // globeRadiusFromPairKm and flatSunAltitudeFromPairKm. The shadows on
    // screen and the numbers in the panel therefore share one input, so the
    // picture can be checked against the readout instead of merely illustrating
    // it. shadowLength() is gone: nothing draws a shadow any more.
    const subsolarR = azimuthalEquidistantRadiusKm(decl);
    flatSun.position.set(0, FLAT_SUN_ALTITUDE_KM, subsolarR);
    flatSunTarget.position.set(0, 0, subsolarR);

    const d = decl * DEG;
    globeSun.position.set(
      0, Math.sin(d) * R_EARTH_KM * 4, Math.cos(d) * R_EARTH_KM * 4);
    globeSunTarget.position.set(0, 0, 0);
  },
```

Delete the now-unused `shadowLength` helper near the top of the file:

```js
const shadowLength = (stickKm, zenithDeg) => stickKm * Math.tan(zenithDeg * DEG);
```

Also update the `makeGnomon` calls in `build()` — the second argument is gone:

```js
      const f = makeGnomon(STICK_KM);
      const g = makeGnomon(STICK_KM);
```

Extend `dispose()` to clear the new references:

```js
  dispose() {
    flatRig?.dispose(); globeRig?.dispose();
    if (flatRoot) disposeTree(flatRoot);
    if (globeRoot) disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatGnomons = globeGnomons = null;
    flatSun = globeSun = flatSunTarget = globeSunTarget = null;
  },
```

- [ ] **Step 4: Verify the shadows are real and correct**

```bash
cd docs/flat-earth && python serve.py 8130
```

Select **Eratosthenes**. Check all of:

1. **Each gnomon casts one visible shadow** in both panes — not zero, and not two (one real, one drawn).
2. **Shadows point away from the sun** in both panes, and swing as `Day of year` moves.
3. **On the globe pane, all three shadows are parallel**, because the rays are parallel.
4. **On the flat pane, the three shadows visibly fan**, because the rays diverge from a nearby source. This is the module's whole point — if the flat shadows are parallel too, the flat pane got the wrong light type and the demonstration is broken.
5. **No shadow acne** (stripey self-shadowing) and no peter-panning (shadow detached from the stick's base). If either appears, adjust `normalBias` in `world.js`.
6. Drag both panes: shadows stay attached as the camera orbits.

- [ ] **Step 5: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests — `js/physics/` is untouched, so the Eratosthenes maths tests still hold.

```bash
git add docs/flat-earth/js/lib/world.js docs/flat-earth/js/phenomena/eratosthenes.js
git commit -m "Cast real Eratosthenes shadows from model-appropriate light types"
```

---

### Task 9: Point the sun lights at their roots

**Files:**
- Modify: `docs/flat-earth/js/phenomena/midnight-sun.js`
- Modify: `docs/flat-earth/js/phenomena/sun-size.js`

**Interfaces:**
- Consumes: `makeSun` from Task 6, which now returns a `THREE.Group` with `userData.light`.
- Produces: nothing new.

`makeSun`'s light aims at a default target that is never added to the scene, so until this task the two sun-bearing modules light nothing. This is the one-line-per-module change the spec describes.

- [ ] **Step 1: Wire midnight-sun**

In `docs/flat-earth/js/phenomena/midnight-sun.js`, find where the suns are created and added (`flatSun = makeSun(SUN_DRAW_KM);` and `globeSun = makeSun(SUN_DRAW_KM * 4);`). Immediately after each is added to its root, add the matching line:

```js
    // Aim the sun's light at the world origin. Three.js aims a DirectionalLight
    // at a default target that is never added to any scene, so without this the
    // sun glows but illuminates nothing.
    flatSun.userData.light.target = flatRoot;
```

```js
    globeSun.userData.light.target = globeRoot;
```

Also update the `makeObserverMarker()` call to pass a visible scale — the checklist flagged the marker as a near-invisible speck:

```js
    makeObserverMarker(R_EARTH_KM * 0.04)
```

Use the same value for both panes.

- [ ] **Step 2: Wire sun-size**

In `docs/flat-earth/js/phenomena/sun-size.js`, after each `makeSun` result is added to its root:

```js
    flatSun.userData.light.target = flatRoot;
```

```js
    globeSun.userData.light.target = globeRoot;
```

- [ ] **Step 3: Verify both modules**

```bash
cd docs/flat-earth && python serve.py 8130
```

**Midnight sun** — at the defaults (latitude −70°, day 355), confirm:
- The readout still reads flat **7.0 h** vs globe **24.0 h**
- The observer marker is now clearly visible and stands **out** from the surface along the local vertical, in both panes
- The lit side of the globe follows the sun as `Time of day` changes

**Sun size** — at noon, confirm:
- Both panes read ≈**0.533°** and the two suns look the same size
- At 18:00 on day 81 the flat figure falls to ≈**33%** and the flat sun visibly shrinks
- The solar disc has a **sharp edge with no halo or bloom** — sun-size measures that edge

- [ ] **Step 4: Run the full suite and commit**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests

```bash
git add docs/flat-earth/js/phenomena/midnight-sun.js docs/flat-earth/js/phenomena/sun-size.js
git commit -m "Aim the sun lights at their roots; enlarge the observer marker"
```

---

### Task 10: Documentation and full verification

**Files:**
- Modify: `docs/flat-earth/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Document the data and the constraint**

In `docs/flat-earth/README.md`, add a section immediately after the existing `## Three.js` section:

```markdown
## Coastline data

`data/coastlines.json` is derived from **Natural Earth 4.1.0 `ne_110m_land`**,
which is public domain: "No permission is needed to use Natural Earth."
128 rings, 5,143 points, ~70 KB.

Regenerate with:

    curl -o /tmp/ne.zip https://naciscdn.org/naturalearth/110m/physical/ne_110m_land.zip
    python -m zipfile -e /tmp/ne.zip /tmp/ne/
    node tools/build-coastlines.mjs /tmp/ne/ne_110m_land.shp data/coastlines.json

Real coastlines rather than procedural ones because `flight-routes` draws
Sydney→Santiago and `time-zones` labels ten real cities. Invented continents
under real city names would be a picture disagreeing with a readout — the exact
defect class this app exists to avoid.

The disc's map is projected through `azimuthalEquidistantXY()`, the same
function `flight-routes` uses for its distances, so the map and the number
above it cannot disagree.

## The signal budget

`js/lib/signal-budget.js` declares, per module, the magnitude of the effect
being measured and the ceiling on any visual detail placed near it.
`test/signal-budget.test.js` enforces a 10× separation.

This is why the ocean has a normal map and **exactly zero** vertical
displacement: waves of even a metre or two would be comparable to the 3.79 m of
hidden hull the horizon module exists to measure. For the same reason there is
no cloud layer (it would cover the terminator), no bloom on the sun (it would
blur the edge whose angular size is the measurement), and no limb haze.

The test locks the declared numbers. It cannot verify the renderer honours them
— nothing headless can, which is why the manual visual checklist below still
runs.
```

- [ ] **Step 2: Add the new checklist rows**

In `docs/flat-earth/README.md`, add to the end of the `## Manual visual checklist` list:

```markdown
- [ ] **Textures and geography** — the globe is recognisably Earth with
      continents in the correct places, and the disc shows the flat-earth map
      with the north pole centred and Antarctica around the rim. Spot-check
      three: Australia is an island, Antarctica surrounds the disc's edge
      rather than sitting as a blob, and the Americas are west of Africa.
- [ ] **The ocean has no waves.** Surface texture and shading detail only. Any
      visible vertical relief on the sea means displacement crept in and the
      horizon module's 3.79 m signal is compromised.
- [ ] **Eratosthenes shadows fan on the flat pane and stay parallel on the
      globe pane.** This is the module's argument rendered rather than
      asserted: a nearby sun produces diverging rays, a distant one parallel
      rays. Parallel shadows on the flat pane mean it was given the globe's
      light type.
- [ ] **The solar disc has a sharp edge** with no halo, bloom or flare —
      `sun-size` measures that edge.
- [ ] **Boot stays under 400 ms of texture generation.** The console logs
      `[flat-earth] textures generated in NNN ms` and warns above budget.
- [ ] **Degradation:** rename `data/coastlines.json` and reload. The app must
      boot fully with untextured surfaces, all eight phenomena working and no
      error card. Restore it afterwards.
```

- [ ] **Step 3: Run the complete headless suite**

Run: `node --test "docs/flat-earth/test/**/*.test.js"`
Expected: PASS, 66 tests, zero failures.

- [ ] **Step 4: Walk the entire manual visual checklist**

```bash
cd docs/flat-earth && python serve.py 8130
```

Work through **every** row in `README.md`'s checklist, including the pre-existing rows. For each, check **both** the readout number **and** what the picture shows.

Confirm specifically that the previously-passing numbers are unchanged:

| Module | Expected readout |
|---|---|
| Horizon | 3.8 m hidden / 5.05 km horizon at 12 km, 2 m eye |
| Eratosthenes | 6371 km from both pairs at 0% disagreement |
| Midnight sun | flat 7.0 h vs globe 24.0 h at −70°, day 355 |
| Sun size | ≈0.533° both at noon; flat ≈33% at 18:00, day 81 |
| Lunar eclipse | 555 km / 131.6× at 85° |
| Southern stars | CW / Sigma Octantis at −35°; CCW / Polaris at +35° |
| Flight routes | globe 11 347 km / 12.6 h; flat 25 684 km / 28.5 h |
| Time zones | flat 8 of 10 (3 wrong); globe 5 of 10 (0 wrong) |

A changed number here means the rendering work reached the physics, which it must not.

- [ ] **Step 5: Switch phenomena 20 times and confirm no leak**

Cycle through all eight modules at least twice. Confirm: no console errors, no slowdown, and dragging still moves the camera by the same amount per pixel as at the start.

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/README.md
git commit -m "Document coastline data, the signal budget, and new checklist rows"
```

---

## Verification Summary

**Headless:** 66 tests via `node --test "docs/flat-earth/test/**/*.test.js"` — 43 pre-existing (untouched), 7 noise, 4 signal budget, 5 coastlines, 7 map projection.

**Manual:** the full checklist in `docs/flat-earth/README.md`, which rendering has no headless substitute for.

**The invariant this plan is built around:** the readout numbers in Task 10 Step 4 must be **identical** to those recorded before this work. Nothing here is allowed to change what the app claims — only how convincingly it shows it.
