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
