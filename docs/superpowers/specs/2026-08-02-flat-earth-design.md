# Flat Earth Lab — Design

**Date:** 2026-08-02
**Status:** Approved
**Location:** `docs/flat-earth/`

## Purpose

An interactive split-screen simulator that runs the same physical scenario under
two models of the Earth — a flat disc and a globe — and shows where their
predictions diverge from what we actually observe.

The primary goal is a **demo and portfolio piece**: it must look good and demo
well alongside `src/solar-system-explorer/`. The educational content is the
vehicle that makes it substantial rather than a toy. It ships on the existing
GitHub Pages site at `/flat-earth/`.

On-screen copy is **clinical** — `CLAIM`, `PREDICTION`, `OBSERVED`. The
simulation does the arguing. Any commentary in the site's usual voice belongs in
a blog post linking to the app, not in the app itself.

## Constraints

| Constraint | Decision |
|---|---|
| Stack | Vanilla JS, ES modules, Three.js. No build step, no bundler, no transpiler. |
| Three.js delivery | **Vendored**, pinned copy at `docs/flat-earth/third-party/three.module.js`. Not a CDN. |
| Source location | `docs/flat-earth/` — authored where it is served. Single source of truth. |
| Hosting | GitHub Pages, via the existing Jekyll site in `docs/`. |
| Test runner | `node --test`, standard library only. No npm install. |
| Browser target | Current evergreen desktop browsers with WebGL2. Responsive down to mobile. |

### Why vendored Three.js

The sibling app loads Three.js from a `unpkg` importmap. This app does not. A
portfolio URL that renders a blank page because a CDN had a bad afternoon is the
single worst failure mode available, and ~600 KB in the repo eliminates it
entirely. Pin the version in the README and treat upgrades as deliberate.

The directory is named `third-party/`, **not** `vendor/`. `docs/_config.yml`
already excludes `vendor` from the Jekyll build, and Jekyll's matching on a bare
directory name is ambiguous enough that a nested `flat-earth/vendor/` could be
dropped from the published site — which would take Three.js with it and break
the live app while working perfectly in local testing.

### Why the flat model is steelmanned

The flat model is given its standard best-case parameters, stated openly in an
in-app "model parameters" note:

- North-pole-centered azimuthal equidistant projection
- Sun 5,000 km above the disc, circling above the tropics
- Moon likewise above the disc

The flat sun's **diameter is derived, not asserted**: it is solved so that the
sun subtends the observed 0.53° when directly overhead. (At 5,000 km altitude
that gives ≈46 km.) This matters — quoting a fixed 51 km diameter would make the
flat sun the wrong apparent size even at noon, and the resulting mismatch would
look like a rigged premise. Deriving it hands the model its best case, so the
only thing left to fail is the *change* through the day.

The argument is that the model fails **on its own terms** — most sharply in the
Eratosthenes module, where it contradicts itself rather than contradicting the
globe. Strawmanning would undercut the whole point.

## Architecture

### Runtime shape

`main.js` owns one `WebGLRenderer`, one canvas, and one `requestAnimationFrame`
loop. Each frame renders two scenes into two viewports via the scissor test —
one GL context, not two canvases.

A single central `state` object (a plain object plus a small emitter) is the only
data that flows between UI and simulation. Controls write to it. The active
module reads it. The readout panel renders from it. Modules never reference each
other.

### Layers

```
registry  →  phenomenon modules  →  primitives (Three.js helpers)  →  physics (pure math)
```

`physics/` imports nothing from Three.js and touches no DOM. It is the testable
core; everything above it is rendering. This split is what makes testing possible
at all given the no-build-step constraint.

### File layout

