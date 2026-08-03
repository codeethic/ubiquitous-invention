# Flat Earth Lab

Split-screen simulator comparing flat-disc and globe models of the Earth
against observation. Design spec:
`docs/superpowers/specs/2026-08-02-flat-earth-design.md`

## Run locally

    cd docs/flat-earth
    python serve.py

Open http://localhost:8000

Use `serve.py`, **not** `python -m http.server`. Python's `mimetypes` seeds
itself from the Windows registry, and on many Windows machines
`HKEY_CLASSES_ROOT\.js` carries `Content Type = text/plain`. `http.server`
then serves every module as text/plain and the browser refuses the whole
import graph under strict MIME checking — a blank page whose only symptom is
`Expected a JavaScript-or-Wasm module script but the server responded with a
MIME type of "text/plain"`. Nothing is wrong with the app when this happens.
`serve.py` pins the types it serves instead of trusting the host registry.

This affects local serving only. GitHub Pages sends the correct
`text/javascript`, so the published site is unaffected.

## Tests

    node --test "docs/flat-earth/test/**/*.test.js"

Covers `js/physics/` only — pure math, no browser required.

## Three.js

Vendored in `third-party/` as two files, both pinned to **r185** (0.185.1),
totalling **≈2.09 MB**:
- `three.module.js` (650 KB) — entry point with renderer and utilities
- `three.core.js` (1.44 MB) — core library (Scene, Camera, Geometry, etc.)

`three.module.js` re-exports the entire API and is the only import entry point; `three.core.js` is never imported directly by application code.

These files form a complete import graph: `three.module.js` imports from
`three.core.js`, and `three.core.js` has no further external dependencies.

Not loaded from a CDN: a blank portfolio page caused by a CDN outage is not
an acceptable failure mode. Upgrades are deliberate — replace **both files together**
with the next version and re-run the manual visual checklist below. Replacing only
one file will break the import graph.

The directory is named `third-party/`, not `vendor/`, because
`docs/_config.yml` excludes `vendor` from the Jekyll build.

## Manual visual checklist

Rendering has no headless GL path, so these are checked by hand after any
change to `js/lib/` or `js/phenomena/`. Seven of the eight modules shipped a
defect during development where the readout was numerically correct but the
picture showed something else (wrong tessellation, a marker pointing into the
planet, a shadow that vanished on orbit, and so on) — every one of those
passed the automated test suite. For each item below, check **both** the
number in the readout **and** what the picture actually shows; a correct
number next to a wrong picture is a failing item.

- [ ] **Horizon** — at 12 km distance / 2 m eye height, the readout reads
      globe **3.8 m** hidden, flat **0.0 m**. Picture: on the globe pane the
      ship's hull is progressively occluded from the bottom as distance
      increases; on the flat pane the ship only shrinks with distance and its
      full hull stays visible at every range. The globe's horizon line must
      read as a smooth curve, not a faceted polygon edge, and the hull must
      disappear continuously rather than in visible steps — the original
      defect was a facet spanning 313 km across a 3.8 m effect, so the
      surface looked flat.
- [ ] **Eratosthenes** — the readout gives a globe radius of **6371 km** from
      both gnomon pairs, and flat sun altitudes that disagree by over 20%
      between the two sites. Picture: three gnomons stand upright and cast
      shadows in each pane.
- [ ] **Midnight sun** — at the defaults (latitude −70°, day 355) the readout
      reads flat **7.0 h** vs globe **24.0 h**. At (70°, day 172) both read
      **24.0 h** and the on-screen text says the flat model agrees there —
      that concession is deliberate, not a bug. Picture: the observer marker
      must stand OUT from the surface along the local vertical in both
      panes, at every latitude tested — at −70° it previously pointed into
      the globe. The sun must visibly circle without setting in the globe
      pane at the default, and visibly dip below the horizon in the flat
      pane.
- [ ] **Sun size** — at noon both panes read ≈**0.533°** and the two rendered
      suns look the same apparent size. Moving to 18:00 **on the default day
      81**, the flat figure falls to ≈**33%** of the noon value (it ranges
      27–43% across the year, so check at the default date) and the flat
      pane's sun disc must visibly shrink to match; the globe pane's sun
      does not change size.
