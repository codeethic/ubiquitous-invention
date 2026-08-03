/**
 * The projections against the GEOMETRY THAT CONSUMES THEM.
 *
 * map-projection.test.js checks each projection against itself — discUV
 * against its own inverse, equirectUV against its own corner values. Both
 * kept passing while the globe's map sat 90 degrees out in longitude and the
 * disc's was mirrored, because neither bug is in the projection: each is a
 * disagreement between the projection and the Three.js geometry it is painted
 * onto. Nothing in the suite compared the two, so nothing could have caught
 * them. This file does.
 *
 * It imports the VENDORED Three.js by relative path rather than the bare
 * 'three' specifier the app uses, because node has no import map. That is the
 * same file the browser loads (third-party/three.module.js, r185); it imports
 * cleanly outside a browser, touching no DOM at module scope. Geometry is
 * therefore built here exactly as the app builds it, and the UVs asserted
 * against are the real attribute values, not a re-derivation of the formula.
 *
 * The geometry parameters below are duplicated from primitives.js on purpose:
 * primitives.js imports 'three' bare and so cannot be loaded here. If they
 * ever diverge this test stops describing the app — the constants it CAN
 * import (GLOBE_TEXTURE_ROTATION_Y, the flipY flags) are the load-bearing
 * ones, and those are shared.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../third-party/three.module.js';
import {
  equirectUV, discUV, GLOBE_TEXTURE_ROTATION_Y, EQUIRECT_FLIP_Y, DISC_FLIP_Y,
} from '../js/lib/map-projection.js';
import { R_EARTH_KM, FLAT_DISC_RADIUS_KM, DEG } from '../js/physics/constants.js';
import { azimuthalEquidistantXY } from '../js/physics/geodesy.js';

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ±${tol}, got ${actual}`);

/**
 * Tolerances below are sized for FLOAT32, which is what a BufferAttribute
 * stores. Positions are in kilometres, so a 6,371 km globe carries ~6e-4 km of
 * quantisation and a 20,015 km disc ~2e-3 km — the assertions here are
 * relative fractions of the radius, not absolute millimetres. They stay four
 * orders of magnitude tighter than the smallest thing that could hide a bug:
 * one lattice step of the sphere is 3.75 deg, about 417 km.
 */
const POS_TOL = 1e-5;   // as a fraction of the radius being tested
const UV_TOL = 1e-5;    // float32 UVs, absolute

/**
 * Where this app puts (lat, lon) in world space on the globe. Identical to
 * `latLonToVec3` in js/phenomena/flight-routes.js, and to the constructions in
 * time-zones.js, midnight-sun.js and eratosthenes.js: lon 0 faces +Z, lon +90
 * faces +X. Every marker, route and terminator on the globe uses it, so it is
 * the convention the painted map has to match.
 */
function appGlobePoint(lat, lon, radius = R_EARTH_KM) {
  const phi = lat * DEG, lam = lon * DEG;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(lam),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lam));
}

/** Where this app puts (lat, lon) in world space on the flat disc. */
function appDiscPoint(lat, lon) {
  const { x, y } = azimuthalEquidistantXY({ lat, lon });
  return new THREE.Vector3(x, 0, y);
}

/**
 * The globe surface mesh as makeGlobeOcean builds it, including its rotation,
 * with world-space vertex positions resolved.
 */
function buildGlobeMesh() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH_KM, 96, 64));
  mesh.rotation.y = GLOBE_TEXTURE_ROTATION_Y;
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * SphereGeometry's lattice. widthSegments 96 puts a vertex every 3.75 deg of
 * longitude; heightSegments 64, every 2.8125 deg of latitude. Sampling ON the
 * lattice lets the assertion be exact: the app's world point coincides with a
 * real vertex to floating-point precision, so its UV is read rather than
 * interpolated, and the check has no tolerance to hide a small error in.
 */
const LON_STEP = 360 / 96;
const LAT_STEP = 180 / 64;

test('the globe samples the u that equirectUV paints, at the app world point', () => {
  const mesh = buildGlobeMesh();
  const pos = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  const world = new THREE.Vector3();

  // Poles excluded: every vertex there coincides, so u is degenerate.
  for (let iy = 1; iy < 64; iy += 7) {
    for (let ix = 0; ix <= 96; ix += 11) {
      const lat = 90 - iy * LAT_STEP;
      const lon = ix * LON_STEP - 180;
      const target = appGlobePoint(lat, lon);

      let best = -1, bestD = Infinity;
      for (let i = 0; i < pos.count; i += 1) {
        world.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        const d = world.distanceTo(target);
        if (d < bestD) { bestD = d; best = i; }
      }

      // The app's world point lands ON a vertex, so the UV below is read
      // straight off the attribute rather than interpolated.
      near(bestD, 0, R_EARTH_KM * POS_TOL, `vertex coincidence at lat ${lat} lon ${lon}`);

      const painted = equirectUV(lat, lon);
      // ix === 96 is the duplicated seam column, where the geometry carries
      // u = 1 and the projection wraps to lon -180 -> u = 0. Same meridian,
      // and the nearest-vertex search may land on either copy.
      const sampled = uv.getX(best);
      const delta = Math.min(
        Math.abs(sampled - painted.u), Math.abs(Math.abs(sampled - painted.u) - 1));
      near(delta, 0, UV_TOL,
        `u at lat ${lat} lon ${lon} (geometry ${sampled}, projection ${painted.u})`);

      // v too: catches a globe flipped north-for-south.
      near(uv.getY(best), 1 - painted.v, UV_TOL, `v at lat ${lat} lon ${lon}`);
    }
  }
});