```
docs/flat-earth/
  index.html
  style.css
  package.json              { "type": "module", "private": true } — no dependencies
  README.md
  third-party/
    three.module.js         pinned, vendored — see note on the directory name
  js/
    main.js                 renderer, rAF loop, module lifecycle
    app-state.js            state object + emitter
    viewport.js             dual-viewport scissor rendering
    registry.js             imports and orders the phenomena
    ui/
      selector.js           phenomenon picker
      controls.js           builds controls from module.controls
      readout.js            CLAIM / PREDICTION / OBSERVED panel
      loading.js
    lib/
      primitives.js         makeDisc, makeDome, makeGlobe, makeSun, makeObserver
      materials.js          shared materials
      camera-rig.js         camera construction + optional pane linking
      starfield.js
    physics/
      constants.js          R_EARTH, AU, OBLIQUITY, FLAT_SUN_ALTITUDE, ...
      geodesy.js            great-circle distance, horizon distance,
                            hiddenHeight vs geometricDrop (distinct functions),
                            azimuthal-equidistant projection and disc distance
      solar.js              solar declination, subsolar point, shadow angle,
                            day length, angular diameter
      eclipse.js            shadow-cone geometry, terminator curvature
    phenomena/
      horizon.js            eratosthenes.js    lunar-eclipse.js   southern-stars.js
      flight-routes.js      time-zones.js      midnight-sun.js    sun-size.js
  data/
    cities.json             name, lat, lon, tz for route and time-zone modules
  test/
    geodesy.test.js  solar.test.js  eclipse.test.js
```

### The module contract

This is the one interface that must be right. It is proven against a real scene
(`horizon`) before the other seven are written against it.

```js
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

  build(ctx),      // → { flat: { root, camera }, globe: { root, camera } }
  update(state, dt),
  readout(state),  // → { flat: [Row], globe: [Row], observed: string }
  dispose(),
}

// Row = { label: string, value: string }  — value is preformatted for display,
// including units. Formatting lives in the module, not the readout panel.
```

**Scene ownership.** The harness owns exactly two long-lived `THREE.Scene`
instances. `build()` returns a `root` (a `THREE.Group`) per side, which the
harness adds to its scene and removes on teardown. Modules never construct or
hold a `Scene`.

**`readout(state)` must not depend on `build()` having run.** It reads `state`
and calls the physics layer, nothing else. This is what keeps the numbers
working on the WebGL-unavailable path.

`ctx` provides `THREE`, the primitives library, and shared materials. Modules
build their own camera rigs, because the eight phenomena span roughly nine orders
of magnitude in scale (a ship at 12 km, the Moon at 384,000 km) and cannot share
one world.

`linkCameras: true` means dragging either pane orbits both. Set per module:

| `true` | `false` |
|---|---|
| horizon, eratosthenes, midnight-sun, sun-size, lunar-eclipse | southern-stars, flight-routes, time-zones |

`lunar-eclipse` links because both models view the same Moon at the same
distance. `southern-stars` does not, because each pane is an observer-local sky
view whose orientation is the very thing under comparison.

Switching phenomena calls `dispose()` on the outgoing module, `build()` on the
incoming one, resets `state` to `defaults`, and regenerates the control panel
from `controls`. Adding a ninth phenomenon is one file plus one registry line,
with no changes to any UI code.

## Phenomena

Every module ends in a numeric readout; numbers are what make it read as an
instrument. Values below marked *(computed)* are derived at runtime by the
physics layer from the stated model parameters — they are not hard-coded strings,
and the tests assert them.

### 1. Horizon

- **Controls:** distance 0–40 km, observer eye height 2–30 m
- **Globe:** the hull is occluded from the bottom up past the horizon
- **Flat:** the ship only shrinks by angular size; it is never occluded
- **Readout:** *hidden height* — how much of the ship is below the observer's
  line of sight — for both models. At 12 km with 2 m eye height:
  **≈3.8 m hidden** vs **0 m**
- **Terminology, to avoid an implementation trap:** hidden height is
  `(d − d_horizon)² / 2R`, which is **not** the same as geometric drop
  `d² / 2R` (≈11.3 m at 12 km). The UI reports hidden height, because that is
  what an observer actually sees. `geodesy.js` exposes both under distinct
  names and the tests assert both.
