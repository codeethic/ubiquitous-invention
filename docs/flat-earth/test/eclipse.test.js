import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sphereShadowAxesKm, discShadowAxesKm, shadowEdgeCurvaturePerKm,
} from '../js/physics/eclipse.js';

test('a sphere casts the same circular shadow from every orientation', () => {
  const c0 = shadowEdgeCurvaturePerKm(sphereShadowAxesKm(0));
  for (const o of [15, 45, 80, 120]) {
    assert.equal(shadowEdgeCurvaturePerKm(sphereShadowAxesKm(o)), c0);
  }
});

test('a disc shadow degenerates as it turns edge-on', () => {
  const face = discShadowAxesKm(0);
  const edge = discShadowAxesKm(80);
  assert.equal(face.a, face.b);            // circular only when face-on
  assert.ok(edge.b < edge.a / 5);
});

test('disc shadow curvature varies by more than an order of magnitude', () => {
  const ratio = shadowEdgeCurvaturePerKm(discShadowAxesKm(80))
    / shadowEdgeCurvaturePerKm(discShadowAxesKm(0));
  assert.ok(ratio > 10, `expected >10x variation, got ${ratio}`);
});
