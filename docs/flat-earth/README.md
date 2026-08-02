# Flat Earth Lab

Split-screen simulator comparing flat-disc and globe models of the Earth
against observation. Design spec:
`docs/superpowers/specs/2026-08-02-flat-earth-design.md`

## Run locally

    cd docs/flat-earth
    python -m http.server

Open http://localhost:8000

## Tests

    node --test "docs/flat-earth/test/**/*.test.js"

Covers `js/physics/` only — pure math, no browser required.

## Three.js

Vendored in `third-party/` as two files, both pinned to **r185** (0.185.1):
- `three.module.js` (650 KB) — entry point with renderer and utilities
- `three.core.js` (1.4 MB) — core library (Scene, Camera, Geometry, etc.)

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

Rendering has no headless GL path. After any change to `js/lib/` or
`js/phenomena/`, load each phenomenon and confirm both panes draw.

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
