# Flat Earth Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a split-screen simulator that runs the same scenario under a flat-disc and a globe model of the Earth, showing where their predictions diverge from observation, published at `/flat-earth/` on the existing GitHub Pages site.

**Architecture:** One `WebGLRenderer` on one canvas renders two scenes into two scissored viewports. Each of eight phenomena is a self-contained plugin module supplying its own scene pair, camera rigs, controls, and readout. Beneath the modules sits a pure-math `physics/` layer with no Three.js or DOM dependency — that layer is the testable core, and it is where every number displayed on screen comes from.

**Tech Stack:** Vanilla JavaScript, ES modules, Three.js r185 (vendored, not CDN), `node --test` from the Node standard library. No bundler, no transpiler, no npm install.

**Spec:** `docs/superpowers/specs/2026-08-02-flat-earth-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No build step.** No bundler, no transpiler, no framework. Browsers load `.js` files directly as ES modules.
- **No runtime dependencies.** `package.json` contains exactly `{"type":"module","private":true}` and never gains a `dependencies` block. It exists only so Node treats `.js` as ESM.
- **Three.js is vendored** at `docs/flat-earth/third-party/three.module.js`, pinned to **r185**. Never load it from a CDN. The directory must **not** be named `vendor/` — `docs/_config.yml` excludes `vendor` from the Jekyll build and would drop it from the published site.
- **`physics/` imports nothing.** No Three.js, no DOM, no `fetch`. Pure functions only. This is what makes `node --test` possible without a browser.
- **`readout(state)` must never depend on `build()` having run.** It reads `state`, calls `physics/`, and returns strings. The WebGL-unavailable fallback depends on this.
- **All angles in public function signatures are degrees**, all distances are kilometres, all heights in readouts are metres. Functions converting internally to radians do so privately. Any function taking or returning radians has `Rad` in its name.
- **On-screen copy is clinical.** `CLAIM`, `PREDICTION`, `OBSERVED`. No jokes, no profanity, no first person. Site-voice commentary belongs in a blog post, not the app.
- **The flat model is steelmanned.** North-pole-centred azimuthal equidistant projection, sun 5,000 km up, sun diameter *derived* so it subtends the observed 0.533° overhead. Never hard-code 51 km.
- **Node 18+** required for `node --test`. Verified available: v24.15.0.
- **Commit after every task.** Branch is `spec/flat-earth-lab`.

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Markup shell, importmap pointing at vendored Three.js, no front matter |
| `style.css` | All styling, including the ≤900 px stacked layout |
| `package.json` | ESM flag for Node only |
| `README.md` | How to run, pinned Three.js version, manual visual checklist |
| `third-party/three.module.js` | Vendored Three.js r185 |
| `js/main.js` | Renderer, rAF loop, module lifecycle, wiring |
| `js/app-state.js` | State object + emitter |
| `js/viewport.js` | Dual-viewport scissor rendering |
| `js/registry.js` | Imports and orders phenomena; catches module build errors |
| `js/ui/selector.js` | Phenomenon picker |
| `js/ui/controls.js` | Builds control inputs from `module.controls` |
| `js/ui/readout.js` | CLAIM / PREDICTION / OBSERVED panel |
| `js/ui/loading.js` | Loading screen |
| `js/ui/error-card.js` | Renders failure cards into a pane or the canvas area |
| `js/lib/primitives.js` | `makeDisc`, `makeDome`, `makeGlobe`, `makeSun`, `makeObserver`, `makeShip` |
| `js/lib/materials.js` | Shared materials |
| `js/lib/camera-rig.js` | Camera construction, orbit control, pane linking |
| `js/lib/starfield.js` | Star sphere and trail rendering |
| `js/physics/constants.js` | Physical and model constants |
| `js/physics/geodesy.js` | Horizon, hidden height, great circle, AE projection |
| `js/physics/solar.js` | Declination, day length, angular diameter, flat-sun solving |
| `js/physics/eclipse.js` | Shadow ellipse axes and edge curvature |
| `js/physics/sky.js` | Pole altitude and sky rotation direction |
| `js/phenomena/*.js` | Eight plugin modules |
| `data/cities.json` | Fixed city fixtures for routes and time zones |
| `test/*.test.js` | `node --test` over `js/physics/` only |

---

## Task Sequencing

Phase 1 builds the foundation and proves the module contract against one real
scene. **Task 7 is a hard gate** — the remaining seven modules are written
against the contract only after `horizon` has shown it works. If the gate
changes the contract, Tasks 8–19 get amended before they are executed.

| Phase | Tasks | Deliverable |
|---|---|---|
| 1 — Foundation | 1–7 | Working app with one phenomenon; contract frozen |
| 2 — Solar group | 8–11 | Eratosthenes, midnight sun, sun size |
| 3 — Eclipse & sky group | 12–14 | Lunar eclipse, southern stars |
| 4 — Map group | 15–17 | Flight routes, time zones |
| 5 — Hardening | 18–19 | Failure paths, responsive, README |

---

# Phase 1 — Foundation

## Task 1: Project skeleton and Jekyll publish path

**Files:**
- Create: `docs/flat-earth/package.json`
- Create: `docs/flat-earth/index.html`
- Create: `docs/flat-earth/style.css`
- Create: `docs/flat-earth/README.md`
- Create: `docs/flat-earth/third-party/three.module.js` (downloaded)

**Interfaces:**
- Consumes: nothing
- Produces: a served page at `/flat-earth/`; `THREE` importable from `../third-party/three.module.js`

- [ ] **Step 1: Create the ESM flag file**

`docs/flat-earth/package.json`:

```json
{
  "type": "module",
  "private": true
}
```

- [ ] **Step 2: Vendor Three.js r185**

```bash
cd docs/flat-earth
mkdir -p third-party
curl -fsSL https://unpkg.com/three@0.185.1/build/three.module.js -o third-party/three.module.js
```

Verify it downloaded real code, not an error page:

```bash
head -c 200 third-party/three.module.js
wc -c third-party/three.module.js
```

Expected: JavaScript source, and a size over 1,000,000 bytes. If it is under
10 KB you fetched an error page — stop and fix before continuing.

- [ ] **Step 3: Write the markup shell**

`docs/flat-earth/index.html` — no YAML front matter, so Jekyll copies it verbatim:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flat Earth Lab</title>
<link rel="stylesheet" href="style.css">
<script type="importmap">
{ "imports": { "three": "./third-party/three.module.js" } }
</script>
</head>
<body>
<div id="loading-screen"><p id="loading-status">Initializing…</p></div>

<header id="app-header">
  <h1>FLAT EARTH LAB</h1>
  <select id="phenomenon-select" aria-label="Phenomenon"></select>
  <button id="params-button" type="button" aria-label="Model parameters">i</button>
</header>

<main id="stage">
  <div id="pane-labels"><span>FLAT MODEL</span><span>GLOBE MODEL</span></div>
  <canvas id="scene-canvas"></canvas>
  <div id="canvas-error" hidden></div>
</main>

<section id="control-strip"></section>
<section id="readout-panel"></section>
<dialog id="params-dialog"></dialog>

<script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write minimal styling**

`docs/flat-earth/style.css`:

```css
:root { --bg:#0b0e13; --fg:#d7dee8; --dim:#8a97a8; --rule:#232a35; --warn:#e0a33e; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg);
       font:14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
#app-header { display:flex; gap:1rem; align-items:center;
              padding:.75rem 1rem; border-bottom:1px solid var(--rule); }
#app-header h1 { font-size:1rem; letter-spacing:.18em; margin:0; }
#stage { position:relative; height:60vh; min-height:320px; }
#scene-canvas { width:100%; height:100%; display:block; }
#pane-labels { position:absolute; inset:0 0 auto 0; display:flex;
               pointer-events:none; z-index:2; }
#pane-labels span { flex:1; padding:.5rem 1rem; color:var(--dim);
                    letter-spacing:.16em; font-size:.75rem; }
#control-strip, #readout-panel { padding:1rem; border-top:1px solid var(--rule); }
#loading-screen { position:fixed; inset:0; background:var(--bg); z-index:10;
                  display:grid; place-items:center; }
.error-card { border:1px solid var(--warn); color:var(--warn);
              padding:1rem; margin:1rem; }
@media (max-width: 900px) {
  #pane-labels { flex-direction:column; }
  #stage { height:70vh; }
}
```

- [ ] **Step 5: Write the README**

`docs/flat-earth/README.md`:

```markdown
# Flat Earth Lab

Split-screen simulator comparing flat-disc and globe models of the Earth
against observation. Design spec:
`docs/superpowers/specs/2026-08-02-flat-earth-design.md`

## Run locally

    cd docs/flat-earth
    python -m http.server

Open http://localhost:8000

## Tests

    node --test docs/flat-earth/test/

Covers `js/physics/` only — pure math, no browser required.

## Three.js

Vendored at `third-party/three.module.js`, pinned to **r185** (0.185.1).
Not loaded from a CDN: a blank portfolio page caused by a CDN outage is not
an acceptable failure mode. Upgrades are deliberate — replace the file and
re-run the manual visual checklist below.

The directory is named `third-party/`, not `vendor/`, because
`docs/_config.yml` excludes `vendor` from the Jekyll build.

## Manual visual checklist

Rendering has no headless GL path. After any change to `js/lib/` or
`js/phenomena/`, load each phenomenon and confirm both panes draw.
```

- [ ] **Step 6: Verify the page serves and Three.js imports**

```bash
cd docs/flat-earth && python -m http.server 8123 &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/third-party/three.module.js
kill %1
```

Expected: `200` for both.

- [ ] **Step 7: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): project skeleton with vendored Three.js r185"
```

---

## Task 2: Physics constants and horizon geometry

**Files:**
- Create: `docs/flat-earth/js/physics/constants.js`
- Create: `docs/flat-earth/js/physics/geodesy.js`
- Test: `docs/flat-earth/test/geodesy.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `R_EARTH_KM`, `AU_KM`, `SUN_DIAMETER_KM`, `EARTH_ORBIT_ECCENTRICITY`, `OBLIQUITY_DEG`, `FLAT_SUN_ALTITUDE_KM`, `CRUISE_SPEED_KMH`, `DEG`, `RAD`
  - `clamp(v, lo, hi) -> number`
  - `horizonDistanceKm(eyeHeightM) -> number`
  - `geometricDropM(distanceKm) -> number`
  - `hiddenHeightM(distanceKm, eyeHeightM) -> number`

- [ ] **Step 1: Write the failing test**

`docs/flat-earth/test/geodesy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  horizonDistanceKm, geometricDropM, hiddenHeightM, clamp,
} from '../js/physics/geodesy.js';

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ±${tol}, got ${actual}`);

test('horizon distance for a 2 m eye height is about 5.05 km', () => {
  near(horizonDistanceKm(2), 5.048, 0.01, 'horizonDistanceKm(2)');
});

test('geometric drop at 12 km is about 11.3 m', () => {
  near(geometricDropM(12), 11.30, 0.05, 'geometricDropM(12)');
});

test('hidden height at 12 km with 2 m eye height is about 3.79 m', () => {
  near(hiddenHeightM(12, 2), 3.79, 0.05, 'hiddenHeightM(12,2)');
});

test('hidden height and geometric drop are different quantities', () => {
  assert.ok(hiddenHeightM(12, 2) < geometricDropM(12) - 5,
    'hidden height must not be conflated with geometric drop');
});

test('nothing is hidden inside the horizon', () => {
  assert.equal(hiddenHeightM(3, 2), 0);
  assert.equal(hiddenHeightM(0, 2), 0);
});

test('a taller observer sees further and hides less', () => {
  assert.ok(horizonDistanceKm(30) > horizonDistanceKm(2));
  assert.ok(hiddenHeightM(12, 30) < hiddenHeightM(12, 2));
});

test('clamp bounds values', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
  assert.equal(clamp(1.5, 0, 3), 1.5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test docs/flat-earth/test/geodesy.test.js`
Expected: FAIL — `Cannot find module .../js/physics/geodesy.js`

- [ ] **Step 3: Write the constants**

`docs/flat-earth/js/physics/constants.js`:

```js
// Physical constants. All distances km, all angles degrees unless named *Rad.
export const R_EARTH_KM = 6371;
export const AU_KM = 149597870.7;
export const SUN_DIAMETER_KM = 1391400;
export const EARTH_ORBIT_ECCENTRICITY = 0.0167;
export const OBLIQUITY_DEG = 23.44;

// Flat-model parameters. The sun's altitude is the model's own standard figure.
// Its diameter is NOT fixed here — solar.js derives it so the sun subtends the
// observed angular size when overhead, which hands the model its best case.
export const FLAT_SUN_ALTITUDE_KM = 5000;

// Disc radius: north pole at centre, south "rim" at latitude -90.
export const FLAT_DISC_RADIUS_KM = R_EARTH_KM * Math.PI;

export const CRUISE_SPEED_KMH = 900;

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
```

- [ ] **Step 4: Write the minimal implementation**

`docs/flat-earth/js/physics/geodesy.js`:

```js
import { R_EARTH_KM } from './constants.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Distance to the visible horizon for an observer eyeHeightM above the surface. */
export function horizonDistanceKm(eyeHeightM) {
  const h = Math.max(0, eyeHeightM) / 1000;
  return Math.sqrt(2 * R_EARTH_KM * h);
}

/** Curvature drop of the surface over distanceKm. NOT what an observer sees hidden. */
export function geometricDropM(distanceKm) {
  const d = Math.max(0, distanceKm);
  return (d * d) / (2 * R_EARTH_KM) * 1000;
}

/**
 * Height of a distant object concealed below the observer's line of sight.
 * Zero inside the horizon. This is the quantity the UI reports, because it is
 * what is actually observed — geometricDropM is the commonly misquoted one.
 */