- **Note:** standard atmospheric refraction is excluded; the README states this.

### 2. Eratosthenes

- **Controls:** **three** observer latitudes (A, B, C) on a shared meridian, plus
  day of year. Three observers give two independent pairs — A·B and B·C — which
  is the minimum needed to show inconsistency. Two observers could not.
- **Globe:** both pairs yield the same Earth radius, 6,371 km
- **Flat:** each pair yields a *different* inferred sun altitude — the model is
  self-inconsistent
- **Readout:** globe radius from pair A·B and pair B·C (identical); flat sun
  altitude from pair A·B and pair B·C (divergent) *(computed)*
- This is the strongest module intellectually: the failure is internal.

### 3. Lunar eclipse

- **Controls:** time through the eclipse, disc orientation relative to the sun
- **Globe:** a sphere casts a circular shadow from every orientation
- **Flat:** a disc casts a circular shadow only edge-on; otherwise an ellipse
  degenerating toward a line
- **Readout:** curvature of the shadow edge — constant vs varying *(computed)*

### 4. Southern stars

- **Controls:** observer latitude −90…+90, time of night
- **Globe:** two rotation centers (Polaris, σ Octantis) turning in opposite
  directions
- **Flat:** one sky pivoting about the disc's center; southern circumpolar motion
  is geometrically unavailable
- **Readout:** pole star, rotation direction, and which constellations are up

### 5. Flight routes

- **Controls:** route picker — Sydney–Santiago, Johannesburg–Perth,
  Santiago–Perth
- **Globe:** great-circle distance
- **Flat:** straight-line distance between the same two points on the
  azimuthal-equidistant disc
- **Readout, Sydney–Santiago:** **11,340 km / ≈12.6 h** vs
  **≈25,700 km / ≈28.5 h**, against a scheduled block time of roughly 12h30m.
  Implied times assume 900 km/h cruise, stated on screen.

### 6. Time zones

- **Controls:** UTC hour
- **Globe:** the terminator is a great circle — exactly half the surface is lit
- **Flat:** a spotlight above a disc cannot produce that edge, and lights places
  that are actually dark
- **Readout:** per-city local time and day/night under each model, with
  mismatches against reality flagged

### 7. Midnight sun

- **Controls:** day of year, observer latitude
- **Globe:** 23.44° axial tilt gives 24-hour daylight above the Arctic Circle in
  June and above the Antarctic Circle in December
- **Flat:** a sun circling above a disc always sets at the rim; there is no south
  pole to put a midnight sun at
- **Readout:** daylight hours under each model *(computed)* against the observed
  24.0 h

### 8. Sun angular size

- **Controls:** time of day
- **Globe:** at ~150 million km the sun subtends ≈0.53° all day, varying only
  ≈0.52–0.54° across the year as Earth's distance changes
- **Flat:** a sun 5,000 km up — sized so it matches the observed 0.53° when
  overhead — is far closer at noon than at "sunset", so it should visibly shrink
  through the day, and should never actually set, only recede
- **Readout:** angular diameter through the day, both models *(computed)*,
  against the observed near-constant 0.53°

## UI

- **Header:** title and phenomenon selector
- **Canvas:** two labelled panes, `FLAT MODEL` and `GLOBE MODEL`
- **Control strip:** generated from `module.controls`
- **Readout panel:** `CLAIM → PREDICTION (flat | globe) → OBSERVED`
- **Info button:** opens the model-parameters note
- **Loading screen:** mirrors `solar-system-explorer`'s

**Responsive:** below 900 px the split flips from side-by-side to stacked, since
two narrow panes are useless for comparison. Controls and readout stack beneath.

## Error handling

Every failure shows a card, never a blank canvas.

