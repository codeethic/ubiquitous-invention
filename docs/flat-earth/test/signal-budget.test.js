import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNAL_BUDGET, OCEAN_DISPLACEMENT_M } from '../js/lib/signal-budget.js';

const MODULE_IDS = [
  'horizon', 'eratosthenes', 'midnight-sun', 'sun-size',
  'lunar-eclipse', 'southern-stars', 'flight-routes', 'time-zones',
];

test('every phenomenon module has a budget entry', () => {
  for (const id of MODULE_IDS) {
    assert.ok(SIGNAL_BUDGET[id], `no signal budget declared for "${id}"`);
  }
  assert.equal(Object.keys(SIGNAL_BUDGET).length, MODULE_IDS.length,
    'budget has entries for modules that do not exist');
});

test('every entry is fully specified', () => {
  for (const [id, e] of Object.entries(SIGNAL_BUDGET)) {
    assert.equal(typeof e.signal, 'string', `${id}.signal`);
    assert.ok(e.signal.length > 0, `${id}.signal is empty`);
    assert.equal(typeof e.unit, 'string', `${id}.unit`);
    assert.ok(Number.isFinite(e.magnitude), `${id}.magnitude not finite`);
    assert.ok(e.magnitude > 0, `${id}.magnitude must be positive`);
    assert.ok(Number.isFinite(e.maxDetail), `${id}.maxDetail not finite`);
    assert.ok(e.maxDetail >= 0, `${id}.maxDetail must not be negative`);
  }
});

test('no added detail comes within 10x of the signal it sits beside', () => {
  for (const [id, e] of Object.entries(SIGNAL_BUDGET)) {
    if (e.maxDetail === 0) continue;      // zero is always safe
    assert.ok(e.maxDetail * 10 <= e.magnitude,
      `${id}: detail ${e.maxDetail}${e.unit} is not 10x clear of ` +
      `signal ${e.magnitude}${e.unit} ("${e.signal}")`);
  }
});

test('ocean displacement is exactly zero', () => {
  // Not "small". Zero. A normal map perturbs shading only and adds no
  // geometry, so hiddenHeightM() stays exactly 3.79 m at 12 km. Any non-zero
  // value here puts wave crests taller than the entire effect the horizon
  // module exists to demonstrate.
  assert.equal(OCEAN_DISPLACEMENT_M, 0);
  assert.equal(SIGNAL_BUDGET.horizon.maxDetail, 0);
});
