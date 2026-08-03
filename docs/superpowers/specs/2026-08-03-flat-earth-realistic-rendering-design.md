# Flat Earth Lab — Realistic Rendering

**Date:** 2026-08-03
**Status:** Approved
**Supersedes nothing.** Extends `2026-08-02-flat-earth-design.md`; the module
contract frozen there is unchanged by this work.

## Problem

Every object in Flat Earth Lab renders as a flat-shaded solid color. The ocean
is one blue `MeshStandardMaterial`, the ship is a box plus a cylinder plus a
plane, the sun is a plain emissive sphere, and there are no textures anywhere.
As a portfolio piece the app argues its case correctly and looks like a
wireframe.

## Constraint that governs every decision

The app's value is that **the picture agrees with the number**. Seven of the
eight modules shipped a defect during the original build where the readout was
numerically correct and the render showed something else; all seven passed the
automated suite. Realism that obscures a measurement is not an improvement, it
is a regression of exactly the kind this project has already paid for.

Therefore: **no visual detail may exceed the magnitude of the phenomenon its
module measures.** Where the prettier choice would eat a measurement, the
measurement wins. This rule is enforced by a test (below), not by memory.

## Decisions

| Question | Decision |
|---|---|
| What "realistic" optimizes for | Believable **and** measurement-safe |
| Asset source | Procedural generation, no imagery |
| Geography | Real coastlines from embedded public-domain data |
| Shadows | Rendered by the light, not asserted by physics |
| Structure | Shared world kit; `midnight-sun` and `sun-size` change one line each, `eratosthenes` gains real lights, the other five are untouched |

### Why real coastlines

`flight-routes` draws Sydney→Santiago and `time-zones` labels ten real cities
including London, Reykjavik and McMurdo. Procedurally invented continents under
real city names would be a picture disagreeing with a readout — the precise
defect class this app exists to avoid. Fictional geography is not an option
here even though it is cheaper.

**Source:** Natural Earth 4.1.0 `ne_110m_land`, verified public domain — "No
permission is needed to use Natural Earth," commercial use included, crediting
appreciated but not required. Measured: 127 polygons, 128 rings, 5,143 points,
yielding **~55–70 KB** of JSON. Under 3% of the 2.09 MB of Three.js already
vendored.

## Architecture

Approach: extend the shared library layer; do not dress each phenomenon
separately. Eight modules across 27 files with a frozen contract means a shared
upgrade lifts all eight consistently and cannot cause them to diverge. It also
leaves the files carrying the physics alone, so the 43 existing tests stay
meaningful.

```
js/lib/
  textures.js     NEW   procedural generators; fbm noise -> CanvasTexture,
                        derived normal maps. Mirrors the approach already
                        proven in src/solar-system-explorer/js/textures.js.
  world.js        NEW   sky dome, atmosphere, lighting rig, signal budget
  primitives.js   EDIT  internals gain textures; signatures unchanged
  materials.js    EDIT  real PBR materials; keeps the shared-singleton pattern
data/
  coastlines.json NEW   ~55-70 KB, Natural Earth 110m land, public domain
tools/
  build-coastlines.mjs  NEW  shapefile -> JSON, dev-only, never shipped
js/viewport.js    EDIT  color space, tone mapping, shadow maps; the hard-coded
                        key light is removed
```

### Texture lifetime

Textures generate **once**, into a shared `TEXTURES` cache that is never
disposed.

This is deliberately the same lifetime rule `MATERIALS` already follows, so
`disposeTree`'s `userData.ownsMaterial` logic keeps working unchanged. No
texture is ever freed out from under a live scene, and switching phenomena 20
times allocates nothing.

**Amended after measurement (final fix wave).** This section originally said
"once at boot, behind the loading screen that already exists". That is no
longer what happens, and the change is worth recording because the reason is a
falsified assumption rather than a preference.

