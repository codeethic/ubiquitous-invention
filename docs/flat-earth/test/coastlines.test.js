import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(
  readFileSync(new URL('../data/coastlines.json', import.meta.url), 'utf8'));

test('carries its source and licence', () => {
  assert.match(data.source, /Natural Earth/);
  assert.match(data.licence, /[Pp]ublic domain/);
});

test('ring and point counts match the 110m source', () => {
  assert.ok(data.rings.length >= 120 && data.rings.length <= 140,
    `expected ~128 rings, got ${data.rings.length}`);
  const points = data.rings.reduce((n, r) => n + r.length, 0);
  assert.ok(points >= 4800 && points <= 5500,
    `expected ~5143 points, got ${points}`);
});

test('every coordinate is a plausible [lon, lat] pair', () => {
  for (const [i, ring] of data.rings.entries()) {
    assert.ok(ring.length >= 4, `ring ${i} has only ${ring.length} points`);
    for (const p of ring) {
      assert.equal(p.length, 2, `ring ${i}: point is not a pair`);
      const [lon, lat] = p;
      assert.ok(lon >= -180 && lon <= 180, `ring ${i}: longitude ${lon}`);
      assert.ok(lat >= -90 && lat <= 90, `ring ${i}: latitude ${lat}`);
    }
  }
});

test('every ring is closed', () => {
  // An unclosed ring fills as an open path and bleeds colour across the map.
  for (const [i, ring] of data.rings.entries()) {
    const a = ring[0], b = ring[ring.length - 1];
    assert.deepEqual(a, b, `ring ${i} is not closed: ${a} vs ${b}`);
  }
});

test('the data covers both hemispheres and reaches Antarctica', () => {
  // Guards against a truncated parse that silently keeps only the first
  // records — which would look fine until McMurdo sat in open ocean.
  let minLat = 90, maxLat = -90;
  for (const ring of data.rings) {
    for (const [, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  assert.ok(minLat < -60, `southernmost land is only ${minLat}`);
  assert.ok(maxLat > 70, `northernmost land is only ${maxLat}`);
});
