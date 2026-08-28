import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './harness.mjs';

const E = loadEngine();

const entities = {
  't.gan11':       { id: 't.gan11', kind: 'tool', name: 'GaN 11', parentId: null },
  't.gan13':       { id: 't.gan13', kind: 'tool', name: 'GaN 13', parentId: null },
  's.gan11.gas':   { id: 's.gan11.gas', kind: 'subsystem', name: 'Gas Panel', parentId: 't.gan11' },
  's.gan13.gas':   { id: 's.gan13.gas', kind: 'subsystem', name: 'Gas Panel', parentId: 't.gan13' },
  'c.gan11.o2mfc': { id: 'c.gan11.o2mfc', kind: 'component', name: 'O2 MFC', parentId: 's.gan11.gas' },
  'c.gan13.o2mfc': { id: 'c.gan13.o2mfc', kind: 'component', name: 'O2 MFC', parentId: 's.gan13.gas' },

  'pn.mfc200o2': { id: 'pn.mfc200o2', kind: 'partNumber', pn: 'KY-MFC-200-O2',
                   compatibleComponentIds: ['c.gan11.o2mfc', 'c.gan13.o2mfc'] },
  'pn.valve':    { id: 'pn.valve', kind: 'partNumber', pn: 'KY-TV-100',
                   compatibleComponentIds: [] },

  'i.stored':  { id: 'i.stored', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-300',
                 partNumberId: 'pn.mfc200o2', mfc: { type: '1400', gas: 'O2', sccm: 200 } },
  'i.ontool':  { id: 'i.ontool', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-200',
                 partNumberId: 'pn.mfc200o2', mfc: { type: '1100', gas: 'O2', sccm: 200 } },
  'i.onorder': { id: 'i.onorder', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-100',
                 partNumberId: 'pn.mfc200o2', mfc: { type: 'G-series', gas: 'O2', sccm: 200 } },
  'i.wrongpn': { id: 'i.wrongpn', kind: 'item', name: 'Throttle Valve', serial: 'S-999',
                 partNumberId: 'pn.valve' },
  'i.bigmfc':  { id: 'i.bigmfc', kind: 'item', name: '2 slm N2 MFC', serial: 'S-400',
                 partNumberId: 'pn.mfc200o2', mfc: { type: '1400', gas: 'N2', sccm: 2000 } },
};

const evs = [
  { id: 'x1', at: '2025-01-01T00:00:00Z', by: 'lori', kind: 'item.received',
    targetId: 'i.stored', payload: { to: 'loc.storage' } },
  { id: 'x2', at: '2025-01-01T00:00:00Z', by: 'lori', kind: 'item.installed',
    targetId: 'c.gan13.o2mfc', payload: { itemId: 'i.ontool' } },
  { id: 'x3', at: '2025-01-01T00:00:00Z', by: 'lori', kind: 'item.shipped',
    targetId: 'i.onorder', payload: { to: 'loc.onorder', leadTimeDays: 21 } },
  { id: 'x4', at: '2025-01-01T00:00:00Z', by: 'lori', kind: 'item.received',
    targetId: 'i.bigmfc', payload: { to: 'loc.storage' } },
];

const AT = '2025-06-01T00:00:00Z';

test('candidates exclude items whose part number is not compatible', () => {
  const c = E.replacementCandidates(entities, evs, 'c.gan11.o2mfc', AT);
  assert.ok(!c.some(x => x.itemId === 'i.wrongpn'));
});

test('candidates sort in-storage first, then on-tool, then on-order', () => {
  const c = E.replacementCandidates(entities, evs, 'c.gan11.o2mfc', AT);
  assert.deepEqual(c.map(x => x.locationKind),
    ['storage', 'storage', 'tool', 'onorder']);
});

test('an on-tool candidate names the tool it is currently installed on', () => {
  const c = E.replacementCandidates(entities, evs, 'c.gan11.o2mfc', AT);
  assert.equal(c.find(x => x.itemId === 'i.ontool').locationLabel, 'GaN 13');
});

test('an on-order candidate carries its lead time', () => {
  const c = E.replacementCandidates(entities, evs, 'c.gan11.o2mfc', AT);
  assert.equal(c.find(x => x.itemId === 'i.onorder').leadTimeDays, 21);
});

test('the item already installed is not offered as its own replacement', () => {
  const withInstall = [...evs, {
    id: 'x5', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'item.installed',
    targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.stored' },
  }];
  const c = E.replacementCandidates(entities, withInstall, 'c.gan11.o2mfc', AT);
  assert.ok(!c.some(x => x.itemId === 'i.stored'));
});

test('MFC filters combine with AND across categories', () => {
  const r = E.filterMFCs(entities, evs, { gas: ['O2'], type: ['1400'] }, AT);
  assert.deepEqual(r.map(i => i.id), ['i.stored']);
});

test('MFC filters accept multiple values within one category as OR', () => {
  const r = E.filterMFCs(entities, evs, { type: ['1400', 'G-series'] }, AT);
  assert.deepEqual(new Set(r.map(i => i.id)),
    new Set(['i.stored', 'i.onorder', 'i.bigmfc']));
});

test('MFC size filter respects an inclusive range', () => {
  const r = E.filterMFCs(entities, evs, { sccmMin: 100, sccmMax: 200 }, AT);
  assert.deepEqual(r.map(i => i.id).sort(),
    ['i.onorder', 'i.ontool', 'i.stored']);
});

test('an empty filter returns every MFC', () => {
  assert.equal(E.filterMFCs(entities, evs, {}, AT).length, 4);
});

// A removed item's destination rides on the item.removed event, which targets
// the component rather than the item. Reading only shipping and receiving
// events loses it, and the item wrongly reports its previous location.
test('an item removed to repair reports as out for repair, not its old location', () => {
  const withSwap = [...evs, {
    id: 'x6', at: '2025-03-01T00:00:00Z', by: 'paul', kind: 'item.removed',
    targetId: 'c.gan13.o2mfc', payload: { itemId: 'i.ontool', to: 'loc.repair' },
  }];
  const loc = E.locationOf(entities, withSwap, 'i.ontool', AT);
  assert.equal(loc.locationKind, 'repair');
});

test('an item removed to storage becomes an in-storage candidate again', () => {
  const withSwap = [...evs, {
    id: 'x7', at: '2025-03-01T00:00:00Z', by: 'paul', kind: 'item.removed',
    targetId: 'c.gan13.o2mfc', payload: { itemId: 'i.ontool', to: 'loc.storage' },
  }];
  const c = E.replacementCandidates(entities, withSwap, 'c.gan11.o2mfc', AT);
  assert.equal(c.find(x => x.itemId === 'i.ontool').locationKind, 'storage');
});

test('an item still installed ignores an earlier removal from another slot', () => {
  const readded = [...evs,
    { id: 'x8', at: '2025-02-01T00:00:00Z', by: 'paul', kind: 'item.removed',
      targetId: 'c.gan13.o2mfc', payload: { itemId: 'i.ontool', to: 'loc.repair' } },
    { id: 'x9', at: '2025-02-05T00:00:00Z', by: 'paul', kind: 'item.installed',
      targetId: 'c.gan13.o2mfc', payload: { itemId: 'i.ontool' } }];
  assert.equal(E.locationOf(entities, readded, 'i.ontool', AT).locationKind, 'tool');
});