export function hiddenHeightM(distanceKm, eyeHeightM) {
  const beyond = distanceKm - horizonDistanceKm(eyeHeightM);
  if (beyond <= 0) return 0;
  return (beyond * beyond) / (2 * R_EARTH_KM) * 1000;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test docs/flat-earth/test/geodesy.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/js/physics docs/flat-earth/test
git commit -m "feat(flat-earth): horizon geometry with hidden height vs geometric drop"
```

---

## Task 3: State store

**Files:**
- Create: `docs/flat-earth/js/app-state.js`
- Test: `docs/flat-earth/test/app-state.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `createState(initial) -> { get(), set(patch), reset(next), subscribe(fn) -> unsubscribe }`

`app-state.js` has no DOM or Three.js dependency, so it is testable in Node
even though it lives outside `physics/`.

- [ ] **Step 1: Write the failing test**

`docs/flat-earth/test/app-state.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../js/app-state.js';

test('get returns a copy, not the live object', () => {
  const s = createState({ a: 1 });
  s.get().a = 99;
  assert.equal(s.get().a, 1);
});

test('set merges a patch and notifies subscribers', () => {
  const s = createState({ a: 1, b: 2 });
  const seen = [];
  s.subscribe(v => seen.push(v));
  s.set({ b: 3 });
  assert.deepEqual(s.get(), { a: 1, b: 3 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].b, 3);
});

test('set does not notify when nothing changed', () => {
  const s = createState({ a: 1 });
  let calls = 0;
  s.subscribe(() => { calls += 1; });
  s.set({ a: 1 });
  assert.equal(calls, 0);
});

test('reset replaces state wholesale and notifies', () => {
  const s = createState({ a: 1, b: 2 });
  const seen = [];
  s.subscribe(v => seen.push(v));
  s.reset({ c: 9 });
  assert.deepEqual(s.get(), { c: 9 });
  assert.equal(seen.length, 1);
});

test('unsubscribe stops notifications', () => {
  const s = createState({ a: 1 });
  let calls = 0;
  const off = s.subscribe(() => { calls += 1; });
  s.set({ a: 2 });
  off();
  s.set({ a: 3 });
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test docs/flat-earth/test/app-state.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`docs/flat-earth/js/app-state.js`:

```js
/**
 * Minimal observable state store. The single channel between UI and simulation.
 * No DOM, no Three.js — testable in Node.
 */
export function createState(initial = {}) {
  let value = { ...initial };
  const listeners = new Set();

  const notify = () => {
    const snapshot = { ...value };
    for (const fn of listeners) fn(snapshot);
  };

  return {
    get: () => ({ ...value }),

    set(patch) {
      let changed = false;
      for (const [k, v] of Object.entries(patch)) {
        if (!Object.is(value[k], v)) { changed = true; break; }
      }
      if (!changed) return;
      value = { ...value, ...patch };
      notify();
    },

    reset(next = {}) {
      value = { ...next };
      notify();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test docs/flat-earth/test/app-state.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth/js/app-state.js docs/flat-earth/test/app-state.test.js
git commit -m "feat(flat-earth): observable state store"
```

---

## Task 4: Dual-viewport renderer

**Files:**
- Create: `docs/flat-earth/js/viewport.js`
- Create: `docs/flat-earth/js/lib/camera-rig.js`
- Create: `docs/flat-earth/js/lib/materials.js`

**Interfaces:**
- Consumes: `THREE` from `three`
- Produces:
  - `createDualViewport(canvas) -> { flatScene, globeScene, setCameras(flatCam, globeCam), render(), resize(), dispose(), renderer }`
  - `createOrbitRig({ fov, near, far, distance, target }) -> { camera, attach(el), update(), setLinked(other|null), dispose() }`
  - `MATERIALS` object with `ocean`, `land`, `hull`, `sail`, `sunGlow`, `domeGlass`, `shadow`, `starPoint`

Stacked layout below 900 px is a **vertical** split (flat on top); side-by-side
above it. `viewport.js` decides this from canvas aspect, not a media query, so
the split always matches what CSS produced.

- [ ] **Step 1: Write shared materials**

`docs/flat-earth/js/lib/materials.js`:

```js
import * as THREE from 'three';

export const MATERIALS = {
  ocean:     new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.7 }),
  land:      new THREE.MeshStandardMaterial({ color: 0x2f4f3a, roughness: 0.9 }),
  hull:      new THREE.MeshStandardMaterial({ color: 0xb8412f, roughness: 0.6 }),
  sail:      new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.8 }),
  sunGlow:   new THREE.MeshBasicMaterial({ color: 0xffd27f }),
  domeGlass: new THREE.MeshBasicMaterial({
    color: 0x4a6fa5, transparent: true, opacity: 0.12, side: THREE.BackSide,
  }),
  shadow:    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.85, transparent: true }),
  starPoint: new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.6, sizeAttenuation: false }),
};

export function disposeMaterials() {
  for (const m of Object.values(MATERIALS)) m.dispose();
}
```

- [ ] **Step 2: Write the camera rig**

`docs/flat-earth/js/lib/camera-rig.js`:

```js
import * as THREE from 'three';

/**
 * Orbit camera on a spherical rig. Deliberately hand-rolled rather than pulling
 * in OrbitControls, so the vendored payload stays to a single Three.js file.
 * setLinked(other) makes drags on this rig drive the other rig too.
 */
export function createOrbitRig({
  fov = 50, near = 0.01, far = 1e9,
  distance = 10, target = new THREE.Vector3(0, 0, 0),
  minDistance = 0.1, maxDistance = 1e8,
  polar = Math.PI / 2.4, azimuth = 0,
} = {}) {
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const state = { distance, polar, azimuth, target: target.clone() };
  let linked = null;
  let el = null;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function apply() {
    const sp = Math.sin(state.polar), cp = Math.cos(state.polar);
    camera.position.set(
      state.target.x + state.distance * sp * Math.sin(state.azimuth),
      state.target.y + state.distance * cp,
      state.target.z + state.distance * sp * Math.cos(state.azimuth),
    );
    camera.lookAt(state.target);
  }

  function orbit(dx, dy, propagate = true) {
    state.azimuth -= dx * 0.005;
    state.polar = Math.min(Math.PI - 0.01, Math.max(0.01, state.polar - dy * 0.005));
    apply();
    if (propagate && linked) linked.orbit(dx, dy, false);
  }

  function zoom(delta, propagate = true) {
    state.distance = Math.min(maxDistance,
      Math.max(minDistance, state.distance * (1 + delta * 0.001)));
    apply();
    if (propagate && linked) linked.zoom(delta, false);
  }

  const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
  const onUp = () => { dragging = false; };
  const onMove = e => {
    if (!dragging) return;
    orbit(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  };
  const onWheel = e => { e.preventDefault(); zoom(e.deltaY); };

  apply();

  return {
    camera,
    orbit,
    zoom,
    setDistance(d) { state.distance = d; apply(); },
    setTarget(v) { state.target.copy(v); apply(); },
    setLinked(other) { linked = other; },
    attach(element) {
      el = element;
      el.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
      el.addEventListener('wheel', onWheel, { passive: false });
    },
    dispose() {
      if (!el) return;
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('wheel', onWheel);
      el = null;
      linked = null;
    },
  };
}
```

- [ ] **Step 3: Write the dual viewport**

`docs/flat-earth/js/viewport.js`:

```js
import * as THREE from 'three';

/**
 * One WebGLRenderer, one canvas, two scenes drawn into two scissored viewports.
 * Splits horizontally when the canvas is wide, vertically when it is tall, so
 * the split always agrees with whatever layout CSS produced.
 */
export function createDualViewport(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setScissorTest(true);

  const flatScene = new THREE.Scene();
  const globeScene = new THREE.Scene();
  for (const scene of [flatScene, globeScene]) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(1, 1, 1);
    scene.add(key);
  }

  let flatCam = null, globeCam = null;

  function panes() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return w >= h
      ? [{ x: 0, y: 0, w: w / 2, h }, { x: w / 2, y: 0, w: w / 2, h }]
      : [{ x: 0, y: h / 2, w, h: h / 2 }, { x: 0, y: 0, w, h: h / 2 }];
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    const [a, b] = panes();
    if (flatCam) { flatCam.aspect = a.w / a.h; flatCam.updateProjectionMatrix(); }
    if (globeCam) { globeCam.aspect = b.w / b.h; globeCam.updateProjectionMatrix(); }
  }

  function render() {
    if (!flatCam || !globeCam) return;
    const [a, b] = panes();
    for (const [pane, scene, cam] of [[a, flatScene, flatCam], [b, globeScene, globeCam]]) {
      renderer.setViewport(pane.x, pane.y, pane.w, pane.h);
      renderer.setScissor(pane.x, pane.y, pane.w, pane.h);
      renderer.render(scene, cam);
    }
  }

  return {
    renderer, flatScene, globeScene, render, resize,
    setCameras(f, g) { flatCam = f; globeCam = g; resize(); },
    dispose() { renderer.dispose(); },
  };
}
```

- [ ] **Step 4: Verify it renders**

There is no headless GL path. Temporarily append to `js/main.js` (create it as
a stub for this check only):

```js
import * as THREE from 'three';
import { createDualViewport } from './viewport.js';
const vp = createDualViewport(document.getElementById('scene-canvas'));
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100); cam.position.z = 5;
const cam2 = cam.clone();
for (const [scene, color] of [[vp.flatScene, 0xff4444], [vp.globeScene, 0x44ff44]]) {
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color })));
}
vp.setCameras(cam, cam2);
window.addEventListener('resize', vp.resize);
document.getElementById('loading-screen').hidden = true;
(function loop() { vp.render(); requestAnimationFrame(loop); })();
```

Serve and load. Expected: a red cube on the left half, a green cube on the
right half, split cleanly down the middle. Narrow the window below 900 px and
confirm the split becomes red-on-top, green-on-bottom.

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth/js
git commit -m "feat(flat-earth): dual-viewport renderer and orbit camera rig"
```

---

## Task 5: UI shell — selector, controls, readout, error cards

**Files:**
- Create: `docs/flat-earth/js/ui/selector.js`
- Create: `docs/flat-earth/js/ui/controls.js`
- Create: `docs/flat-earth/js/ui/readout.js`
- Create: `docs/flat-earth/js/ui/error-card.js`
- Create: `docs/flat-earth/js/ui/loading.js`
- Modify: `docs/flat-earth/style.css`

**Interfaces:**
- Consumes: `createState` from Task 3
- Produces:
  - `renderSelector(el, modules, activeId, onChange)`
  - `renderControls(el, controls, state)` — writes changes into the state store
  - `renderReadout(el, module, state)` — expects `module.readout(state)` to return `{ flat: Row[], globe: Row[], observed: string }` where `Row = { label, value }`
  - `showErrorCard(el, title, detail)`, `clearErrorCard(el)`
  - `setLoading(visible, statusText)`

- [ ] **Step 1: Write the error card and loading helpers**

`docs/flat-earth/js/ui/error-card.js`:

```js
export function showErrorCard(el, title, detail) {
  el.hidden = false;
  el.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'error-card';
  const h = document.createElement('strong');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  card.append(h, p);
  el.append(card);
}

export function clearErrorCard(el) {
  el.hidden = true;
  el.innerHTML = '';
}
```

`docs/flat-earth/js/ui/loading.js`:

```js
export function setLoading(visible, statusText = '') {
  const screen = document.getElementById('loading-screen');
  const status = document.getElementById('loading-status');
  if (statusText) status.textContent = statusText;
  screen.hidden = !visible;
}
```

- [ ] **Step 2: Write the selector**

`docs/flat-earth/js/ui/selector.js`:

```js
export function renderSelector(el, modules, activeId, onChange) {
  el.innerHTML = '';
  for (const m of modules) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.title;
    if (m.id === activeId) opt.selected = true;
    el.append(opt);
  }
  el.onchange = () => onChange(el.value);
}
```

- [ ] **Step 3: Write the control builder**

`docs/flat-earth/js/ui/controls.js`:

```js
/**
 * Builds inputs from module.controls and writes changes into the state store.
 * Two control kinds: a range slider (default) and a select (when `options` is
 * present). Values are clamped by the input element itself.
 */
export function renderControls(el, controls, state) {
  el.innerHTML = '';
  const current = state.get();

  for (const c of controls) {
    const wrap = document.createElement('label');
    wrap.className = 'control';

    const name = document.createElement('span');
    name.className = 'control-label';
    name.textContent = c.label;

    const value = document.createElement('span');
    value.className = 'control-value';

    let input;
    if (c.options) {
      input = document.createElement('select');
      for (const o of c.options) {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;
        if (o.value === current[c.id]) opt.selected = true;
        input.append(opt);
      }
      value.textContent = '';
      input.oninput = () => state.set({ [c.id]: input.value });
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.value = current[c.id];
      const show = () => { value.textContent = `${input.value} ${c.unit ?? ''}`.trim(); };
      show();
      input.oninput = () => { show(); state.set({ [c.id]: Number(input.value) }); };
    }

    wrap.append(name, input, value);
    el.append(wrap);
  }
}
```

- [ ] **Step 4: Write the readout panel**

`docs/flat-earth/js/ui/readout.js`:

```js
function column(heading, rows) {
  const col = document.createElement('div');
  col.className = 'readout-column';
  const h = document.createElement('h3');
  h.textContent = heading;
  col.append(h);
  for (const r of rows) {
    const line = document.createElement('div');
    line.className = 'readout-row';
    const l = document.createElement('span');
    l.textContent = r.label;
    const v = document.createElement('strong');
    v.textContent = r.value;
    line.append(l, v);
    col.append(line);
  }
  return col;
}

export function renderReadout(el, module, state) {
  el.innerHTML = '';

  const claim = document.createElement('p');
  claim.className = 'readout-claim';
  claim.textContent = `CLAIM — ${module.claim}`;

  const grid = document.createElement('div');
  grid.className = 'readout-grid';

  const data = module.readout(state.get());
  grid.append(
    column('PREDICTION — FLAT', data.flat),
    column('PREDICTION — GLOBE', data.globe),
  );

  const observed = document.createElement('p');
  observed.className = 'readout-observed';
  observed.textContent = `OBSERVED — ${data.observed}`;

  el.append(claim, grid, observed);
}
```

