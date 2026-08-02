import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../js/app-state.js';

test('get returns a copy, not the live object', () => {
  const s = createState({ a: 1 });
  s.get().a = 99;
  assert.equal(s.get().a, 1);
});

test('set merges a patch and notifies subscribers', () => {
  const s = createState({ a: 1, b: 2 });
  const seen = [];
  s.subscribe(v => seen.push(v));
  s.set({ b: 3 });
  assert.deepEqual(s.get(), { a: 1, b: 3 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].b, 3);
});

test('set does not notify when nothing changed', () => {
  const s = createState({ a: 1 });
  let calls = 0;
  s.subscribe(() => { calls += 1; });
  s.set({ a: 1 });
  assert.equal(calls, 0);
});

test('reset replaces state wholesale and notifies', () => {
  const s = createState({ a: 1, b: 2 });
  const seen = [];
  s.subscribe(v => seen.push(v));
  s.reset({ c: 9 });
  assert.deepEqual(s.get(), { c: 9 });
  assert.equal(seen.length, 1);
});

test('unsubscribe stops notifications', () => {
  const s = createState({ a: 1 });
  let calls = 0;
  const off = s.subscribe(() => { calls += 1; });
  s.set({ a: 2 });
  off();
  s.set({ a: 3 });
  assert.equal(calls, 1);
});