Generation measures **~1,735 ms** in the browser, against the ≤400 ms this
document assumed. The assumption cannot be recovered by the lever this document
nominated: see Budget below. Rather than degrade the maps to fit a boot budget,
generation moved **off the boot path entirely**. `boot()` reaches
`setLoading(false)` with no network I/O and no texture work at all — exactly as
it did before this branch — and `main.js` starts generation from a
`setTimeout` inside a `requestAnimationFrame`, i.e. after the first frame has
actually been painted rather than merely scheduled. The maps then swap into the
live scene with no rebuild.

That last part is nearly free **because of the lifetime rule above**:
`applyMaterials()` mutates the shared material singletons in place instead of
replacing them, so every mesh already built is holding the exact object that
gains the map. The property was chosen so `disposeTree` kept working, and it
paid for itself somewhere else entirely.

Two consequences, both deliberate and both documented at their call sites:

- `TEXTURES.ready` is now false for the first ~1.7 s of a **healthy** session,
  not only after a failure. `makeSun` branches on it at build time, so a
  phenomenon built inside that window keeps the untextured fallback sphere
  until it is next rebuilt. Accepted: `horizon` is the default module and has
  no sun; the fallback is an exact circle at the same apparent diameter, so
  `sun-size`'s measurement is untouched; and re-activating a module to fix it
  would reset the user's controls and camera 1.7 s into a working session.
- Every stage of the deferred sequence is guarded, because it now runs while
  the user is already looking at a working app. The blank-page prohibition
  below applies to it with more force, not less.

### The light must become the sun

Today both scenes get a `DirectionalLight` hard-coded at `(1, 1, 1)` while the
sun *mesh* is moved independently by physics. The glowing sphere and the
illumination already disagree; nothing casts shadows, so nobody noticed.

The moment shadows are real that discrepancy becomes visible — gnomons would
cast toward a fixed corner of the scene regardless of sun position, and the
Eratosthenes readout would be contradicted by its own picture.

Fix: `makeSun()` returns the emissive sphere **with its light attached**, and
the module points `light.target` at its root. Because the light rides the sun
mesh, every existing physics call that moves the sun now moves the illumination
too, automatically and permanently in sync.

**Exactly two modules call `makeSun`: `midnight-sun` and `sun-size`.** Each
costs one line at a call site that already exists. All other modules keep
ambient plus soft fill from the viewport.

### Eratosthenes needs its own lights, and two different kinds

`eratosthenes` has **no sun mesh at all** — it computes shadow lengths from
physics and writes them into a shadow plane. It is also the one module where a
shadow *is* the evidence. So it gains lights that no existing call site
provides, and the two panes must not get the same kind:

| Pane | Light | Why |
|---|---|---|
| Flat | Local light at `FLAT_SUN_ALTITUDE_KM` (5,000 km) | The flat model's sun is nearby, so rays **diverge** and strike gnomons at different latitudes at genuinely different angles |
| Globe | `DirectionalLight` | The sun is 1 AU away, so rays are **parallel** |

That asymmetry is Eratosthenes' entire argument. Giving each model its own
physically-correct light type means the differing shadow lengths are
**produced by the geometry rather than drawn by the author** — the strongest
available form of the picture-agrees-with-the-number property.

The existing `setShadow(len)` shadow-plane mechanism is removed from this
module once real shadows land; keeping both would mean two shadows, one real
and one asserted, disagreeing on screen.

Knock-on, verified: `makeGnomon` is called only by `eratosthenes`, so its
shadow plane and `userData.setShadow` become dead code and are deleted with it.
`MATERIALS.shadow` **stays** — `lunar-eclipse` and `time-zones` both still use
it for their own umbra and night-side patches, which are not cast shadows and
are not affected by this change.

## Textures and projections

### Two projections, one dataset

- **Globe** — equirectangular, what `SphereGeometry` UVs expect.
- **Disc** — azimuthal equidistant: north pole centered, Antarctica smeared
  into a ring around the rim. The classic flat-earth map.

The disc is projected through `azimuthalEquidistantXY()` — the same function
`flight-routes` uses to compute its distances. The map on the disc and the
25,684 km readout above it therefore come from one function and cannot
disagree. This is the shadow-integrity property applied to geography.