- [ ] **Step 5: Add the styling these need**

Append to `docs/flat-earth/style.css`:

```css
.control { display:grid; grid-template-columns:9rem 1fr 7rem;
           gap:.75rem; align-items:center; margin-bottom:.5rem; }
.control-label { color:var(--dim); }
.control-value { text-align:right; }
.readout-claim { color:var(--dim); margin:0 0 1rem; }
.readout-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
.readout-column h3 { font-size:.7rem; letter-spacing:.16em;
                     color:var(--dim); margin:0 0 .5rem; }
.readout-row { display:flex; justify-content:space-between;
               border-bottom:1px solid var(--rule); padding:.25rem 0; }
.readout-observed { margin:1rem 0 0; padding-top:.75rem;
                    border-top:1px solid var(--rule); }
@media (max-width: 900px) { .readout-grid { grid-template-columns:1fr; } }
```

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/js/ui docs/flat-earth/style.css
git commit -m "feat(flat-earth): UI shell for selector, controls, readout, errors"
```

---

## Task 6: Scene primitives and the horizon module (tracer bullet)

This is the task that proves the module contract. Build it carefully — Tasks
8–17 are all shaped by what it produces.

**Files:**
- Create: `docs/flat-earth/js/lib/primitives.js`
- Create: `docs/flat-earth/js/phenomena/horizon.js`
- Create: `docs/flat-earth/js/registry.js`
- Modify: `docs/flat-earth/js/main.js` (replace the Task 4 stub)

**Interfaces:**
- Consumes: `hiddenHeightM`, `horizonDistanceKm`, `geometricDropM` (Task 2); `createDualViewport` (Task 4); `createOrbitRig` (Task 4); `MATERIALS` (Task 4); UI functions (Task 5); `createState` (Task 3)
- Produces:
  - `makeOcean(sizeKm)`, `makeGlobeOcean(radiusKm)`, `makeShip(scaleKm)`, `makeObserverMarker()` from `primitives.js`
  - `MODULES` array and `getModule(id)` from `registry.js`
  - The frozen module contract, exercised end to end

- [ ] **Step 1: Write the primitives**

`docs/flat-earth/js/lib/primitives.js`:

```js
import * as THREE from 'three';
import { MATERIALS } from './materials.js';

/** Flat ocean plane, sizeKm across, lying in the XZ plane at y = 0. */
export function makeOcean(sizeKm) {
  const geo = new THREE.PlaneGeometry(sizeKm, sizeKm, 1, 1);
  const mesh = new THREE.Mesh(geo, MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Sphere of radius radiusKm centred at the origin. */
export function makeGlobeOcean(radiusKm) {
  const geo = new THREE.SphereGeometry(radiusKm, 96, 64);
  return new THREE.Mesh(geo, MATERIALS.ocean);
}

/**
 * Schematic ship: hull box plus mast and sail, total height ~scaleKm.
 * Origin sits at the waterline so it can be placed directly on a surface.
 */
export function makeShip(scaleKm) {
  const group = new THREE.Group();
  const hullH = scaleKm * 0.35;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(scaleKm * 0.9, hullH, scaleKm * 0.3), MATERIALS.hull);
  hull.position.y = hullH / 2;

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.02, scaleKm * 0.02, scaleKm * 0.65, 8),
    MATERIALS.sail);
  mast.position.y = hullH + scaleKm * 0.325;

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.4, scaleKm * 0.45), MATERIALS.sail);
  sail.position.set(scaleKm * 0.2, hullH + scaleKm * 0.35, 0);
  sail.material.side = THREE.DoubleSide;

  group.add(hull, mast, sail);
  return group;
}

export function makeObserverMarker() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), MATERIALS.sail);
  post.position.y = 0.25;
  g.add(post);
  return g;
}

/** Recursively free geometry owned by a subtree. Shared materials are not freed. */
export function disposeTree(root) {
  root.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
}
```

- [ ] **Step 2: Write the horizon module**

`docs/flat-earth/js/phenomena/horizon.js`:

```js
import * as THREE from 'three';
import { R_EARTH_KM } from '../physics/constants.js';
import { hiddenHeightM, horizonDistanceKm, geometricDropM } from '../physics/geodesy.js';
import { makeOcean, makeGlobeOcean, makeShip, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const SHIP_HEIGHT_KM = 0.04;   // 40 m mast-top — a schematic tall ship

let flatRoot, globeRoot, flatShip, globeShip, flatRig, globeRig;

export default {
  id: 'horizon',
  title: 'Ship Over the Horizon',
  claim: 'Ships shrink into the distance — they do not sink behind a curve.',

  controls: [
    { id: 'distanceKm', label: 'Distance', min: 0, max: 40, step: 0.5, unit: 'km' },
    { id: 'eyeHeightM', label: 'Eye height', min: 2, max: 30, step: 1, unit: 'm' },
  ],
  defaults: { distanceKm: 12, eyeHeightM: 2 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeOcean(200));
    flatShip = makeShip(SHIP_HEIGHT_KM);
    flatRoot.add(flatShip);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    globeShip = makeShip(SHIP_HEIGHT_KM);
    globeRoot.add(globeShip);

    // Both cameras sit at the observer's eye, looking along +Z toward the ship.
    flatRig = createOrbitRig({ fov: 12, near: 0.001, far: 5000, distance: 0.001 });
    globeRig = createOrbitRig({ fov: 12, near: 0.001, far: 5000, distance: 0.001 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera },
      globe: { root: globeRoot, camera: globeRig.camera },
    };
  },

  update(state) {
    const d = state.distanceKm;
    const eyeKm = state.eyeHeightM / 1000;

    // Flat pane: ocean in the XZ plane, observer at the origin.
    flatShip.position.set(0, 0, d);
    flatRig.setTarget(new THREE.Vector3(0, eyeKm, d));
    flatRig.camera.position.set(0, eyeKm, 0);
    flatRig.camera.lookAt(0, eyeKm, d);

    // Globe pane: observer at the north pole of a globe-radius sphere; the ship
    // sits on the surface d km away along a great circle.
    const theta = d / R_EARTH_KM;
    globeShip.position.set(
      0, R_EARTH_KM * Math.cos(theta), R_EARTH_KM * Math.sin(theta));
    globeShip.rotation.x = theta;
    globeRig.camera.position.set(0, R_EARTH_KM + eyeKm, 0);
    globeRig.camera.lookAt(globeShip.position);
  },

  readout(state) {
    const hidden = hiddenHeightM(state.distanceKm, state.eyeHeightM);
    const horizon = horizonDistanceKm(state.eyeHeightM);
    const drop = geometricDropM(state.distanceKm);
    const shipM = SHIP_HEIGHT_KM * 1000;

    return {
      flat: [
        { label: 'Hidden height', value: '0.0 m' },
        { label: 'Visible fraction', value: '100%' },
        { label: 'Horizon distance', value: 'unbounded' },
      ],
      globe: [
        { label: 'Hidden height', value: `${hidden.toFixed(1)} m` },
        { label: 'Visible fraction',
          value: `${Math.max(0, 100 * (1 - hidden / shipM)).toFixed(0)}%` },
        { label: 'Horizon distance', value: `${horizon.toFixed(2)} km` },
        { label: 'Geometric drop (not what is seen)', value: `${drop.toFixed(1)} m` },
      ],
      observed:
        'The hull disappears before the mast, from the bottom up. Only a curved ' +
        'surface produces this; a shrinking object stays whole as it shrinks.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatShip = globeShip = flatRig = globeRig = null;
  },
};
```

- [ ] **Step 3: Write the registry**

`docs/flat-earth/js/registry.js`:

```js
import horizon from './phenomena/horizon.js';

/** Ordered list. Adding a phenomenon is one import plus one array entry. */
export const MODULES = [horizon];

export const getModule = id => MODULES.find(m => m.id === id) ?? MODULES[0];
```

- [ ] **Step 4: Write the real main.js**

Replace the Task 4 stub entirely:

```js
import { createDualViewport } from './viewport.js';
import { createState } from './app-state.js';
import { MODULES, getModule } from './registry.js';
import { renderSelector } from './ui/selector.js';
import { renderControls } from './ui/controls.js';
import { renderReadout } from './ui/readout.js';
import { showErrorCard, clearErrorCard } from './ui/error-card.js';
import { setLoading } from './ui/loading.js';

const canvas = document.getElementById('scene-canvas');
const canvasError = document.getElementById('canvas-error');
const state = createState({});

let viewport = null;
let active = null;
let built = null;

function teardown() {
  if (!active) return;
  if (built) {
    viewport.flatScene.remove(built.flat.root);
    viewport.globeScene.remove(built.globe.root);
  }
  try { active.dispose(); } catch { /* teardown must not block a switch */ }
  active = null;
  built = null;
}

function activate(id) {
  teardown();
  const module = getModule(id);
  state.reset({ ...module.defaults });

  try {
    built = module.build({ canvas });
    viewport.flatScene.add(built.flat.root);
    viewport.globeScene.add(built.globe.root);
    viewport.setCameras(built.flat.camera, built.globe.camera);
    clearErrorCard(canvasError);
  } catch (err) {
    built = null;
    showErrorCard(canvasError, `${module.title} failed to load`,
      `${err.message} — other phenomena are unaffected.`);
  }

  active = module;
  renderControls(document.getElementById('control-strip'), module.controls, state);
  renderReadout(document.getElementById('readout-panel'), module, state);
  if (built) module.update(state.get(), 0);
}

function boot() {
  try {
    viewport = createDualViewport(canvas);
  } catch (err) {
    showErrorCard(canvasError, 'WebGL unavailable',
      `${err.message} — the numeric readouts below still work.`);
    canvas.hidden = true;
  }

  renderSelector(document.getElementById('phenomenon-select'),
    MODULES, MODULES[0].id, activate);

  state.subscribe(v => {
    if (active && built) active.update(v, 0);
    if (active) renderReadout(document.getElementById('readout-panel'), active, state);
  });

  activate(MODULES[0].id);

  if (viewport) {
    window.addEventListener('resize', viewport.resize);
    let last = performance.now();
    (function loop(now) {
      const dt = (now - last) / 1000; last = now;
      if (active && built) active.update(state.get(), dt);
      viewport.render();
      requestAnimationFrame(loop);
    })(last);
  }

  setLoading(false);
}

boot();
```

- [ ] **Step 5: Verify end to end**

```bash
cd docs/flat-earth && python -m http.server 8123
```

Load `http://localhost:8123/`. Confirm all of:

1. Loading screen disappears.
2. Two panes render an ocean and a ship.
3. Dragging either pane orbits **both** (this is `linkCameras`).
4. Moving the Distance slider to 12 km shows globe hidden height `3.8 m` and
   flat hidden height `0.0 m`.
5. Moving Distance below ~5 km shows `0.0 m` hidden in both.
6. Raising Eye height reduces the hidden figure.
7. The globe pane visibly occludes the hull from the bottom as distance grows;
   the flat pane's ship only gets smaller.

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): horizon phenomenon end to end, proving module contract"
```

---

## Task 7: GATE — freeze the module contract

**Files:**
- Modify: `docs/flat-earth/README.md` (append the frozen contract)

**Interfaces:**
- Consumes: everything Task 6 produced
- Produces: the contract that Tasks 8–17 are written against

**This is a review gate, not a code task.** Do not start Task 8 until it is done.

- [ ] **Step 1: Answer the contract questions in writing**

Review what building `horizon` actually taught, and record answers:

1. Did `build()` need anything from `ctx` beyond `canvas`? If modules needed
   `THREE` or materials injected rather than imported, change the signature now.
2. Did `update(state, dt)` need `dt`? `horizon` ignores it; animated modules
   (eclipse, time zones) will not. Confirm it stays.
3. Did the module need to own its camera *rig* rather than just a camera?
   `main.js` currently only receives `camera`, so rigs are module-private and
   `linkCameras` is not yet wired. **This is a known gap — resolve it here.**
4. Is `readout()` genuinely independent of `build()`? Verify by disabling WebGL
   in the browser and confirming numbers still render.
5. Do any later modules need to load external data before `build()`?
   Flight routes and time zones both read `data/cities.json`. Adding that hook
   **now**, while the contract is open, is the point of this gate — bolting it
   on at Task 16 would mean changing a contract that was supposedly frozen.

- [ ] **Step 2: Wire `linkCameras`, the one gap Task 6 exposed**

`build()` currently returns `{ root, camera }` per side, but linking needs the
rigs. Change the contract to return the rig alongside the camera:

```js
// build() returns:
{
  flat:  { root, camera, rig },   // rig may be null for modules with fixed cameras
  globe: { root, camera, rig },
}
```

In `horizon.js`, add `rig: flatRig` and `rig: globeRig` to the returned object.

In `main.js`, replace `activate()` entirely. This also adds the optional
`async load()` hook identified in Step 1 question 5, so the contract is complete
before it is frozen:

```js
async function activate(id) {
  teardown();
  const module = getModule(id);
  state.reset({ ...module.defaults });
  active = module;

  try {
    if (module.load) await module.load();
    built = module.build({ canvas });
    viewport.flatScene.add(built.flat.root);
    viewport.globeScene.add(built.globe.root);
    viewport.setCameras(built.flat.camera, built.globe.camera);
    if (module.linkCameras && built.flat.rig && built.globe.rig) {
      built.flat.rig.setLinked(built.globe.rig);
      built.globe.rig.setLinked(built.flat.rig);
    }
    for (const side of [built.flat, built.globe]) side.rig?.attach(canvas);
    clearErrorCard(canvasError);
  } catch (err) {
    built = null;
    showErrorCard(canvasError, `${module.title} is unavailable`,
      `${err.message} — other phenomena are unaffected.`);
  }

  renderControls(document.getElementById('control-strip'), module.controls, state);
  renderReadout(document.getElementById('readout-panel'), module, state);
  if (built) module.update(state.get(), 0);
}
```

And in `teardown()`, before `active.dispose()`:

```js
  if (built) for (const side of [built.flat, built.globe]) side.rig?.setLinked(null);
