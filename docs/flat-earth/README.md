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