It also means the flat pane looks like what flat-earthers actually publish,
which makes the comparison fair rather than a strawman.

### Rasterize, do not point-test

The obvious implementation — per pixel, test which polygon contains it — is
524,288 × 5,143 ≈ **2.7 billion operations** and hangs the tab.

Instead: fill the polygons with the 2D canvas's native `fill()`, then read back
once as a land/sea mask. For the disc, project each polygon's vertices through
AE and densify long edges first, because the projection is non-linear and a
straight fill would cut corners.

Terrain color, bathymetry and surface detail are fbm noise layered on the mask,
so the **shapes are real and only the texture is invented**.

### Budget

1024×512 equirect, 1024×1024 disc.

**This section's original claim was wrong and is retained with its correction.**
It said "**≤400 ms total generation** on a mid laptop. If measurement exceeds
the ceiling, octave count drops before resolution does."

Measured: **2,483 ms** on first implementation. Octave reduction (land 5→4,
ridge 4→3, sea 4→3, ocean 4→3) plus de-allocating the per-pixel loops brought
it to **~1,735 ms**. The nominated lever is then exhausted — collapsing *every*
`fbm` and `ridge` call in the app to a **single octave**, which is no longer
fractal noise at all, still floors at **~376 ms of pure arithmetic before a
single canvas call**. The cost is 1.6 M per-pixel evaluations across the two
maps, not the octaves inside each one, so 400 ms was never reachable at these
resolutions by dropping octaves.

The remaining levers were resolution (halving the disc to 512² removes roughly
half the total) and timing. **Timing was chosen**: see Texture lifetime above.
The 400 ms constant is gone from the code. What remains is a 2,600 ms
regression tripwire — about 1.5× the measured cost — which gates nothing and
exists only so a future doubling of resolution or octaves is noticed.

### The ocean constraint

The ocean gets a normal map and color variation and **zero vertical
displacement** — not small, zero. A normal map perturbs shading only and adds
no geometry, so `hiddenHeightM()` stays exactly 3.8 m at 12 km and the horizon
module's signal is untouched by construction.

This is the single most important line in this document. The sea will look
textured and never choppy.

### Deliberate omissions

Each is a case where the prettier choice is the dishonest one.

- **No cloud layer** — obscures the terminator `time-zones` exists to show.
- **No bloom or lens flare** — `sun-size` measures angular diameter; a glow
  halo makes the edge unreadable and destroys the 0.533° vs 0.177° comparison.
- **No limb scattering** — `horizon` reads hull occlusion against the limb;
  haze blurs the exact pixel the module is about.

## Lighting and shadows

### Scope

Shadows go on **only where a shadow is the evidence: `eratosthenes`, and
nowhere else.** Horizon is about occlusion, not shading. Lunar eclipse computes
its own umbra. Midnight-sun's evidence is whether the sun sets, not what it
casts. Star and route modules have no shadow content.

One module out of eight means seven fewer chances to introduce shadow acne or
peter-panning, for zero visual loss.

### Feasibility, measured

`eratosthenes.js` sets `STICK_KM = 300` — gnomons are already exaggerated to
300 km so the shadow reads at world scale.

- **Globe pane**: a shadow camera fitted to the ~3,000 km gnomon region at a
  2048 map gives **1.5 km per texel against a 300 km shadow: a 200× margin.**
- **Flat pane**: gnomon sites sit at AE radii of roughly 5,000–7,200 km, so the
  local light's shadow frustum must span ~10,000 km. At 2048 that is 4.9 km per
  texel — still a **60× margin**.

Km-scale shadow mapping was the flagged risk here and both panes are
comfortable, not marginal.

### Renderer

Correct sRGB output, ACES filmic tone mapping at exposure 1.0, `normalBias`
rather than constant bias on the one shadow-casting light.

**Caveat to verify, not assume:** tone mapping compresses highlights globally
and `horizon` reads hull occlusion against a bright limb. If ACES measurably
reduces that contrast, tone mapping comes back off. The measurement outranks
the look.