```

- [ ] **Step 3: Re-verify linked camera behaviour**

Reload and confirm dragging either pane orbits both, and that switching
phenomena does not accumulate event listeners (drag, switch, drag again — the
camera should move at the same rate, not double).

- [ ] **Step 4: Record the frozen contract in the README**

Append to `docs/flat-earth/README.md`:

```markdown
## Module contract (frozen at Task 7)

Each file in `js/phenomena/` default-exports:

    {
      id, title, claim,
      controls: [{ id, label, min, max, step, unit }]      // or { id, label, options: [{value,label}] }
      defaults: { ...controlId: value },
      linkCameras: boolean,
      load?()         -> Promise<void>,   // optional, awaited before build()
      build(ctx)      -> { flat: {root, camera, rig}, globe: {root, camera, rig} },
      update(state, dt),
      readout(state)  -> { flat: Row[], globe: Row[], observed: string },
      dispose(),
    }

    Row = { label: string, value: string }   // value preformatted, units included

Rules:
- The harness owns the two THREE.Scene instances. Modules return a `root` Group.
- `load()` is optional. Modules needing external data (cities.json) fetch it
  there and throw a descriptive Error on failure; the harness turns that into
  a pane error card without taking down the rest of the app.
- `rig` may be null for a module with a fixed camera; `linkCameras` is then ignored.
- `readout(state)` must not depend on `build()` having run — it reads state and
  calls `js/physics/` only. The WebGL-unavailable fallback relies on this.
- Adding a phenomenon: one file in `js/phenomena/`, one import and one array
  entry in `js/registry.js`. No UI code changes.
```

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): freeze module contract and wire linked cameras"
```

---

# Phase 2 — Solar group

## Task 8: Solar physics

**Files:**
- Create: `docs/flat-earth/js/physics/solar.js`
- Modify: `docs/flat-earth/js/physics/geodesy.js` (add AE radius)
- Modify: `docs/flat-earth/js/physics/constants.js` (add spotlight radius)
- Test: `docs/flat-earth/test/solar.test.js`

**Interfaces:**
- Consumes: `R_EARTH_KM`, `OBLIQUITY_DEG`, `AU_KM`, `SUN_DIAMETER_KM`, `EARTH_ORBIT_ECCENTRICITY`, `FLAT_SUN_ALTITUDE_KM`, `FLAT_DISC_RADIUS_KM`, `DEG`, `RAD` (Task 2)
- Produces, from `geodesy.js`:
  - `azimuthalEquidistantRadiusKm(latDeg) -> number`
- Produces, from `constants.js`:
  - `FLAT_SPOTLIGHT_RADIUS_KM`
- Produces, from `solar.js`:
  - `solarDeclinationDeg(dayOfYear) -> deg`
  - `subsolarPoint(dayOfYear, utcHours) -> { lat, lon }`
  - `dayLengthHours(latDeg, dayOfYear) -> hours`
  - `flatDayLengthHours(latDeg, dayOfYear) -> hours`
  - `earthSunDistanceKm(dayOfYear) -> km`
  - `solarAngularDiameterDeg(dayOfYear) -> deg`
  - `flatSunDiameterKm(altitudeKm?) -> km`
  - `flatSunAngularDiameterDeg(groundDistanceKm, altitudeKm?) -> deg`
  - `globeRadiusFromPairKm(latA, latB, declinationDeg) -> km`
  - `flatSunAltitudeFromPairKm(latA, latB, declinationDeg) -> km`
  - `isDaylitGlobe(point, dayOfYear, utcHours) -> boolean`
  - `isDaylitFlat(point, dayOfYear, utcHours) -> boolean`

**Model note the tests encode:** the flat spotlight radius is chosen so it
lights exactly half the disc's *area* — the model's best case. Any smaller and
it fails trivially; any larger and it lights more than half the world at once.

- [ ] **Step 1: Write the failing test**

`docs/flat-earth/test/solar.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solarDeclinationDeg, dayLengthHours, flatDayLengthHours,
  solarAngularDiameterDeg, flatSunDiameterKm, flatSunAngularDiameterDeg,
  globeRadiusFromPairKm, flatSunAltitudeFromPairKm,
  isDaylitGlobe, isDaylitFlat,
} from '../js/physics/solar.js';

const near = (a, e, tol, label) =>
  assert.ok(Math.abs(a - e) <= tol, `${label}: expected ${e} ±${tol}, got ${a}`);

test('declination peaks at the obliquity on the solstices', () => {
  near(solarDeclinationDeg(172), 23.44, 0.02, 'June solstice');
  near(solarDeclinationDeg(355), -23.44, 0.02, 'December solstice');
});

test('day length is 24 h at 70N on the June solstice', () => {
  assert.equal(dayLengthHours(70, 172), 24);
});

test('day length is 0 h at 70N on the December solstice', () => {
  assert.equal(dayLengthHours(70, 355), 0);
});

test('the Arctic Circle itself is deliberately not asserted at 24 h', () => {
  // 66.56 computes to ~23.91 h — exactly the boundary case that makes a test
  // flaky. Documented here so nobody "fixes" it to 24 later.
  assert.ok(dayLengthHours(66.56, 172) < 24);
  assert.ok(dayLengthHours(66.56, 172) > 23.5);
});

test('the flat model reproduces the ARCTIC midnight sun', () => {
  // Its spotlight covers the whole northern region. This is the flat model at
  // its best, and the app says so rather than hiding it.
  assert.equal(flatDayLengthHours(70, 172), 24);
});

test('the flat model CANNOT reproduce the Antarctic midnight sun', () => {
  assert.equal(dayLengthHours(-70, 355), 24);          // observed
  near(flatDayLengthHours(-70, 355), 6.95, 0.1, 'flat 70S December');
});

test('the flat model wrongly lights the Arctic in December', () => {
  assert.equal(dayLengthHours(70, 355), 0);            // observed: polar night
  near(flatDayLengthHours(70, 355), 17.37, 0.1, 'flat 70N December');
});

test('solar angular diameter stays inside 0.524-0.542 deg all year', () => {
  let min = Infinity, max = -Infinity;
  for (let d = 1; d <= 365; d += 1) {
    const a = solarAngularDiameterDeg(d);
    min = Math.min(min, a); max = Math.max(max, a);
  }
  near(min, 0.5241, 0.002, 'aphelion');
  near(max, 0.5420, 0.002, 'perihelion');
});

test('flat sun diameter is derived, never hard-coded at 51 km', () => {
  near(flatSunDiameterKm(), 46.505, 0.05, 'derived diameter');
  near(flatSunAngularDiameterDeg(0), 0.5329, 0.002, 'overhead matches observed');
});

test('the flat sun should more than halve in size by 10000 km ground distance', () => {
  const overhead = flatSunAngularDiameterDeg(0);
  const far = flatSunAngularDiameterDeg(10000);
  near(far, 0.2383, 0.002, 'flat sun at 10000 km');
  assert.ok(far < overhead / 2);
});

test('the globe gives one radius from every latitude pair', () => {
  near(globeRadiusFromPairKm(30, 45, 0), 6371, 1, 'pair A.B');
  near(globeRadiusFromPairKm(45, 60, 0), 6371, 1, 'pair B.C');
});

test('the flat model gives contradictory sun altitudes from two pairs', () => {
  const ab = flatSunAltitudeFromPairKm(30, 45, 0);
  const bc = flatSunAltitudeFromPairKm(45, 60, 0);
  near(ab, 3946.4, 5, 'pair A.B');
  near(bc, 2278.4, 5, 'pair B.C');
  const divergence = Math.abs(ab - bc) / Math.max(ab, bc);
  assert.ok(divergence > 0.20, `expected >20% divergence, got ${divergence}`);
});

test('the flat spotlight lights places that are actually in darkness', () => {
  const london = { lat: 51.5074, lon: -0.1278 };
  assert.equal(isDaylitGlobe(london, 172, 0), false);
  assert.equal(isDaylitFlat(london, 172, 0), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test docs/flat-earth/test/solar.test.js`
Expected: FAIL — `Cannot find module .../js/physics/solar.js`

- [ ] **Step 3: Add the AE radius helper and spotlight constant**

Append to `docs/flat-earth/js/physics/geodesy.js`:

```js
import { DEG } from './constants.js';

/**
 * Radial distance from the disc's centre (the north pole) on the standard
 * north-polar azimuthal equidistant map. Latitude -90 lands on the rim.
 */
export function azimuthalEquidistantRadiusKm(latDeg) {
  return R_EARTH_KM * (Math.PI / 2 - latDeg * DEG);
}
```

Append to `docs/flat-earth/js/physics/constants.js`:

```js
/**
 * Radius of the flat model's illuminated spotlight, chosen so it lights exactly
 * half the disc's AREA. This is the model's best case: smaller and it fails
 * trivially, larger and it lights more than half the world at once.
 */
export const FLAT_SPOTLIGHT_RADIUS_KM = FLAT_DISC_RADIUS_KM / Math.SQRT2;
```

- [ ] **Step 4: Write the implementation**

`docs/flat-earth/js/physics/solar.js`:

```js
import {
  R_EARTH_KM, AU_KM, SUN_DIAMETER_KM, EARTH_ORBIT_ECCENTRICITY,
  OBLIQUITY_DEG, FLAT_SUN_ALTITUDE_KM, FLAT_SPOTLIGHT_RADIUS_KM, DEG, RAD,
} from './constants.js';
import { azimuthalEquidistantRadiusKm } from './geodesy.js';

const DAYS = 365.25;

/** Solar declination. Simple obliquity model; accurate to a few tenths of a degree. */
export function solarDeclinationDeg(dayOfYear) {
  return -OBLIQUITY_DEG * Math.cos(2 * Math.PI * (dayOfYear + 10) / DAYS);
}

export function subsolarPoint(dayOfYear, utcHours) {
  return { lat: solarDeclinationDeg(dayOfYear), lon: -15 * (utcHours - 12) };
}

/** Hours between sunrise and sunset on a globe. Geometric, no refraction. */
export function dayLengthHours(latDeg, dayOfYear) {
  const cosH = -Math.tan(latDeg * DEG) * Math.tan(solarDeclinationDeg(dayOfYear) * DEG);
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return 24 * Math.acos(cosH) / Math.PI;
}

/**
 * Hours the flat model's spotlight covers an observer as it circles the disc.
 * Note this reproduces the Arctic midnight sun correctly — the model's genuine
 * failure is the Antarctic one, and the Arctic winter, not the Arctic summer.
 */
export function flatDayLengthHours(latDeg, dayOfYear) {
  const ro = azimuthalEquidistantRadiusKm(latDeg);
  const rs = azimuthalEquidistantRadiusKm(solarDeclinationDeg(dayOfYear));
  const cosDl = (ro * ro + rs * rs - FLAT_SPOTLIGHT_RADIUS_KM ** 2) / (2 * ro * rs);
  if (cosDl <= -1) return 24;
  if (cosDl >= 1) return 0;
  return 24 * Math.acos(cosDl) / Math.PI;
}

export function earthSunDistanceKm(dayOfYear) {
  return AU_KM * (1 - EARTH_ORBIT_ECCENTRICITY
    * Math.cos(2 * Math.PI * (dayOfYear - 4) / DAYS));
}

export function solarAngularDiameterDeg(dayOfYear) {
  return 2 * Math.atan(SUN_DIAMETER_KM / 2 / earthSunDistanceKm(dayOfYear)) * RAD;
}

/**
 * The flat sun's diameter is SOLVED, not asserted: it is whatever makes the sun
 * subtend the observed mean angular size when directly overhead. Hard-coding the
 * commonly quoted 51 km would make it visibly the wrong size even at noon, which
 * reads as a rigged premise.
 */
export function flatSunDiameterKm(altitudeKm = FLAT_SUN_ALTITUDE_KM) {
  const target = 2 * Math.atan(SUN_DIAMETER_KM / 2 / AU_KM);
  return 2 * altitudeKm * Math.tan(target / 2);
}

export function flatSunAngularDiameterDeg(groundDistanceKm,
                                          altitudeKm = FLAT_SUN_ALTITUDE_KM) {
  const slant = Math.hypot(altitudeKm, groundDistanceKm);
  return 2 * Math.atan(flatSunDiameterKm(altitudeKm) / 2 / slant) * RAD;
}

/** Earth radius inferred from two noon shadow angles. Same answer for every pair. */
export function globeRadiusFromPairKm(latA, latB, declinationDeg) {
  const arcKm = R_EARTH_KM * Math.abs(latA - latB) * DEG;
  const dTheta = Math.abs(Math.abs(latA - declinationDeg)
    - Math.abs(latB - declinationDeg)) * DEG;
  return arcKm / dTheta;
}

/**
 * Sun altitude inferred from the same two shadow angles under the flat model,
 * using the pair to eliminate the unknown subsolar position. Different pairs
 * give different answers — the model contradicts itself.
 */
export function flatSunAltitudeFromPairKm(latA, latB, declinationDeg) {
  const dx = azimuthalEquidistantRadiusKm(latA) - azimuthalEquidistantRadiusKm(latB);
  const dTan = Math.tan(Math.abs(latA - declinationDeg) * DEG)
    - Math.tan(Math.abs(latB - declinationDeg) * DEG);
  return Math.abs(dx / dTan);
}

export function isDaylitGlobe(point, dayOfYear, utcHours) {
  const s = subsolarPoint(dayOfYear, utcHours);
  const cosZenith = Math.sin(point.lat * DEG) * Math.sin(s.lat * DEG)
    + Math.cos(point.lat * DEG) * Math.cos(s.lat * DEG)
    * Math.cos((point.lon - s.lon) * DEG);
  return cosZenith > 0;
}

export function isDaylitFlat(point, dayOfYear, utcHours) {
  const s = subsolarPoint(dayOfYear, utcHours);
  const ro = azimuthalEquidistantRadiusKm(point.lat);
  const rs = azimuthalEquidistantRadiusKm(s.lat);
  const dLon = (point.lon - s.lon) * DEG;
  const d = Math.sqrt(ro * ro + rs * rs - 2 * ro * rs * Math.cos(dLon));
  return d <= FLAT_SPOTLIGHT_RADIUS_KM;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test docs/flat-earth/test/`
