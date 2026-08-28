import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './harness.mjs';

const E = loadEngine();

const events = [
  { id: 'e1', at: '2025-01-10T09:00:00Z', by: 'lori', kind: 'item.installed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.mfc.001' } },
  { id: 'e2', at: '2025-06-02T14:00:00Z', by: 'paul', kind: 'item.removed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.mfc.001', to: 'loc.repair' } },
  { id: 'e3', at: '2025-06-02T14:05:00Z', by: 'paul', kind: 'item.installed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.mfc.002' } },
];

test('itemAt returns null before the first install', () => {
  assert.equal(E.itemAt(events, 'c.gan11.o2mfc', '2024-12-01T00:00:00Z'), null);
});

test('itemAt returns the first item between install and removal', () => {
  assert.equal(E.itemAt(events, 'c.gan11.o2mfc', '2025-03-01T00:00:00Z'), 'i.mfc.001');
});

test('itemAt returns the replacement after the swap', () => {
  assert.equal(E.itemAt(events, 'c.gan11.o2mfc', '2025-08-01T00:00:00Z'), 'i.mfc.002');
});

test('itemAt is inclusive of the install instant', () => {
  assert.equal(E.itemAt(events, 'c.gan11.o2mfc', '2025-01-10T09:00:00Z'), 'i.mfc.001');
});

test('stateAt collects open issues and drops closed ones', () => {
  const evs = [
    { id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
      targetId: 'c.gan11.o2mfc', payload: { text: 'MFC reads high' } },
    { id: 'b', at: '2025-03-01T00:00:00Z', by: 'lori', kind: 'issue.closed',
      targetId: 'c.gan11.o2mfc', payload: { issueId: 'a' } },
  ];
  assert.equal(E.stateAt(evs, '2025-02-15T00:00:00Z').openIssues.length, 1);
  assert.equal(E.stateAt(evs, '2025-03-15T00:00:00Z').openIssues.length, 0);
});

test('stateAt tags an open issue with the item installed at that moment', () => {
  const evs = [
    events[0],
    { id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
      targetId: 'c.gan11.o2mfc', payload: { text: 'MFC reads high' } },
  ];
  assert.equal(E.stateAt(evs, '2025-02-15T00:00:00Z').openIssues[0].itemId, 'i.mfc.001');
});

test('stateAt ignores events after the requested date', () => {
  assert.equal(
    Object.keys(E.stateAt(events, '2024-01-01T00:00:00Z').installed).length, 0);
});
