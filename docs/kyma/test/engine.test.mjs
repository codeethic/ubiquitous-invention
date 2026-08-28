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

// --- seed ----------------------------------------------------------------

const S = E.SEED;

test('SEED covers ten tools', () => {
  assert.equal(Object.values(S.entities).filter(e => e.kind === 'tool').length, 10);
});

test('GaN 11 has the seven subsystems from the deck dropdown', () => {
  const subs = Object.values(S.entities)
    .filter(e => e.kind === 'subsystem' && e.parentId === 't.gan11')
    .map(e => e.name).sort();
  assert.deepEqual(subs, ['Controls', 'Electric', 'Exhaust', 'Flanging',
                          'Furnace Assembly', 'Gas Panel', 'Motion']);
});

test('the gas panel has twelve populated MFC lines', () => {
  const lines = Object.values(S.entities)
    .filter(e => e.kind === 'component' && e.parentId === 's.gan11.gaspanel' && !e.empty);
  assert.equal(lines.length, 12);
});

test('the gas panel keeps its spare slots visible', () => {
  const spares = Object.values(S.entities)
    .filter(e => e.kind === 'component' && e.parentId === 's.gan11.gaspanel' && e.empty);
  assert.ok(spares.length >= 1);
});

test('the O2 line is the 200 sccm example from the deck', () => {
  const installed = E.itemAt(S.events, 'c.gan11.mfc.o2', S.today);
  const item = S.entities[installed];
  assert.equal(item.mfc.sccm, 200);
  assert.equal(item.mfc.gas, 'O2');
});

test('seed history spans at least eighteen months', () => {
  const ats = S.events.map(e => e.at).sort();
  const months = (Date.parse(ats[ats.length - 1]) - Date.parse(ats[0])) / 86400000 / 30.44;
  assert.ok(months >= 18, `only ${months.toFixed(1)} months of history`);
});

test('seed is deterministic across two loads', () => {
  assert.deepEqual(loadEngine().SEED.events, S.events);
});

test('every event targets a known entity', () => {
  for (const ev of S.events) {
    assert.ok(S.entities[ev.targetId], `unknown target ${ev.targetId} on ${ev.id}`);
  }
});

test('every event has an author', () => {
  for (const ev of S.events) assert.ok(ev.by, `no author on ${ev.id}`);
});

test('GaN 11 is amber today, so the demo opens on something interesting', () => {
  assert.equal(E.healthOf(S.entities, S.events, 't.gan11', S.today), 'amber');
});

test('at least one tool is red today', () => {
  const reds = Object.values(S.entities)
    .filter(e => e.kind === 'tool')
    .filter(t => E.healthOf(S.entities, S.events, t.id, S.today) === 'red');
  assert.ok(reds.length >= 1);
});

test('the O2 MFC was swapped at some point, so time travel has something to show', () => {
  const ch = E.changesBetween(S.entities, S.events, 't.gan11',
    S.events[0].at, S.today);
  assert.ok(ch.some(c => c.componentId === 'c.gan11.mfc.o2'));
});

test('throttle valves exist on more than one HVPE tool for cross-tool history', () => {
  const tv = Object.values(S.entities)
    .filter(e => e.kind === 'component' && e.name === 'Throttle Valve');
  assert.ok(tv.length >= 4, `only ${tv.length} throttle valves`);
});