Expected: PASS — all geodesy, app-state, and solar tests.

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/js/physics docs/flat-earth/test
git commit -m "feat(flat-earth): solar physics with derived flat-sun parameters"
```

---

## Task 9: Eratosthenes module

**Files:**
- Create: `docs/flat-earth/js/phenomena/eratosthenes.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `globeRadiusFromPairKm`, `flatSunAltitudeFromPairKm`, `solarDeclinationDeg` (Task 8); `makeDisc`/`makeGlobeOcean`/`disposeTree` (Task 6); `createOrbitRig` (Task 4)
- Produces: a module conforming to the Task 7 frozen contract

Three observers on one meridian give two pairs. Two observers would give one
pair and prove nothing — the whole argument is that pairs *disagree*.

- [ ] **Step 1: Add the gnomon primitive**

Append to `docs/flat-earth/js/lib/primitives.js`:

```js
/** Vertical stick plus its cast shadow, for shadow-angle demonstrations. */
export function makeGnomon(heightKm, shadowLengthKm) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(heightKm * 0.04, heightKm * 0.04, heightKm, 8),
    MATERIALS.sail);
  stick.position.y = heightKm / 2;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(heightKm * 0.1, Math.max(1e-6, shadowLengthKm)),
    MATERIALS.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.z = shadowLengthKm / 2;
  g.add(stick, shadow);
  g.userData.setShadow = len => {
    shadow.scale.y = Math.max(1e-6, len) / Math.max(1e-6, shadowLengthKm);
    shadow.position.z = len / 2;
  };
  return g;
}

/** Flat disc of the whole world, radius radiusKm, in the XZ plane. */
export function makeDisc(radiusKm) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radiusKm, 128), MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
```

- [ ] **Step 2: Write the module**

`docs/flat-earth/js/phenomena/eratosthenes.js`:

```js
import * as THREE from 'three';
import { R_EARTH_KM, FLAT_DISC_RADIUS_KM, DEG } from '../physics/constants.js';
import {
  solarDeclinationDeg, globeRadiusFromPairKm, flatSunAltitudeFromPairKm,
} from '../physics/solar.js';
import { azimuthalEquidistantRadiusKm } from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, makeGnomon, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const STICK_KM = 300;   // exaggerated so the shadow is visible at world scale

let flatRoot, globeRoot, flatRig, globeRig, flatGnomons, globeGnomons;

const shadowLength = (stickKm, zenithDeg) => stickKm * Math.tan(zenithDeg * DEG);

export default {
  id: 'eratosthenes',
  title: 'Eratosthenes: Shadow Angles',
  claim: 'Shadow angles are explained by a small, nearby sun above a flat Earth.',

  controls: [
    { id: 'latA', label: 'Observer A', min: 5, max: 40, step: 1, unit: '°N' },
    { id: 'latB', label: 'Observer B', min: 41, max: 55, step: 1, unit: '°N' },
    { id: 'latC', label: 'Observer C', min: 56, max: 80, step: 1, unit: '°N' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { latA: 30, latB: 45, latC: 60, dayOfYear: 81 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));

    flatGnomons = [];
    globeGnomons = [];
    for (let i = 0; i < 3; i += 1) {
      const f = makeGnomon(STICK_KM, STICK_KM);
      const g = makeGnomon(STICK_KM, STICK_KM);
      flatGnomons.push(f); globeGnomons.push(g);
      flatRoot.add(f); globeRoot.add(g);
    }

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.6, far: 1e6 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 3.2, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const decl = solarDeclinationDeg(state.dayOfYear);
    const lats = [state.latA, state.latB, state.latC];

    lats.forEach((lat, i) => {
      const zenith = Math.abs(lat - decl);
      const len = shadowLength(STICK_KM, zenith);

      // Flat pane: observers laid out along the AE radius from the disc centre.
      const r = azimuthalEquidistantRadiusKm(lat);
      flatGnomons[i].position.set(0, 0, r);
      flatGnomons[i].userData.setShadow(len);

      // Globe pane: observers on the surface, sticks along the local vertical.
      const phi = lat * DEG;
      const pos = new THREE.Vector3(
        0, R_EARTH_KM * Math.sin(phi), R_EARTH_KM * Math.cos(phi));
      globeGnomons[i].position.copy(pos);
      globeGnomons[i].lookAt(pos.clone().multiplyScalar(2));
      globeGnomons[i].rotateX(Math.PI / 2);
      globeGnomons[i].userData.setShadow(len);
    });
  },

  readout(state) {
    const decl = solarDeclinationDeg(state.dayOfYear);
    const rAB = globeRadiusFromPairKm(state.latA, state.latB, decl);
    const rBC = globeRadiusFromPairKm(state.latB, state.latC, decl);
    const hAB = flatSunAltitudeFromPairKm(state.latA, state.latB, decl);
    const hBC = flatSunAltitudeFromPairKm(state.latB, state.latC, decl);
    const spread = 100 * Math.abs(hAB - hBC) / Math.max(hAB, hBC);

    return {
      flat: [
        { label: 'Sun altitude from A·B', value: `${hAB.toFixed(0)} km` },
        { label: 'Sun altitude from B·C', value: `${hBC.toFixed(0)} km` },
        { label: 'Disagreement', value: `${spread.toFixed(0)}%` },
      ],
      globe: [
        { label: 'Earth radius from A·B', value: `${rAB.toFixed(0)} km` },
        { label: 'Earth radius from B·C', value: `${rBC.toFixed(0)} km` },
        { label: 'Disagreement', value: '0%' },
      ],
      observed:
        'Every pair of observers yields the same Earth radius, 6371 km. The flat ' +
        'model must infer a different sun altitude from each pair, so it ' +
        'contradicts itself before it ever contradicts the globe.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatGnomons = globeGnomons = null;
  },
};
```

- [ ] **Step 3: Register it**

`docs/flat-earth/js/registry.js`:

```js
import horizon from './phenomena/horizon.js';
import eratosthenes from './phenomena/eratosthenes.js';

export const MODULES = [horizon, eratosthenes];

export const getModule = id => MODULES.find(m => m.id === id) ?? MODULES[0];
```

- [ ] **Step 4: Verify**

Load the page, select "Eratosthenes: Shadow Angles". Confirm: three sticks with
shadows in each pane; globe readout shows `6371 km` twice and `0%`; flat readout
shows two different altitudes and a disagreement above 20%; moving any latitude
slider changes both panes and both readouts.

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): Eratosthenes module showing flat-model self-contradiction"
```

---

## Task 10: Midnight sun module

**Files:**
- Create: `docs/flat-earth/js/phenomena/midnight-sun.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `dayLengthHours`, `flatDayLengthHours`, `solarDeclinationDeg` (Task 8); primitives and rig as before
- Produces: a module conforming to the frozen contract

**Defaults matter here.** The module opens on **70°S in December**, because that
is where the flat model fails. At 70°N in June the flat model gets the right
answer, and the module says so in the readout rather than hiding it. Presenting
the northern case as the failure would be wrong on the physics.

- [ ] **Step 1: Add the sun primitive**

Append to `docs/flat-earth/js/lib/primitives.js`:

```js
/** Emissive sun sphere of the given diameter. */
export function makeSun(diameterKm) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(diameterKm / 2, 32, 24), MATERIALS.sunGlow);
}
```

- [ ] **Step 2: Write the module**

`docs/flat-earth/js/phenomena/midnight-sun.js`:

```js
import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SUN_ALTITUDE_KM, DEG,
} from '../physics/constants.js';
import {
  solarDeclinationDeg, dayLengthHours, flatDayLengthHours,
} from '../physics/solar.js';
import { azimuthalEquidistantRadiusKm } from '../physics/geodesy.js';
import {
  makeDisc, makeGlobeOcean, makeSun, makeObserverMarker, disposeTree,
} from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const SUN_DRAW_KM = 800;   // drawn oversized so it is visible at world scale

let flatRoot, globeRoot, flatRig, globeRig, flatSun, globeSun, flatObs, globeObs;
let clock = 0;

export default {
  id: 'midnight-sun',
  title: 'Midnight Sun',
  claim: 'A sun circling above the disc explains 24-hour daylight at the poles.',

  controls: [
    { id: 'latDeg', label: 'Observer latitude', min: -85, max: 85, step: 1, unit: '°' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  // Opens on the Antarctic summer — the case the flat model cannot produce.
  defaults: { latDeg: -70, dayOfYear: 355 },

  // Linked: the rigs sit at different distances, but orbit() propagates angle
  // deltas rather than absolute positions, so linking works across scales.
  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    flatSun = makeSun(SUN_DRAW_KM);
    flatObs = makeObserverMarker();
    flatObs.scale.setScalar(600);
    flatRoot.add(flatSun, flatObs);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    globeSun = makeSun(SUN_DRAW_KM * 4);
    globeObs = makeObserverMarker();
    globeObs.scale.setScalar(600);
    globeRoot.add(globeSun, globeObs);

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.8, far: 1e6, polar: 0.9 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 4, far: 1e6, polar: 1.2 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state, dt) {
    clock = (clock + dt * 0.15) % 1;              // one full day per ~6.7 s
    const hourAngle = clock * Math.PI * 2;
    const decl = solarDeclinationDeg(state.dayOfYear);

    // Flat pane: sun circles above the disc at the subsolar AE radius.
    const rSun = azimuthalEquidistantRadiusKm(decl);
    flatSun.position.set(
      rSun * Math.sin(hourAngle), FLAT_SUN_ALTITUDE_KM, rSun * Math.cos(hourAngle));
    const rObs = azimuthalEquidistantRadiusKm(state.latDeg);
    flatObs.position.set(0, 0, rObs);

    // Globe pane: sun far away along the declination direction, observer on
    // the surface at the chosen latitude.
    const d = decl * DEG;
    const far = R_EARTH_KM * 12;
    globeSun.position.set(
      far * Math.cos(d) * Math.sin(hourAngle),
      far * Math.sin(d),
      far * Math.cos(d) * Math.cos(hourAngle));
    const phi = state.latDeg * DEG;
    globeObs.position.set(0, R_EARTH_KM * Math.sin(phi), R_EARTH_KM * Math.cos(phi));
  },

  readout(state) {
    const globeHours = dayLengthHours(state.latDeg, state.dayOfYear);
    const flatHours = flatDayLengthHours(state.latDeg, state.dayOfYear);
    const agrees = Math.abs(globeHours - flatHours) < 0.5;

    return {
      flat: [
        { label: 'Daylight', value: `${flatHours.toFixed(1)} h` },
        { label: 'Matches observation', value: agrees ? 'yes' : 'no' },
      ],
      globe: [
        { label: 'Daylight', value: `${globeHours.toFixed(1)} h` },
        { label: 'Matches observation', value: 'yes' },
      ],
      observed: agrees
        ? 'At this latitude and date the flat model happens to agree. Its spotlight '
          + 'covers the whole northern region, so it reproduces the Arctic midnight '
          + 'sun. Set the latitude to -70° in December to see where it fails.'
        : `Observed daylight here is ${globeHours.toFixed(1)} h. The flat model `
          + `predicts ${flatHours.toFixed(1)} h, because a sun circling above a disc `
          + 'must move away from the southern rim and set.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = null;
    flatSun = globeSun = flatObs = globeObs = null;
    clock = 0;
  },
};
```

- [ ] **Step 3: Register it**

Add `import midnightSun from './phenomena/midnight-sun.js';` and append
`midnightSun` to the `MODULES` array.

- [ ] **Step 4: Verify**

Select "Midnight Sun". Confirm the defaults show flat `7.0 h` against globe
`24.0 h` and "Matches observation: no". Then set latitude to `70` and day to
`172` and confirm both read `24.0 h` with the honest "happens to agree" text.
Confirm the sun animates a circuit in both panes.

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): midnight sun module defaulting to the Antarctic case"
```

---

## Task 11: Sun angular size module

**Files:**
- Create: `docs/flat-earth/js/phenomena/sun-size.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `solarAngularDiameterDeg`, `flatSunAngularDiameterDeg`, `flatSunDiameterKm`, `solarDeclinationDeg` (Task 8)
- Produces: a module conforming to the frozen contract

- [ ] **Step 1: Write the module**

`docs/flat-earth/js/phenomena/sun-size.js`:

