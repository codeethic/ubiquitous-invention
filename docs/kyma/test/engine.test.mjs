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

// --- health rollup -------------------------------------------------------

const entities = {
  't.gan11':       { id: 't.gan11', kind: 'tool', name: 'GaN 11', parentId: null },
  's.gan11.gas':   { id: 's.gan11.gas', kind: 'subsystem', name: 'Gas Panel', parentId: 't.gan11' },
  'c.gan11.o2mfc': { id: 'c.gan11.o2mfc', kind: 'component', name: 'O2 MFC', parentId: 's.gan11.gas' },
  's.gan11.exh':   { id: 's.gan11.exh', kind: 'subsystem', name: 'Exhaust', parentId: 't.gan11' },
};

const issueOnMFC = [{
  id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
  targetId: 'c.gan11.o2mfc', payload: { text: 'reads high' },
}];

test('descendantsOf walks the whole subtree, including self', () => {
  assert.deepEqual(new Set(E.descendantsOf(entities, 't.gan11')),
    new Set(['t.gan11', 's.gan11.gas', 'c.gan11.o2mfc', 's.gan11.exh']));
});

test('healthOf is green with no events', () => {
  assert.equal(E.healthOf(entities, [], 't.gan11', '2025-06-01T00:00:00Z'), 'green');
});

test('an issue on a component rolls up to subsystem and tool', () => {
  const at = '2025-03-01T00:00:00Z';
  assert.equal(E.healthOf(entities, issueOnMFC, 'c.gan11.o2mfc', at), 'amber');
  assert.equal(E.healthOf(entities, issueOnMFC, 's.gan11.gas', at), 'amber');
  assert.equal(E.healthOf(entities, issueOnMFC, 't.gan11', at), 'amber');
});

test('a sibling subsystem stays green', () => {
  assert.equal(E.healthOf(entities, issueOnMFC, 's.gan11.exh', '2025-03-01T00:00:00Z'), 'green');
});

test('health returns to green when the last issue closes', () => {
  const evs = [...issueOnMFC,
    { id: 'b', at: '2025-04-01T00:00:00Z', by: 'lori', kind: 'issue.closed',
      targetId: 'c.gan11.o2mfc', payload: { issueId: 'a' } }];
  assert.equal(E.healthOf(entities, evs, 't.gan11', '2025-05-01T00:00:00Z'), 'green');
});

test('a down tool is red and outranks an open issue', () => {
  const evs = [...issueOnMFC,
    { id: 'b', at: '2025-02-02T00:00:00Z', by: 'paul', kind: 'state.changed',
      targetId: 't.gan11', payload: { state: 'down' } }];
  assert.equal(E.healthOf(entities, evs, 't.gan11', '2025-03-01T00:00:00Z'), 'red');
});

test('an open work order alone is enough for amber', () => {
  const evs = [{ id: 'w', at: '2025-02-01T00:00:00Z', by: 'paul', kind: 'wo.opened',
                 targetId: 's.gan11.exh', payload: { text: 'trap rebuild' } }];
  assert.equal(E.healthOf(entities, evs, 't.gan11', '2025-03-01T00:00:00Z'), 'amber');
});