## Signal budget

A table in `world.js`, one row per module.

| Module | Signal | Magnitude | Ceiling on added detail |
|---|---|---|---|
| horizon | hidden hull | 3.8 m @ 12 km | ocean displacement **exactly 0** |
| eratosthenes | shadow length | ~300 km | shadow texel ≤ 1/50 shortest shadow |
| midnight-sun | sun above horizon | 7.0 h vs 24.0 h | marker ≪ solar altitude swing |
| sun-size | angular diameter | 0.533° → 0.177° | no glow; silhouette sharp |
| lunar-eclipse | shadow curvature | 555 vs 6371 km | moon relief ≪ curvature |
| southern-stars | rotation direction | sign of ω | star size fixed, no trails |
| flight-routes | path ratio | 2.3× | arc width ≪ arc length |
| time-zones | terminator position | hours | no cloud layer |

`test/signal-budget.test.js` asserts every declared amplitude clears its
ceiling with a 10× safety factor. Pure numbers, headless, alongside the
existing 43.

**What this test does not do**, stated plainly because this project has a
history: it locks the *declared* numbers. It cannot verify the renderer honors
the declaration — nothing headless can, which is why the manual visual
checklist exists. It converts "someone remembers the ocean must stay flat" into
"the build fails if someone writes a displacement value," and that is all it
converts.

## Per-module outcome

Ocean and land gain real surface texture in all eight. The globe becomes
recognizably Earth; the disc becomes the recognizable flat-earth map. The ship
gets proper hull, mast and sail geometry instead of a box with a plane stuck to
it. The sun gets limb darkening. The moon gets relief.

Two open findings from the last visual checklist get fixed here:

- Gnomon shadows were **not discernible** — real cast shadows from a correctly
  typed light per pane fix this directly, and upgrade the shadows from asserted
  to demonstrated in the process.
- The observer marker was a **near-invisible speck** — it gets sized against
  camera distance instead of a fixed 0.5 km.

## Failure behavior

Textures are an enhancement, never a dependency. Three new failure modes, each
degrading rather than blanking:

| Failure | Behavior |
|---|---|
| Texture generation throws (no 2D canvas, OOM) | Fall back to today's solid-color `MATERIALS`. App looks as it does now; every readout unaffected. |
| `coastlines.json` fails to load | Globe and disc render ocean-only with a lat/lon graticule. Seven modules need no geography at all. |
| WebGL unavailable | Unchanged. Existing readouts-only path still works. |

`coastlines.json` adds a second boot-time fetch alongside `cities.json` and
follows the same rule: it must never take the app down.

**Nothing in this change may introduce a new way for the page to go blank.**
That failure mode already cost one shipped bug (PR #19).

## Verification

- The 43 existing tests stay green **untouched**. No physics changes — the main
  reason the shared-library approach was worth its constraint.
- New headless tests: signal budget; `coastlines.json` integrity (lat/lon in
  range, rings closed, point count sane); AE-projection round-trip on the
  texture painter, pinning the map and the distance calculation to one
  function.
- The manual visual checklist gains a row per module for "texture present and
  geographically correct," and is re-run in full at the end.

## Risks

| Risk | Mitigation |
|---|---|
| Boot time exceeds 400 ms | ~~Drop fbm octaves before resolution~~ — **occurred, and the mitigation failed.** Measured 2,483 ms; octaves got it to ~1,735 ms and no further. Resolved by moving generation off the boot path after first paint, so boot costs nothing and the maps swap in live. See Texture lifetime. |
| ACES degrades horizon limb contrast | Drop tone mapping; measurement outranks look |
| Texture memory on low-end devices | Fixed resolutions; textures generated once, never per-module |
| Shadow acne at km scale | 200× texel margin measured; `normalBias` |

## Out of scope

- Displaced ocean geometry, volumetric clouds, bloom, god rays — each eats a
  measurement.
- Vendored image textures — megabytes and per-image license review.
- Any change to `js/physics/`.
- Any change to the module contract frozen in the 2026-08-02 design.
