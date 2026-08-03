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
  // Tolerance, not strict equality: the pre-clamp cosine argument only lands
  // exactly on 1.0 for some latitudes. Other fixtures yield ~1e-4 km.
  near(greatCircleKm(SYD, SYD), 0, 1e-3, 'great-circle self distance');
  near(azimuthalEquidistantKm(SYD, SYD), 0, 1e-6, 'AE self distance');
});

test('the disc map has a fixed orientation, not just the right scale', () => {
  // Distances are rotation-invariant, so every other test here passes unchanged
  // if sin and cos are swapped in azimuthalEquidistantXY — verified: SYD→SCL is
  // byte-identical either way. Task 16 renders raw {x, y}, so a 90°-rotated map
  // would ship silently. Pin the convention: longitude 0 lies along +Y,
  // longitude 90°E along +X.
  const atLon0 = azimuthalEquidistantXY({ lat: 0, lon: 0 });
  near(atLon0.x, 0, 1e-6, 'lon 0 has no X component');
  assert.ok(atLon0.y > 0, 'lon 0 must lie along +Y');

  const atLon90 = azimuthalEquidistantXY({ lat: 0, lon: 90 });
  assert.ok(atLon90.x > 0, 'lon 90E must lie along +X');
  near(atLon90.y, 0, 1e-6, 'lon 90E has no Y component');
});
