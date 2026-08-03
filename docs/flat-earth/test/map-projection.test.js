import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  equirectUV, discUV, discToLatLon, densifyRing,
} from '../js/lib/map-projection.js';

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ±${tol}, got ${actual}`);

test('equirectUV maps the corners of the world', () => {
  const nw = equirectUV(90, -180);
  near(nw.u, 0, 1e-9, 'north-west u');
  near(nw.v, 0, 1e-9, 'north-west v');
  const se = equirectUV(-90, 180);
  near(se.u, 1, 1e-9, 'south-east u');
  near(se.v, 1, 1e-9, 'south-east v');
  const origin = equirectUV(0, 0);
  near(origin.u, 0.5, 1e-9, 'null island u');
  near(origin.v, 0.5, 1e-9, 'null island v');
});

test('discUV puts the north pole at the centre', () => {
  const p = discUV(90, 0);
  near(p.u, 0.5, 1e-9, 'north pole u');
  near(p.v, 0.5, 1e-9, 'north pole v');
});

test('discUV puts the south pole on the rim at every longitude', () => {
  // Antarctica becomes the outer edge. If this collapses to a point, the
  // projection is inverted and the flat map is upside down.
  for (const lon of [0, 90, -90, 180]) {
    const p = discUV(-90, lon);
    const r = Math.hypot(p.u - 0.5, p.v - 0.5);
    near(r, 0.5, 1e-9, `south pole radius at lon ${lon}`);
  }
});

test('discUV radius grows monotonically as latitude falls', () => {
  let last = -1;
  for (let lat = 90; lat >= -90; lat -= 10) {
    const p = discUV(lat, 0);
    const r = Math.hypot(p.u - 0.5, p.v - 0.5);
    assert.ok(r > last, `radius not increasing at lat ${lat}: ${r} <= ${last}`);
    last = r;
  }
});

test('discToLatLon round-trips discUV', () => {
  // The map painted on the disc and the distances flight-routes reports come
  // from the same projection. If this round-trip drifts, the picture and the
  // readout are using different maps.
  for (const lat of [80, 45, 0, -45, -80]) {
    for (const lon of [0, 60, -120, 179]) {
      const { u, v } = discUV(lat, lon);
      const back = discToLatLon(u, v);
      near(back.lat, lat, 1e-6, `lat round-trip at ${lat},${lon}`);
      const dLon = ((back.lon - lon + 540) % 360) - 180;
      near(dLon, 0, 1e-6, `lon round-trip at ${lat},${lon}`);
    }
  }
});

test('densifyRing bounds the step of every edge', () => {
  const ring = [[0, 0], [90, 0], [90, 60], [0, 0]];
  const dense = densifyRing(ring, 5);
  assert.ok(dense.length > ring.length, 'ring was not densified');
  for (let i = 1; i < dense.length; i += 1) {
    const step = Math.hypot(
      dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    assert.ok(step <= 5 + 1e-9, `edge ${i} spans ${step}°`);
  }
});

test('densifyRing leaves an already-fine ring alone', () => {
  const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
  assert.deepEqual(densifyRing(ring, 5), ring);
});