```js
import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SUN_ALTITUDE_KM,
} from '../physics/constants.js';
import {
  solarAngularDiameterDeg, flatSunAngularDiameterDeg, flatSunDiameterKm,
  solarDeclinationDeg,
} from '../physics/solar.js';
import { makeDisc, makeGlobeOcean, makeSun, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

// Ground distance from the observer to the subsolar point, as a function of
// hour angle. At hour 12 the sun is overhead; at 0 and 24 it is farthest.
const groundDistanceKm = hour =>
  Math.abs(hour - 12) / 12 * FLAT_DISC_RADIUS_KM * 0.5;

let flatRoot, globeRoot, flatRig, globeRig, flatSun, globeSun;

export default {
  id: 'sun-size',
  title: 'Apparent Size of the Sun',
  claim: 'The sun is small and nearby, about 5000 km above the disc.',

  controls: [
    { id: 'hour', label: 'Local hour', min: 0, max: 24, step: 0.25, unit: 'h' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { hour: 12, dayOfYear: 81 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    flatSun = makeSun(flatSunDiameterKm() * 40);   // drawn 40x for visibility
    flatRoot.add(flatSun);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    globeSun = makeSun(R_EARTH_KM * 0.8);
    globeRoot.add(globeSun);

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.4, far: 1e7 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 5, far: 1e7 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const ground = groundDistanceKm(state.hour);
    flatSun.position.set(ground, FLAT_SUN_ALTITUDE_KM, 0);

    const decl = solarDeclinationDeg(state.dayOfYear);
    const angle = (state.hour / 24) * Math.PI * 2;
    const far = R_EARTH_KM * 20;
    globeSun.position.set(far * Math.sin(angle), far * Math.sin(decl * Math.PI / 180),
      far * Math.cos(angle));
  },

  readout(state) {
    const ground = groundDistanceKm(state.hour);
    const globeDeg = solarAngularDiameterDeg(state.dayOfYear);
    const flatDeg = flatSunAngularDiameterDeg(ground);
    const flatNoon = flatSunAngularDiameterDeg(0);

    return {
      flat: [
        { label: 'Angular diameter', value: `${flatDeg.toFixed(3)}°` },
        { label: 'Relative to noon', value: `${(100 * flatDeg / flatNoon).toFixed(0)}%` },
        { label: 'Sun diameter (derived)', value: `${flatSunDiameterKm().toFixed(1)} km` },
      ],
      globe: [
        { label: 'Angular diameter', value: `${globeDeg.toFixed(3)}°` },
        { label: 'Relative to noon', value: '100%' },
        { label: 'Distance', value: '≈150 million km' },
      ],
      observed:
        'The sun measures 0.52°–0.54° all day, every day. The flat model\'s sun is '
        + 'sized here to match exactly at noon — its best case — and still has to '
        + 'shrink by more than half by evening, and never actually set.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatSun = globeSun = null;
  },
};
```

- [ ] **Step 2: Register it**

Add the import and append `sunSize` to `MODULES`.

- [ ] **Step 3: Verify**

Select "Apparent Size of the Sun". At hour 12, both panes read ≈`0.533°` and
`100%`. Drag the hour toward 0 and confirm the flat figure falls below half
while the globe figure holds steady.

- [ ] **Step 4: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): apparent solar size module"
```

---

# Phase 3 — Eclipse and sky group

## Task 12: Eclipse and sky physics

**Files:**
- Create: `docs/flat-earth/js/physics/eclipse.js`
- Create: `docs/flat-earth/js/physics/sky.js`
- Test: `docs/flat-earth/test/eclipse.test.js`
- Test: `docs/flat-earth/test/sky.test.js`

**Interfaces:**
- Consumes: `R_EARTH_KM`, `DEG` (Task 2)
- Produces, from `eclipse.js`:
  - `sphereShadowAxesKm(orientationDeg) -> { a, b }`
  - `discShadowAxesKm(orientationDeg) -> { a, b }`
  - `shadowEdgeCurvaturePerKm({ a, b }) -> number`
- Produces, from `sky.js`:
  - `celestialPoleAltitudeDeg(latDeg) -> deg`
  - `skyRotationGlobe(latDeg) -> 'CW' | 'CCW' | 'NONE'`
  - `skyRotationFlat(latDeg) -> 'CW' | 'CCW'`
  - `poleStarName(latDeg) -> string`

- [ ] **Step 1: Write the failing tests**

`docs/flat-earth/test/eclipse.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sphereShadowAxesKm, discShadowAxesKm, shadowEdgeCurvaturePerKm,
} from '../js/physics/eclipse.js';

test('a sphere casts the same circular shadow from every orientation', () => {
  const c0 = shadowEdgeCurvaturePerKm(sphereShadowAxesKm(0));
  for (const o of [15, 45, 80, 120]) {
    assert.equal(shadowEdgeCurvaturePerKm(sphereShadowAxesKm(o)), c0);
  }
});

test('a disc shadow degenerates as it turns edge-on', () => {
  const face = discShadowAxesKm(0);
  const edge = discShadowAxesKm(80);
  assert.equal(face.a, face.b);            // circular only when face-on
  assert.ok(edge.b < edge.a / 5);
});

test('disc shadow curvature varies by more than an order of magnitude', () => {
  const ratio = shadowEdgeCurvaturePerKm(discShadowAxesKm(80))
    / shadowEdgeCurvaturePerKm(discShadowAxesKm(0));
  assert.ok(ratio > 10, `expected >10x variation, got ${ratio}`);
});
```

`docs/flat-earth/test/sky.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  celestialPoleAltitudeDeg, skyRotationGlobe, skyRotationFlat, poleStarName,
} from '../js/physics/sky.js';

test('pole altitude equals the observer latitude', () => {
  assert.equal(celestialPoleAltitudeDeg(40), 40);
  assert.equal(celestialPoleAltitudeDeg(-40), 40);
});

test('the globe turns the sky opposite ways in the two hemispheres', () => {
  assert.equal(skyRotationGlobe(40), 'CCW');
  assert.equal(skyRotationGlobe(-40), 'CW');
});

test('the flat model has one sky, so one rotation direction everywhere', () => {
  assert.equal(skyRotationFlat(40), 'CCW');
  assert.equal(skyRotationFlat(-40), 'CCW');
});

test('each hemisphere has its own pole star', () => {
  assert.equal(poleStarName(40), 'Polaris');
  assert.equal(poleStarName(-40), 'Sigma Octantis');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test docs/flat-earth/test/eclipse.test.js docs/flat-earth/test/sky.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

`docs/flat-earth/js/physics/eclipse.js`:

```js
import { R_EARTH_KM, DEG } from './constants.js';

/** A sphere's shadow cross-section: a circle, whatever the orientation. */
export function sphereShadowAxesKm() {
  return { a: R_EARTH_KM, b: R_EARTH_KM };
}

/**
 * A disc's shadow cross-section: an ellipse whose minor axis collapses with
 * cos(orientation). Circular only when the disc faces the sun square-on.
 */
export function discShadowAxesKm(orientationDeg) {
  return { a: R_EARTH_KM, b: R_EARTH_KM * Math.abs(Math.cos(orientationDeg * DEG)) };
}

/** Curvature at the end of the major axis of an ellipse: a / b². */
export function shadowEdgeCurvaturePerKm({ a, b }) {
  if (b === 0) return Infinity;
  return a / (b * b);
}
```

`docs/flat-earth/js/physics/sky.js`:

```js
/** Altitude of the visible celestial pole equals |latitude|. */
export const celestialPoleAltitudeDeg = latDeg => Math.abs(latDeg);

/**
 * On a globe the sky turns counter-clockwise about Polaris in the north and
 * clockwise about Sigma Octantis in the south. On the equator neither pole
 * dominates.
 */
export function skyRotationGlobe(latDeg) {
  if (latDeg > 0) return 'CCW';
  if (latDeg < 0) return 'CW';
  return 'NONE';
}

/**
 * The flat model has a single dome pivoting on the disc's centre, so every
 * observer everywhere sees the same rotation direction. This is the failure:
 * southern observers demonstrably see the opposite.
 */
export const skyRotationFlat = () => 'CCW';

export const poleStarName = latDeg => (latDeg >= 0 ? 'Polaris' : 'Sigma Octantis');
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test docs/flat-earth/test/`
Expected: PASS — all suites.

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth/js/physics docs/flat-earth/test
git commit -m "feat(flat-earth): eclipse shadow and sky rotation physics"
```

---

## Task 13: Lunar eclipse module

**Files:**
- Create: `docs/flat-earth/js/phenomena/lunar-eclipse.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `sphereShadowAxesKm`, `discShadowAxesKm`, `shadowEdgeCurvaturePerKm` (Task 12)
- Produces: a module conforming to the frozen contract

- [ ] **Step 1: Write the module**

`docs/flat-earth/js/phenomena/lunar-eclipse.js`:

```js
import * as THREE from 'three';
import { R_EARTH_KM, DEG } from '../physics/constants.js';
import {
  sphereShadowAxesKm, discShadowAxesKm, shadowEdgeCurvaturePerKm,
} from '../physics/eclipse.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { MATERIALS } from '../lib/materials.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const MOON_RADIUS_KM = 1737;

let flatRoot, globeRoot, flatRig, globeRig;
let flatMoon, globeMoon, flatShadow, globeShadow, flatEarth;

function makeMoon() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS_KM, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 1 }));
}

/** Flat ellipse standing in front of the moon, representing the cast shadow. */
function makeShadowEllipse() {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(MOON_RADIUS_KM * 1.4, 96),
    MATERIALS.shadow);
  mesh.position.z = MOON_RADIUS_KM * 1.05;
  return mesh;
}

export default {
  id: 'lunar-eclipse',
  title: 'Shape of the Eclipse Shadow',
  claim: 'The shadow on the moon is cast by the flat disc of the Earth.',

  controls: [
    { id: 'orientationDeg', label: 'Disc orientation', min: 0, max: 85, step: 1, unit: '°' },
    { id: 'progress', label: 'Eclipse progress', min: -1.4, max: 1.4, step: 0.05, unit: '' },
  ],
  defaults: { orientationDeg: 55, progress: 0 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatEarth = makeDisc(R_EARTH_KM);
    flatEarth.position.set(0, 0, -R_EARTH_KM * 4);
    flatMoon = makeMoon();
    flatShadow = makeShadowEllipse();
    flatMoon.add(flatShadow);
    flatRoot.add(flatEarth, flatMoon);

    globeRoot = new THREE.Group();
    const globeEarth = makeGlobeOcean(R_EARTH_KM);
    globeEarth.position.set(0, 0, -R_EARTH_KM * 4);
    globeMoon = makeMoon();
    globeShadow = makeShadowEllipse();
    globeMoon.add(globeShadow);
    globeRoot.add(globeEarth, globeMoon);

    flatRig = createOrbitRig({ distance: R_EARTH_KM * 9, far: 1e6 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 9, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    flatEarth.rotation.x = -Math.PI / 2 + state.orientationDeg * DEG;

    const disc = discShadowAxesKm(state.orientationDeg);
    const sphere = sphereShadowAxesKm();
    const norm = axes => ({ x: axes.a / R_EARTH_KM, y: axes.b / R_EARTH_KM });

    const f = norm(disc), g = norm(sphere);
    flatShadow.scale.set(f.x, Math.max(0.02, f.y), 1);
    globeShadow.scale.set(g.x, g.y, 1);

    const offset = state.progress * MOON_RADIUS_KM * 2;
    flatShadow.position.x = offset;
    globeShadow.position.x = offset;
  },

  readout(state) {
    const disc = discShadowAxesKm(state.orientationDeg);
    const sphere = sphereShadowAxesKm();
    const cDisc = shadowEdgeCurvaturePerKm(disc);
    const cSphere = shadowEdgeCurvaturePerKm(sphere);
    const cDiscFace = shadowEdgeCurvaturePerKm(discShadowAxesKm(0));

    return {
      flat: [
        { label: 'Shadow minor axis', value: `${disc.b.toFixed(0)} km` },
        { label: 'Edge curvature', value: `${cDisc.toExponential(2)} /km` },
        { label: 'Change vs face-on', value: `${(cDisc / cDiscFace).toFixed(1)}×` },
      ],
      globe: [
        { label: 'Shadow minor axis', value: `${sphere.b.toFixed(0)} km` },
        { label: 'Edge curvature', value: `${cSphere.toExponential(2)} /km` },
        { label: 'Change vs face-on', value: '1.0×' },
      ],
      observed:
        'Every lunar eclipse ever recorded shows the same circular shadow edge, '
        + 'from every location and at every angle. A disc produces a circle only '
        + 'when square-on to the sun, and an increasingly flattened ellipse otherwise.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = null;
    flatMoon = globeMoon = flatShadow = globeShadow = flatEarth = null;
  },
};
```

- [ ] **Step 2: Register it**

Add the import and append `lunarEclipse` to `MODULES`.

- [ ] **Step 3: Verify**

Select "Shape of the Eclipse Shadow". At the default 55° the flat pane's shadow
is a visibly flattened ellipse and the globe pane's is circular. Sweeping
orientation to 85° collapses the flat shadow toward a line and drives "Change
vs face-on" above 10×. The globe column never moves off `1.0×`.

- [ ] **Step 4: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): lunar eclipse shadow-shape module"
```

---

## Task 14: Southern stars module

**Files:**
- Create: `docs/flat-earth/js/lib/starfield.js`
- Create: `docs/flat-earth/js/phenomena/southern-stars.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `celestialPoleAltitudeDeg`, `skyRotationGlobe`, `skyRotationFlat`, `poleStarName` (Task 12)
- Produces: `makeStarSphere(count, radius)` from `starfield.js`; a module conforming to the frozen contract

- [ ] **Step 1: Write the starfield**

`docs/flat-earth/js/lib/starfield.js`:

```js
import * as THREE from 'three';
import { MATERIALS } from './materials.js';

/**
 * Deterministic star sphere. Uses a fixed-seed LCG rather than Math.random so
 * the sky is identical on every load — a demo that reshuffles its stars between
 * runs looks broken.
 */
export function makeStarSphere(count = 1400, radius = 1000) {
  let seed = 20260802;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * r * Math.cos(theta);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * r * Math.sin(theta);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, MATERIALS.starPoint);
}
```

- [ ] **Step 2: Write the module**

`docs/flat-earth/js/phenomena/southern-stars.js`:

```js
import * as THREE from 'three';
import { DEG } from '../physics/constants.js';
import {
  celestialPoleAltitudeDeg, skyRotationGlobe, skyRotationFlat, poleStarName,
} from '../physics/sky.js';
import { makeStarSphere } from '../lib/starfield.js';
import { disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

let flatRoot, globeRoot, flatRig, globeRig, flatStars, globeStars;
let spin = 0;

export default {
  id: 'southern-stars',
  title: 'Rotation of the Night Sky',
  claim: 'One dome of stars turns above the disc, the same way for everyone.',

  controls: [
    { id: 'latDeg', label: 'Observer latitude', min: -80, max: 80, step: 1, unit: '°' },
  ],
  defaults: { latDeg: -35 },

  // Each pane is an observer-local sky whose orientation is the thing being
  // compared, so linking the cameras would hide the very difference on show.
  linkCameras: false,

  build() {
    flatRoot = new THREE.Group();
    flatStars = makeStarSphere();
    flatRoot.add(flatStars);

    globeRoot = new THREE.Group();
    globeStars = makeStarSphere();
    globeRoot.add(globeStars);

    flatRig = createOrbitRig({ distance: 1, far: 4000, fov: 70 });
    globeRig = createOrbitRig({ distance: 1, far: 4000, fov: 70 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state, dt) {
    spin += dt * 0.25;
    const tilt = (90 - Math.abs(state.latDeg)) * DEG;

    // Flat: one dome, always pivoting about the disc's centre, so the tilt is
    // fixed to the northern pole regardless of where the observer stands.
    flatStars.rotation.set(0, 0, 0);
    flatStars.rotateZ((90 - state.latDeg) * DEG);
    flatStars.rotateY(spin);

    // Globe: the pole the observer sees flips with hemisphere, and so does the
    // apparent rotation direction.
    const south = state.latDeg < 0;
    globeStars.rotation.set(0, 0, 0);
    globeStars.rotateZ(south ? -tilt : tilt);
    globeStars.rotateY(south ? -spin : spin);
  },

  readout(state) {
    const alt = celestialPoleAltitudeDeg(state.latDeg);
    return {
      flat: [
        { label: 'Rotation direction', value: skyRotationFlat(state.latDeg) },
        { label: 'Pivot', value: 'Disc centre (Polaris)' },
        { label: 'Southern circumpolar stars', value: 'not possible' },
      ],
      globe: [
        { label: 'Rotation direction', value: skyRotationGlobe(state.latDeg) },
        { label: 'Pole star', value: poleStarName(state.latDeg) },
        { label: 'Pole altitude', value: `${alt.toFixed(0)}°` },
      ],
      observed:
        'Southern observers see the sky turn clockwise about Sigma Octantis, '
        + 'opposite to the north. A single dome pivoting on one point cannot turn '
        + 'both ways at once, whatever its size.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatStars = globeStars = null;
    spin = 0;
  },
};
```

- [ ] **Step 3: Register it**

Add the import and append `southernStars` to `MODULES`.

- [ ] **Step 4: Verify**

Select "Rotation of the Night Sky". At the default −35° the globe column reads
`CW` / `Sigma Octantis` / `35°` and the flat column reads `CCW`. Slide latitude
to +35 and confirm the globe column flips to `CCW` / `Polaris` while the flat
column does not change. Both skies visibly rotate.

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): night sky rotation module"
```

---

# Phase 4 — Map group

## Task 15: Route geodesy and city data

**Files:**
- Modify: `docs/flat-earth/js/physics/geodesy.js`
- Create: `docs/flat-earth/data/cities.json`
- Test: `docs/flat-earth/test/geodesy.test.js` (extend)

**Interfaces:**
- Consumes: `R_EARTH_KM`, `CRUISE_SPEED_KMH`, `DEG` (Task 2); `azimuthalEquidistantRadiusKm` (Task 8)
- Produces:
  - `greatCircleKm(a, b) -> km` where `a`, `b` are `{ lat, lon }`
  - `azimuthalEquidistantXY(p) -> { x, y }` in km
  - `azimuthalEquidistantKm(a, b) -> km`
  - `flightHours(distanceKm, speedKmh?) -> hours`
  - `data/cities.json` — an array of `{ id, name, lat, lon, utcOffset }`

`utcOffset` is standard time, ignoring daylight saving. The time-zone module
states this on screen so nobody chases a one-hour discrepancy.

- [ ] **Step 1: Write the failing tests**

Append to `docs/flat-earth/test/geodesy.test.js`:

```js
import {
  greatCircleKm, azimuthalEquidistantKm, azimuthalEquidistantXY, flightHours,
} from '../js/physics/geodesy.js';

