import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hash, noise2D, fbm, ridge, lerp, clamp01, smoothstep, colorLerp,
} from '../js/lib/noise.js';

test('hash is deterministic and in [0,1)', () => {
  for (const [x, y] of [[0, 0], [1.5, -2.25], [1000, 1000]]) {
    const a = hash(x, y);
    assert.equal(a, hash(x, y), 'same input must give same output');
    assert.ok(a >= 0 && a < 1, `hash(${x},${y}) = ${a} out of range`);
  }
});

test('noise2D is continuous across a lattice boundary', () => {
  // Approaching an integer from below and above must not jump. A discontinuity
  // here shows up as visible grid seams in every generated texture.
  const below = noise2D(0.999999, 0.3);
  const above = noise2D(1.000001, 0.3);
  assert.ok(Math.abs(below - above) < 1e-3,
    `seam at lattice boundary: ${below} vs ${above}`);
});

test('noise2D stays within [0,1]', () => {
  for (let i = 0; i < 500; i += 1) {
    const v = noise2D(i * 0.37, i * 0.91);
    assert.ok(v >= 0 && v <= 1, `noise2D out of range: ${v}`);
  }
});

test('fbm stays within [0,1] and varies with position', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const v = fbm(i * 0.13, i * 0.29);
    assert.ok(v >= 0 && v <= 1, `fbm out of range: ${v}`);
    seen.add(v.toFixed(4));
  }
  assert.ok(seen.size > 100, `fbm too flat: only ${seen.size} distinct values`);
});

test('ridge stays within [0,1]', () => {
  for (let i = 0; i < 200; i += 1) {
    const v = ridge(i * 0.17, i * 0.41);
    assert.ok(v >= 0 && v <= 1, `ridge out of range: ${v}`);
  }
});

test('clamp01 and smoothstep bound their outputs', () => {
  assert.equal(clamp01(-5), 0);
  assert.equal(clamp01(5), 1);
  assert.equal(clamp01(0.25), 0.25);
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});

test('lerp and colorLerp interpolate componentwise', () => {
  assert.equal(lerp(10, 20, 0.5), 15);
  assert.deepEqual(colorLerp([0, 0, 0], [1, 0.5, 0.25], 0.5), [0.5, 0.25, 0.125]);
});
