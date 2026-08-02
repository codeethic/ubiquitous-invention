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
