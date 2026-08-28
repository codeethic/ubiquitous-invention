import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './harness.mjs';

const E = loadEngine();

const entities = {
  't.gan11':       { id: 't.gan11', kind: 'tool', name: 'GaN 11', parentId: null },
  's.gan11.gas':   { id: 's.gan11.gas', kind: 'subsystem', name: 'Gas Panel', parentId: 't.gan11' },
  'c.gan11.o2mfc': { id: 'c.gan11.o2mfc', kind: 'component', name: 'O2 MFC', parentId: 's.gan11.gas' },
};

const evs = [
  { id: 'e1', at: '2025-01-10T09:00:00Z', by: 'lori', kind: 'item.installed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.mfc.001' } },
  { id: 'e2', at: '2025-02-01T10:00:00Z', by: 'lori', kind: 'issue.opened',
    targetId: 'c.gan11.o2mfc', payload: { text: 'MFC reads high' } },
  { id: 'e3', at: '2025-06-02T14:00:00Z', by: 'paul', kind: 'item.removed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.mfc.001', to: 'loc.repair' } },
  { id: 'e4', at: '2025-06-02T14:05:00Z', by: 'paul', kind: 'item.installed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.mfc.002' } },
];

test('logFor on a tool includes descendant events', () => {
  assert.equal(E.logFor(entities, evs, 't.gan11', {}).length, 4);
});

test('logFor returns newest first', () => {
  const rows = E.logFor(entities, evs, 't.gan11', {});
  assert.ok(rows[0].at > rows[rows.length - 1].at);
});

test('logFor classifies an issue row', () => {
  const rows = E.logFor(entities, evs, 'c.gan11.o2mfc', {});
  assert.equal(rows.find(r => r.at === '2025-02-01T10:00:00Z').kind, 'issue');
});

test('logFor honours a date range', () => {
  const rows = E.logFor(entities, evs, 't.gan11',
    { from: '2025-05-01T00:00:00Z', to: '2025-12-31T00:00:00Z' });
  assert.equal(rows.length, 2);
});

test('changesBetween reports the swap with both serials', () => {
  const ch = E.changesBetween(entities, evs, 't.gan11',
    '2025-03-01T00:00:00Z', '2025-08-01T00:00:00Z');
  assert.equal(ch.length, 1);
  assert.equal(ch[0].componentId, 'c.gan11.o2mfc');
  assert.equal(ch[0].fromItemId, 'i.mfc.001');
  assert.equal(ch[0].toItemId, 'i.mfc.002');
});

test('changesBetween is empty when nothing moved', () => {
  assert.deepEqual(E.changesBetween(entities, evs, 't.gan11',
    '2025-02-01T00:00:00Z', '2025-03-01T00:00:00Z'), []);
});

test('an event attaches to the item installed at that moment, not a later one', () => {
  assert.equal(E.stateAt(evs, '2025-03-01T00:00:00Z').openIssues[0].itemId, 'i.mfc.001');
  assert.equal(E.stateAt(evs, '2025-07-01T00:00:00Z').openIssues[0].itemId, 'i.mfc.001',
    'the issue keeps the item it was raised against');
});

test('an install row names the item that moved', () => {
  const withItems = {
    ...entities,
    'i.mfc.001': { id: 'i.mfc.001', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-200' },
    'i.mfc.002': { id: 'i.mfc.002', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-300' },
  };
  const rows = E.logFor(withItems, evs, 'c.gan11.o2mfc', {});
  const install = rows.find(r => r.at === '2025-06-02T14:05:00Z');
  assert.match(install.details, /S-300/);
});

test('a removal row names both the item and where it went', () => {
  const withItems = {
    ...entities,
    'i.mfc.001': { id: 'i.mfc.001', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-200' },
  };
  const rows = E.logFor(withItems, evs, 'c.gan11.o2mfc', {});
  const removal = rows.find(r => r.at === '2025-06-02T14:00:00Z');
  assert.match(removal.details, /S-200/);
  assert.match(removal.comment, /repair/i);
});

test('a work order can reference more than one issue', () => {
  const wo = [{ id: 'w1', at: '2025-03-01T00:00:00Z', by: 'paul', kind: 'wo.opened',
                targetId: 'c.gan11.o2mfc',
                payload: { text: 'swap MFC', issueIds: ['e2', 'x9'] } }];
  const st = E.stateAt([...evs, ...wo], '2025-04-01T00:00:00Z');
  assert.deepEqual(st.openWOs[0].issueIds, ['e2', 'x9']);
});