const SYD = { lat: -33.8688, lon: 151.2093 };
const SCL = { lat: -33.4489, lon: -70.6693 };

test('Sydney to Santiago is about 11347 km on a globe', () => {
  near(greatCircleKm(SYD, SCL), 11346.7, 20, 'great circle SYD-SCL');
});

test('the same pair is about 25684 km on the flat disc map', () => {
  near(azimuthalEquidistantKm(SYD, SCL), 25684.3, 200, 'AE SYD-SCL');
});

test('the flat map more than doubles the route', () => {
  assert.ok(azimuthalEquidistantKm(SYD, SCL) > 2 * greatCircleKm(SYD, SCL));
});

test('flight time follows from distance and cruise speed', () => {
  near(flightHours(11346.7), 12.61, 0.02, 'globe hours');
  near(flightHours(25684.3), 28.54, 0.02, 'flat hours');
});

test('the north pole sits at the centre of the disc map', () => {
  const p = azimuthalEquidistantXY({ lat: 90, lon: 0 });
  near(Math.hypot(p.x, p.y), 0, 1e-6, 'pole radius');
});

test('a point is zero distance from itself under both metrics', () => {
  assert.equal(greatCircleKm(SYD, SYD), 0);
  near(azimuthalEquidistantKm(SYD, SYD), 0, 1e-6, 'AE self distance');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test docs/flat-earth/test/geodesy.test.js`
Expected: FAIL — `greatCircleKm is not exported`.

- [ ] **Step 3: Extend geodesy.js**

Append to `docs/flat-earth/js/physics/geodesy.js`.

**First consolidate the imports.** Tasks 2 and 8 each added their own
`import … from './constants.js'` line; this task would add a third. Replace all
of them with one line at the top of the file:

```js
import { R_EARTH_KM, CRUISE_SPEED_KMH, DEG } from './constants.js';
```

Then append:

```js
/** Shortest surface distance between two points on a sphere. */
export function greatCircleKm(a, b) {
  const p1 = a.lat * DEG, p2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return R_EARTH_KM * Math.acos(clamp(c, -1, 1));
}

/** Position on the north-polar azimuthal equidistant map, in km from centre. */
export function azimuthalEquidistantXY(p) {
  const r = azimuthalEquidistantRadiusKm(p.lat);
  const t = p.lon * DEG;
  return { x: r * Math.sin(t), y: r * Math.cos(t) };
}

/** Straight-line distance across the flat disc map. */
export function azimuthalEquidistantKm(a, b) {
  const p = azimuthalEquidistantXY(a), q = azimuthalEquidistantXY(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

export function flightHours(distanceKm, speedKmh = CRUISE_SPEED_KMH) {
  return distanceKm / speedKmh;
}
```

- [ ] **Step 4: Write the city data**

`docs/flat-earth/data/cities.json`:

```json
[
  { "id": "syd", "name": "Sydney",       "lat": -33.8688, "lon": 151.2093,  "utcOffset": 10 },
  { "id": "scl", "name": "Santiago",     "lat": -33.4489, "lon": -70.6693,  "utcOffset": -4 },
  { "id": "jnb", "name": "Johannesburg", "lat": -26.1367, "lon": 28.2411,   "utcOffset": 2 },
  { "id": "per", "name": "Perth",        "lat": -31.9403, "lon": 115.9669,  "utcOffset": 8 },
  { "id": "lhr", "name": "London",       "lat": 51.5074,  "lon": -0.1278,   "utcOffset": 0 },
  { "id": "nyc", "name": "New York",     "lat": 40.7128,  "lon": -74.0060,  "utcOffset": -5 },
  { "id": "lax", "name": "Los Angeles",  "lat": 34.0522,  "lon": -118.2437, "utcOffset": -8 },
  { "id": "tyo", "name": "Tokyo",        "lat": 35.6762,  "lon": 139.6503,  "utcOffset": 9 },
  { "id": "rkv", "name": "Reykjavik",    "lat": 64.1466,  "lon": -21.9426,  "utcOffset": 0 },
  { "id": "mcm", "name": "McMurdo",      "lat": -77.8419, "lon": 166.6863,  "utcOffset": 13 }
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test docs/flat-earth/test/`
Expected: PASS — all suites.

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth/js/physics docs/flat-earth/data docs/flat-earth/test
git commit -m "feat(flat-earth): route geodesy and city fixtures"
```

---

## Task 16: Flight routes module

**Files:**
- Create: `docs/flat-earth/js/phenomena/flight-routes.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `greatCircleKm`, `azimuthalEquidistantKm`, `azimuthalEquidistantXY`, `flightHours` (Task 15); `cities.json`
- Produces: a module conforming to the frozen contract

This is the first module that loads external data, so it is also the first that
can fail at `build()` time. It throws a descriptive error, which `main.js`
catches into a pane error card.

- [ ] **Step 1: Write the module**

`docs/flat-earth/js/phenomena/flight-routes.js`:

```js
import * as THREE from 'three';
import { R_EARTH_KM, FLAT_DISC_RADIUS_KM, DEG } from '../physics/constants.js';
import {
  greatCircleKm, azimuthalEquidistantKm, azimuthalEquidistantXY, flightHours,
} from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const ROUTES = [
  { id: 'syd-scl', from: 'syd', to: 'scl', scheduledHours: 12.6 },
  { id: 'jnb-per', from: 'jnb', to: 'per', scheduledHours: 9.5 },
  { id: 'scl-per', from: 'scl', to: 'per', scheduledHours: 14.5 },
];

let cities = null;
let flatRoot, globeRoot, flatRig, globeRig, flatLine, globeLine;

const byId = id => {
  const c = cities?.find(x => x.id === id);
  if (!c) throw new Error(`Unknown city id "${id}"`);
  return c;
};

const route = id => ROUTES.find(r => r.id === id) ?? ROUTES[0];

function latLonToVec3(p, radius) {
  const phi = p.lat * DEG, lam = p.lon * DEG;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(lam),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lam));
}

function makeLine(points, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
}

export default {
  id: 'flight-routes',
  title: 'Southern Hemisphere Flight Routes',
  claim: 'Long southern flights are consistent with the standard flat map.',

  controls: [{
    id: 'routeId', label: 'Route', options: ROUTES.map(r => ({
      value: r.id, label: r.id.toUpperCase().replace('-', ' → '),
    })),
  }],
  defaults: { routeId: 'syd-scl' },

  // A disc map and a globe are not at the same scale; linking would be nonsense.
  linkCameras: false,

  async load() {
    const res = await fetch('./data/cities.json');
    if (!res.ok) throw new Error(`cities.json returned HTTP ${res.status}`);
    cities = await res.json();
  },

  build() {
    if (!cities) throw new Error('City data was not loaded');

    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.7, far: 1e6, polar: 0.4 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 3.5, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const r = route(state.routeId);
    const a = byId(r.from), b = byId(r.to);

    if (flatLine) { flatRoot.remove(flatLine); flatLine.geometry.dispose(); }
    if (globeLine) { globeRoot.remove(globeLine); globeLine.geometry.dispose(); }

    // Flat: a straight line across the disc, which is what the map implies.
    const pa = azimuthalEquidistantXY(a), pb = azimuthalEquidistantXY(b);
    flatLine = makeLine([
      new THREE.Vector3(pa.x, 50, pa.y),
      new THREE.Vector3(pb.x, 50, pb.y),
    ], 0xe0a33e);
    flatRoot.add(flatLine);

    // Globe: the great circle, sampled.
    const va = latLonToVec3(a, R_EARTH_KM), vb = latLonToVec3(b, R_EARTH_KM);
    const pts = [];
    for (let i = 0; i <= 64; i += 1) {
      pts.push(new THREE.Vector3().copy(va).lerp(vb, i / 64)
        .normalize().multiplyScalar(R_EARTH_KM * 1.005));
    }
    globeLine = makeLine(pts, 0xe0a33e);
    globeRoot.add(globeLine);
  },

  readout(state) {
    const r = route(state.routeId);
    const a = byId(r.from), b = byId(r.to);
    const gc = greatCircleKm(a, b);
    const ae = azimuthalEquidistantKm(a, b);

    return {
      flat: [
        { label: 'Distance', value: `${ae.toFixed(0)} km` },
        { label: 'Implied flight time', value: `${flightHours(ae).toFixed(1)} h` },
        { label: 'Versus schedule', value: `${(flightHours(ae) / r.scheduledHours).toFixed(1)}×` },
      ],
      globe: [
        { label: 'Distance', value: `${gc.toFixed(0)} km` },
        { label: 'Implied flight time', value: `${flightHours(gc).toFixed(1)} h` },
        { label: 'Versus schedule', value: `${(flightHours(gc) / r.scheduledHours).toFixed(1)}×` },
      ],
      observed:
        `${a.name} to ${b.name} is scheduled at about ${r.scheduledHours} hours and `
        + 'flies non-stop. Times assume a 900 km/h cruise. The flat map demands an '
        + 'aircraft roughly twice as fast as anything in service.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatLine = globeLine = null;
  },
};
```

- [ ] **Step 2: Register it**

Add `import flightRoutes from './phenomena/flight-routes.js';` and append
`flightRoutes` to the `MODULES` array.

No harness change is needed: `main.js` already awaits the optional `load()`
hook, which was added to the contract at the Task 7 gate precisely so this
module would not require reopening it.

- [ ] **Step 3: Verify**

Select "Southern Hemisphere Flight Routes". Confirm SYD → SCL reads globe
`11347 km / 12.6 h` and flat `25684 km / 28.5 h`, with a route line drawn in
both panes. Switch routes and confirm the numbers and lines update.

Then verify the failure path: rename `data/cities.json` temporarily, reload,
select the module, and confirm an error card appears naming the HTTP failure
while the other modules still work. Restore the file.

- [ ] **Step 4: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): flight routes module with async data loading"
```

---

## Task 17: Time zones module

**Files:**
- Create: `docs/flat-earth/js/phenomena/time-zones.js`
- Modify: `docs/flat-earth/js/registry.js`

**Interfaces:**
- Consumes: `isDaylitGlobe`, `isDaylitFlat`, `subsolarPoint` (Task 8); `azimuthalEquidistantXY` (Task 15); `cities.json`
- Produces: a module conforming to the frozen contract

- [ ] **Step 1: Write the module**

`docs/flat-earth/js/phenomena/time-zones.js`:

```js
import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SPOTLIGHT_RADIUS_KM, DEG,
} from '../physics/constants.js';
import { isDaylitGlobe, isDaylitFlat, subsolarPoint } from '../physics/solar.js';
import { azimuthalEquidistantXY } from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { MATERIALS } from '../lib/materials.js';
import { createOrbitRig } from '../lib/camera-rig.js';

let cities = null;
let flatRoot, globeRoot, flatRig, globeRig, spotlight, terminator, cityDots = [];

const localHour = (city, utcHours) => ((utcHours + city.utcOffset) % 24 + 24) % 24;

export default {
  id: 'time-zones',
  title: 'Day and Night Together',
  claim: 'A spotlight sun above the disc explains day and night around the world.',

  controls: [
    { id: 'utcHours', label: 'UTC hour', min: 0, max: 23.5, step: 0.5, unit: 'h' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { utcHours: 0, dayOfYear: 172 },

  linkCameras: false,

  async load() {
    const res = await fetch('./data/cities.json');
    if (!res.ok) throw new Error(`cities.json returned HTTP ${res.status}`);
    cities = await res.json();
  },

  build() {
    if (!cities) throw new Error('City data was not loaded');

    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    spotlight = new THREE.Mesh(
      new THREE.CircleGeometry(FLAT_SPOTLIGHT_RADIUS_KM, 96),
      new THREE.MeshBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.18 }));
    spotlight.rotation.x = -Math.PI / 2;
    spotlight.position.y = 20;
    flatRoot.add(spotlight);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    terminator = new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH_KM * 1.002, 64, 48, 0, Math.PI),
      MATERIALS.shadow);
    globeRoot.add(terminator);

    cityDots = cities.map(() => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(180, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      flatRoot.add(dot);
      return dot;
    });

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.7, far: 1e6, polar: 0.35 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 3.5, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const sub = subsolarPoint(state.dayOfYear, state.utcHours);
    const p = azimuthalEquidistantXY(sub);
    spotlight.position.set(p.x, 20, p.y);

    // The night hemisphere faces away from the subsolar point.
    terminator.rotation.set(0, -(sub.lon + 90) * DEG, 0);

    cities.forEach((c, i) => {
      const q = azimuthalEquidistantXY(c);
      cityDots[i].position.set(q.x, 60, q.y);
      const lit = isDaylitFlat(c, state.dayOfYear, state.utcHours);
      cityDots[i].material.color.set(lit ? 0xffd27f : 0x44506a);
    });
  },

  readout(state) {
    const mismatches = cities.filter(c =>
      isDaylitGlobe(c, state.dayOfYear, state.utcHours)
      !== isDaylitFlat(c, state.dayOfYear, state.utcHours));

    const litFlat = cities.filter(c => isDaylitFlat(c, state.dayOfYear, state.utcHours));
    const litGlobe = cities.filter(c => isDaylitGlobe(c, state.dayOfYear, state.utcHours));

    const sample = mismatches.slice(0, 3)
      .map(c => `${c.name} ${String(Math.floor(localHour(c, state.utcHours))).padStart(2, '0')}:00`)
      .join(', ');

    return {
      flat: [
        { label: 'Cities in daylight', value: `${litFlat.length} of ${cities.length}` },
        { label: 'Wrong for', value: `${mismatches.length} cities` },
        { label: 'Examples', value: sample || 'none' },
      ],
      globe: [
        { label: 'Cities in daylight', value: `${litGlobe.length} of ${cities.length}` },
        { label: 'Wrong for', value: '0 cities' },
        { label: 'Lit fraction', value: 'exactly half the surface' },
      ],
      observed:
        'Exactly half the Earth is lit at any instant, and the boundary is a great '
        + 'circle. The disc\'s spotlight is sized here to light half the map\'s area '
        + 'and still lights places that are demonstrably in the dark. '
        + 'Offsets are standard time; daylight saving is ignored.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    for (const d of cityDots) d.material.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = spotlight = terminator = null;
    cityDots = [];
  },
};
```

- [ ] **Step 2: Register it**

Add the import and append `timeZones` to `MODULES`. The registry now holds all
eight in the order: horizon, eratosthenes, midnight-sun, sun-size,
lunar-eclipse, southern-stars, flight-routes, time-zones.

- [ ] **Step 3: Verify**

Select "Day and Night Together". At the defaults (UTC 0, day 172) confirm the
flat column reads `8 of 10` in daylight and `3 cities` wrong, naming London,
Reykjavik, and McMurdo; the globe column reads `5 of 10` and `0 cities`. Sweep
the UTC hour and confirm the spotlight circles the disc and the mismatch count
changes.

- [ ] **Step 4: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): day and night time zones module"
```

---

# Phase 5 — Hardening

## Task 18: Failure paths, parameters dialog, responsive layout

**Files:**
- Modify: `docs/flat-earth/js/main.js`
- Modify: `docs/flat-earth/index.html`
- Modify: `docs/flat-earth/style.css`
- Create: `docs/flat-earth/js/ui/params-dialog.js`

**Interfaces:**
- Consumes: everything prior
- Produces: `renderParamsDialog(dialogEl, buttonEl)`

- [ ] **Step 1: Write the model-parameters dialog**

`docs/flat-earth/js/ui/params-dialog.js`:

```js
const PARAMS = [
  ['Earth radius (globe model)', '6371 km'],
  ['Axial tilt', '23.44°'],
  ['Flat map projection', 'North-polar azimuthal equidistant'],
  ['Flat disc radius', '20 015 km (pole to −90° rim)'],
  ['Flat sun altitude', '5000 km'],
  ['Flat sun diameter', 'Derived — sized to subtend the observed 0.533° overhead'],
  ['Flat spotlight radius', '14 153 km — lights exactly half the disc by area'],
  ['Cruise speed for flight times', '900 km/h'],
  ['Atmospheric refraction', 'Excluded from all calculations'],
  ['Time zone offsets', 'Standard time; daylight saving ignored'],
];

export function renderParamsDialog(dialogEl, buttonEl) {
  dialogEl.innerHTML = '';

  const h = document.createElement('h2');
  h.textContent = 'MODEL PARAMETERS';

  const note = document.createElement('p');
  note.textContent =
    'The flat model is given its own standard best-case figures. Where a value '
    + 'could be chosen to flatter or hobble it, it is chosen to flatter it.';

  const list = document.createElement('dl');
  for (const [k, v] of PARAMS) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    list.append(dt, dd);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.onclick = () => dialogEl.close();

  dialogEl.append(h, note, list, close);
  buttonEl.onclick = () => dialogEl.showModal();
}
```

- [ ] **Step 2: Wire it and harden WebGL failure in main.js**

In `main.js`, add the import and call it inside `boot()`:

```js
import { renderParamsDialog } from './ui/params-dialog.js';
// …
  renderParamsDialog(document.getElementById('params-dialog'),
    document.getElementById('params-button'));
```

Guard every `viewport` use so a WebGL failure cannot cascade. Replace the
scene-attachment block inside the `try` of `activate()`:

```js
    if (module.load) await module.load();
    if (viewport) {
      built = module.build({ canvas });
      viewport.flatScene.add(built.flat.root);
      viewport.globeScene.add(built.globe.root);
      viewport.setCameras(built.flat.camera, built.globe.camera);
      if (module.linkCameras && built.flat.rig && built.globe.rig) {
        built.flat.rig.setLinked(built.globe.rig);
        built.globe.rig.setLinked(built.flat.rig);
      }
      for (const side of [built.flat, built.globe]) side.rig?.attach(canvas);
      clearErrorCard(canvasError);
    }
```

and guard `teardown()`:

```js
  if (built && viewport) {
    viewport.flatScene.remove(built.flat.root);
    viewport.globeScene.remove(built.globe.root);
  }
```

- [ ] **Step 3: Add dialog styling**

Append to `docs/flat-earth/style.css`:

```css
#params-dialog { background:var(--bg); color:var(--fg);
                 border:1px solid var(--rule); max-width:34rem; }
#params-dialog h2 { font-size:.8rem; letter-spacing:.16em; }
#params-dialog dl { display:grid; grid-template-columns:1fr 1fr; gap:.25rem 1rem; }
#params-dialog dt { color:var(--dim); }
#params-dialog dd { margin:0; }
#params-button { background:none; color:var(--dim);
                 border:1px solid var(--rule); border-radius:50%;
                 width:1.6rem; height:1.6rem; cursor:pointer; }
@media (max-width: 900px) {
  #app-header { flex-wrap:wrap; }
  #params-dialog dl { grid-template-columns:1fr; }
}
```

- [ ] **Step 4: Verify all three failure paths**

1. **WebGL unavailable.** In Chrome DevTools open the Rendering panel and
   disable WebGL, or launch with `--disable-3d-apis`. Reload. Expected: a
   "WebGL unavailable" card, no canvas, and the readout panel still showing
   numbers for every phenomenon as you switch between them.
2. **Missing data.** Rename `data/cities.json`, reload, select
   "Southern Hemisphere Flight Routes". Expected: an error card naming the HTTP
   status; the other six phenomena still render. Restore the file.
3. **Module throws.** Temporarily add `throw new Error('boom');` to the top of
   `horizon.js`'s `build()`. Expected: an error card for horizon only; every
   other phenomenon works. Remove the throw.

- [ ] **Step 5: Verify the responsive layout**

Resize below 900 px. Expected: panes stack vertically with flat on top, the
readout collapses to one column, controls remain usable, and the page body
never scrolls horizontally.

- [ ] **Step 6: Commit**

```bash
git add docs/flat-earth
git commit -m "feat(flat-earth): parameters dialog, WebGL fallback, responsive layout"
```

---

## Task 19: README checklist and final verification

**Files:**
- Modify: `docs/flat-earth/README.md`
- Modify: `docs/index.md` (add a link)

**Interfaces:**
- Consumes: everything prior
- Produces: the finished, documented app

- [ ] **Step 1: Complete the manual visual checklist**

Replace the placeholder checklist section in `docs/flat-earth/README.md`:

```markdown
## Manual visual checklist

Rendering has no headless GL path, so these are checked by hand after any
change to `js/lib/` or `js/phenomena/`.

- [ ] Horizon — hull occludes from the bottom on the globe pane; flat ship only
      shrinks. At 12 km / 2 m: globe 3.8 m hidden, flat 0.0 m.
- [ ] Eratosthenes — three sticks and shadows per pane; globe radius 6371 km
      from both pairs; flat sun altitudes disagree by over 20%.
- [ ] Midnight sun — defaults (−70°, day 355) give flat 7.0 h vs globe 24.0 h.
      At (70°, day 172) both give 24.0 h and the text says so.
- [ ] Sun size — at noon both read ≈0.533°; toward evening the flat figure falls
      below half while the globe figure holds.
- [ ] Lunar eclipse — flat shadow is a flattened ellipse at 55°, collapsing
      toward a line at 85°; globe shadow stays circular.
- [ ] Southern stars — at −35° globe reads CW / Sigma Octantis; flat reads CCW.
      Flipping to +35° changes the globe column only.
- [ ] Flight routes — SYD → SCL reads globe 11347 km / 12.6 h, flat 25684 km /
      28.5 h, with a line drawn in both panes.
- [ ] Time zones — at UTC 0, day 172: flat lights 8 of 10 cities and is wrong
      for 3; globe lights 5 of 10 and is wrong for 0.
- [ ] Camera linking — dragging orbits both panes for horizon, Eratosthenes,
      sun size, and lunar eclipse; independently for the other four.
- [ ] Switching phenomena repeatedly does not slow the app down or double the
      camera drag rate (listener leak check).
- [ ] Below 900 px the panes stack vertically and nothing scrolls sideways.
```

- [ ] **Step 2: Run the full test suite**

Run: `node --test docs/flat-earth/test/`
Expected: PASS, with no skipped suites. Record the count in the commit message.

- [ ] **Step 3: Confirm the Jekyll build publishes the right files**

```bash
cd docs && bundle exec jekyll build 2>/dev/null || echo "(no local Jekyll; check on Pages)"
ls _site/flat-earth/ 2>/dev/null
ls _site/flat-earth/third-party/ 2>/dev/null
ls _site/superpowers 2>/dev/null && echo "ERROR: specs leaked into the site"
ls _site/flat-earth/test 2>/dev/null && echo "ERROR: tests leaked into the site"
```

Expected: `index.html`, `js/`, `data/`, and `third-party/three.module.js`
present; `superpowers` and `flat-earth/test` absent. If Jekyll is not installed
locally, verify the same on the deployed site after merge.

- [ ] **Step 4: Link it from the site index**

In `docs/index.md`, add above the `## > latest posts` heading:

```markdown
## &gt; projects

- [Flat Earth Lab](/flat-earth/) — split-screen simulator comparing flat and
  globe models against observation.
```

- [ ] **Step 5: Commit**

```bash
git add docs/flat-earth/README.md docs/index.md
git commit -m "docs(flat-earth): manual checklist and site link"
```

---

## Deferred

Recorded so they are decisions, not oversights:

- **Atmospheric refraction.** Excluded everywhere; stated in the parameters
  dialog. Adding it would shift the horizon numbers by roughly 8% and needs its
  own tests.
- **A 2D-canvas fallback for the map modules.** Held in reserve per the spec. If
  `flight-routes` had become a projection swamp this was the retreat; it did not,
  so the option stays unused.
- **Real coastline geometry.** Both models render schematic ocean surfaces. Land
  masses would help the map modules read better but need texture assets and
  projection work.
- **CI test job.** The spec put deployment out of scope. If wanted later, one
  workflow running `node --test docs/flat-earth/test/` on PR would fit the
  repo's existing PR-gates theme.