test('the globe rotation is exactly the 90 deg the two conventions differ by', () => {
  // The same claim without the search, so a failure says WHICH convention
  // moved. An UNROTATED SphereGeometry puts uv u = 0.25 at world +Z, where
  // equirectUV paints lon 0 at u = 0.5 — a uniform quarter-turn.
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  let uAtPlusZ = null;
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    if (v.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-9) { uAtPlusZ = uv.getX(i); break; }
  }
  assert.notEqual(uAtPlusZ, null, 'no vertex found at +Z on the equator');
  near(uAtPlusZ, 0.25, 1e-9, 'raw SphereGeometry u at world +Z');
  near(equirectUV(0, 0).u, 0.5, 1e-9, 'equirectUV u at lon 0');
  near(GLOBE_TEXTURE_ROTATION_Y, -Math.PI / 2, 1e-12, 'corrective rotation');
});

test('the disc samples the uv that discUV paints, at the app world point', () => {
  // CircleGeometry's UV is an exact affine function of the local vertex
  // position, so it interpolates exactly across every triangle. Recover that
  // map from the real attributes — never assume it — then check it reproduces
  // EVERY vertex before using it anywhere off the lattice.
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(FLAT_DISC_RADIUS_KM, 256));
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);
  const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;

  // Three points, one of them the centre, fix the affine map u = a + b*x + c*y.
  const P = i => [pos.getX(i), pos.getY(i)];
  const [x0, y0] = P(0), [x1, y1] = P(1), [x2, y2] = P(65);
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  assert.ok(Math.abs(det) > 1e-6, 'chosen sample vertices are collinear');
  const solve = get => {
    const f0 = get(0), f1 = get(1), f2 = get(65);
    const b = ((f1 - f0) * (y2 - y0) - (f2 - f0) * (y1 - y0)) / det;
    const c = ((f2 - f0) * (x1 - x0) - (f1 - f0) * (x2 - x0)) / det;
    return { a: f0 - b * x0 - c * y0, b, c };
  };
  const AU = solve(i => uv.getX(i)), AV = solve(i => uv.getY(i));
  const geomUV = (x, y) => ({
    u: AU.a + AU.b * x + AU.c * y,
    v: AV.a + AV.b * x + AV.c * y,
  });
  for (let i = 0; i < pos.count; i += 1) {
    const g = geomUV(pos.getX(i), pos.getY(i));
    near(g.u, uv.getX(i), UV_TOL, `recovered u at vertex ${i}`);
    near(g.v, uv.getY(i), UV_TOL, `recovered v at vertex ${i}`);
  }

  // Local coordinates of the app's world point, undoing makeDisc's rotation.
  const inv = mesh.matrixWorld.clone().invert();
  for (const lat of [80, 45, 0, -45, -80]) {
    for (const lon of [0, 90, -90, 179, 45]) {
      const local = appDiscPoint(lat, lon).applyMatrix4(inv);
      near(local.z, 0, FLAT_DISC_RADIUS_KM * POS_TOL,
        `disc point off the mesh plane at ${lat},${lon}`);
      const g = geomUV(local.x, local.y);
      const painted = discUV(lat, lon);
      near(g.u, painted.u, UV_TOL, `disc u at ${lat},${lon}`);
      near(g.v, painted.v, UV_TOL, `disc v at ${lat},${lon}`);
    }
  }
});

/**
 * flipY is the third party to the agreement, and the one that mirrored the
 * disc. The rasteriser in textures.js writes a projected point to canvas row
 * `v * h`, with row 0 at the top. The GPU, given the geometry's uv.y, reads
 * row `(1 - uv.y) * h` when flipY is true and `uv.y * h` when it is false.
 * Those two rows must be the same row, or the map is a mirror of itself.
 */
const sampledRow = (uvY, h, flipY) => (flipY ? 1 - uvY : uvY) * h;

test('flipY makes the GPU read the canvas row the rasteriser wrote: globe', () => {
  const mesh = buildGlobeMesh();
  const uv = mesh.geometry.attributes.uv, pos = mesh.geometry.attributes.position;
  const world = new THREE.Vector3();
  const H = 512;
  for (let iy = 1; iy < 64; iy += 9) {
    const lat = 90 - iy * LAT_STEP;
    const target = appGlobePoint(lat, 0);
    let best = -1, bestD = Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      world.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const d = world.distanceTo(target);
      if (d < bestD) { bestD = d; best = i; }
    }
    const written = equirectUV(lat, 0).v * H;
    near(sampledRow(uv.getY(best), H, EQUIRECT_FLIP_Y), written, UV_TOL * H,
      `equirect row at lat ${lat}`);
  }
});

test('flipY makes the GPU read the canvas row the rasteriser wrote: disc', () => {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(FLAT_DISC_RADIUS_KM, 256));
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);
  const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
  const H = 1024;
  // Vertex 0 is the centre; 1.. are the rim, i.e. the south pole at one
  // longitude each, where the app's world point and a geometry vertex
  // coincide. Longitude is read back from the vertex's WORLD position — going
  // via the local one would silently undo makeDisc's rotation twice, which is
  // exactly the class of sign error this file exists to catch.
  const world = new THREE.Vector3();
  for (let i = 1; i < pos.count; i += 37) {
    world.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const lon = Math.atan2(world.x, world.z) / DEG;
    const app = appDiscPoint(-90, lon);
    near(world.distanceTo(app), 0, FLAT_DISC_RADIUS_KM * POS_TOL,
      `rim vertex ${i} is the app's south pole at lon ${lon}`);
    const written = discUV(-90, lon).v * H;
    near(sampledRow(uv.getY(i), H, DISC_FLIP_Y), written, UV_TOL * H,
      `disc row at rim vertex ${i}`);
  }
});