- [ ] **Lunar eclipse** — at 55° the flat pane's shadow renders as a visibly
      flattened ellipse; at 85° it collapses toward a near-linear sliver. The
      globe pane's shadow stays circular at both angles. Picture: orbiting
      the camera in either pane must never make the shadow disappear.
- [ ] **Southern stars** — at −35° the readout reads globe **CW / Sigma
      Octantis**, flat **CCW**, and the two star domes visibly rotate in
      opposite directions on screen. At +35° both readouts read CCW and both
      domes spin the *same* direction (this is correct, not a bug). At 0°
      the pole-star row reads "both poles on the horizon."
- [ ] **Flight routes** — SYD → SCL reads globe **11 347 km / 12.6 h**, flat
      **25 684 km / 28.5 h**. Picture: the entire great-circle arc is visible
      in both panes immediately on load, with no dragging or panning needed
      to see the full route.
- [ ] **Time zones** — at UTC 0, day 172, flat lights **8 of 10** cities and
      is wrong for **3** (London, Reykjavik, McMurdo); globe lights **5 of
      10** and is wrong for **0**. Picture: both panes show city markers, and
      on the globe pane the night side visibly faces away from the sun.
- [ ] **Camera linking behaves per module**, verified against
      `linkCameras` in each phenomenon file, not assumed from the module
      name:
  - Linked (drag either pane and *both* orbit together, by the same amount —
    not double): Eratosthenes, midnight sun, lunar eclipse.
  - Independent (drag one pane and only it orbits): flight routes, southern
    stars, time zones.
  - Fixed-camera (no orbit at all, dragging does nothing): horizon, sun
    size — their readouts assert a claim that only holds from one specific
    eye position, so the camera must not move.
- [ ] Switching phenomena repeatedly does not slow the app down. After 20+
      switches, dragging still moves the camera by the same amount per pixel
      as it did before switching — a doubled rate means listeners
      accumulated (listener leak check).
- [ ] Below 900 px viewport width, the two panes stack vertically with the
      **flat pane on top**, and nothing scrolls sideways at any width.

## Outstanding: verify the published site after merge

The Jekyll publish check could not be run locally (no Ruby toolchain).
After the first deploy, confirm on the live site:

- [ ] `/flat-earth/` loads and both panes render
- [ ] `/flat-earth/third-party/three.module.js` and `three.core.js` both
      return 200 — if either 404s the app is blank, and nothing else on
      this list will work
- [ ] `/superpowers/` is NOT published (design docs are excluded)
- [ ] `/flat-earth/test/` is NOT published

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
- **Camera ownership is one mode or the other, never both:**
  - *Rig-driven* — return a rig, never write `camera.position`/`camera.lookAt`.
    Steer with `rig.setTarget()` / `rig.setDistance()`. Drags are routed here.
  - *Fixed-camera* — return `rig: null`, own the camera outright, receive no
    pointer routing. `linkCameras` is ignored.
  A module that returns a rig AND writes the camera every frame will have every
  drag silently erased on the next frame. `horizon` and `sun-size` are the
  fixed-camera modules: their readouts assert a quantity that is only true from
  one specific eye position, so orbiting the camera would decouple the claim
  from the image.
- `load()` is optional. Modules needing external data (cities.json) fetch it
  there and throw a descriptive Error on failure; the harness turns that into
  a pane error card without taking down the rest of the app.
- `rig` may be null for a module with a fixed camera; `linkCameras` is then ignored.
- `readout(state)` must not depend on `build()` having run — it reads state and
  calls `js/physics/` only. The WebGL-unavailable fallback relies on this.
- **`readout(state)` must not throw.** "Must not depend on `build()`" is not
  enough: a module whose `load()` failed or has not run yet still gets
  `readout()` called. Guard for missing data and return a row saying so —
  e.g. `{ label: 'Distance', value: 'data unavailable' }` — rather than
  dereferencing it. The harness catches a throw and shows an error card, but
  the readout is the one surface that is supposed to keep working when
  everything else has failed.
- **`rig` must be both-or-neither across `flat` and `globe`.** An asymmetric
  module is silently degraded, not rejected: the rig-less pane gets no drag
  routing and `linkCameras` no-ops. Pick one mode for the whole module.
- Adding a phenomenon: one file in `js/phenomena/`, one import and one array
  entry in `js/registry.js`. No UI code changes.