| Failure | Behaviour |
|---|---|
| WebGL unavailable | Explanatory card replaces the canvas. Readouts still work — they come from the physics layer, not the renderer. |
| A module throws in `build()` | Caught by the registry. Error card in the pane. The app stays alive so the other seven still demo. |
| `cities.json` fails to load | The two modules that need it show an error card. The other six are unaffected. |
| Out-of-range control values | Controls clamp to `min`/`max`. Physics functions clamp domains (e.g. `acos` arguments) so no readout can render `NaN`. |

## Testing

`node --test docs/flat-earth/test/` — physics layer only. No Three.js, no
browser, no install. `package.json` exists solely so Node treats `.js` as ESM.

The assertions are the exact numbers the UI displays, so a wrong readout fails a
test before it reaches a demo:

- Hidden height at 12 km with 2 m eye height ≈ 3.8 m
- Geometric drop at 12 km ≈ 11.3 m — asserted separately, so the two are never
  conflated
- Horizon distance for 2 m eye height ≈ 5.05 km
- Sydney–Santiago great circle ≈ 11,340 km (±20 km)
- Sydney–Santiago azimuthal-equidistant distance ≈ 25,700 km (±200 km)
- Solar declination at both solstices ≈ ±23.44°
- Day length at **70°N** on the June solstice = 24 h. Deliberately not the Arctic
  Circle itself (66.56°), where the result sits exactly on the boundary and any
  rounding or refraction assumption flips it — a guaranteed flaky test.
- Solar angular diameter between 0.52° and 0.54° across a full year
- Flat-model solar angular diameter at 5,000 km altitude: ≈0.53° overhead by
  construction, and less than half that at 10,000 km ground distance
- Eratosthenes: globe radius identical from pairs A·B and B·C; flat-model
  inferred sun altitude differs by more than 20% between the same two pairs
- Eclipse: shadow-edge curvature constant across all disc orientations for the
  globe; varying by more than an order of magnitude for the disc

Rendering has no headless GL path here and will not pretend to. The README
carries a manual visual checklist covering each of the eight modules.

## Build order

1. Skeleton — `index.html`, dual-viewport scissor renderer, empty scenes,
   selector stub. Proves the layout and the two-viewport technique.
2. `physics/geodesy.js` plus `geodesy.test.js`.
3. **`horizon.js` end to end** — the tracer bullet.
4. Review and freeze the module contract against what building `horizon` taught.
5. The remaining seven, grouped so shared physics lands once:
   - `solar.js` group — `eratosthenes.js`, `midnight-sun.js`, `sun-size.js`
   - `eclipse.js` group — `lunar-eclipse.js`, `southern-stars.js`
   - `cities.json` group — `flight-routes.js`, `time-zones.js`
6. Polish — loading screen, model-parameters note, responsive layout, README
   with the manual checklist and the pinned Three.js version.
7. Optional: a blog post linking to `/flat-earth/`, written in the site's voice.

## Out of scope

Deliberately excluded, to be revisited only if asked:

- Atmospheric refraction modelling (stated as an exclusion in-app)
- A sandbox mode where users place their own objects
- Any CI/CD, container, or EKS deployment work — GitHub Pages serves it directly
- Guided/chaptered narration; the tool is exploratory, not linear
- A 2D-canvas fallback for the map-based modules. Held in reserve: if
  `flight-routes` becomes a projection-and-texture swamp, dropping that single
  module to a 2D pane is a clean, contained retreat.

## Repository notes

- `src/flat-earth/` is empty and unused; the app lives in `docs/flat-earth/`.
  Git does not track empty directories, so nothing needs removing from version
  control.
- `docs/_config.yml` excludes `superpowers` (so specs are not published on the
  blog) and `flat-earth/test` and `flat-earth/package.json` (so test scaffolding
  is not published).
- Jekyll copies files without YAML front matter through verbatim, so the app's
  `index.html`, JS, CSS, and JSON publish untouched.
