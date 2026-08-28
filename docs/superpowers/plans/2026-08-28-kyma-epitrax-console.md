# EpiTrax Maintenance Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained single-page POC of Kyma Technologies' proposed EpiTrax maintenance and spare-parts system, published at `/kyma/`.

**Architecture:** One HTML file. All domain logic lives in a single `<script id="engine">` block that publishes a pure-function API on `globalThis.EpiTrax`; the UI is a second script that renders from it. State is an append-only event log over stable synthetic IDs — upward health rollup, durable history, and date-scrubbing time travel are all derived from it rather than stored. User actions append to a `localStorage` overlay on top of a frozen seed.

**Tech Stack:** Vanilla HTML/CSS/JS, no dependencies, no build step. Google Fonts (Oswald / IBM Plex Sans / IBM Plex Mono) matching the sibling `bite7` console. Tests: `node:test` + `node:vm`, extracting the engine script out of the HTML.

**Spec:** `docs/superpowers/specs/2026-08-28-kyma-epitrax-console-design.md`

## Global Constraints

- **Output is one self-contained file:** `docs/kyma/index.html`. No external assets, no CDN scripts beyond the Google Fonts stylesheet. Images embed as base64 data URIs.
- **Nothing under `docs/kyma/documentation/` may ever publish.** It is internal Kyma material. `_config.yml` must exclude it.
- **Seed data is deterministic.** No `Math.random()`, no `Date.now()` in seed construction. The page must render identically on every load.
- **Health colours, from the deck's own shape fills:** green `#00B050` (up, no issues), amber `#FFC000` (up, open issue or WO), red `#C00000` (down / decommissioned / qual / PM). A tool tile also shows its state as text, because red covers four states.
- **The users' layouts are reproduced, not redesigned.** Slides 18 and 19 have extracted geometry; follow it.
- **Vocabulary comes from the decks.** Run IDs `AG####`, work orders `M#####`, growth runs like `23-AFRL-Ga2O3`, wafers like `D5409-01`, boules like `KT0001`.
- **The engine script must be side-effect free at load.** It defines `globalThis.EpiTrax` and nothing else, so `node:vm` can run it without a DOM.

## Deviation from the spec

The spec settled for an in-page `?test=1` harness on the grounds that a self-contained file rules out `node:test`. It does not: the test file reads `index.html`, extracts the `<script id="engine">` body by regex, and runs it in a `vm` context. This has been verified working on node v24. Real test files replace the in-page harness; `?test=1` is not built.

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/kyma/index.html` | Create. The entire POC — styles, engine, seed, UI. |
| `docs/kyma/test/harness.mjs` | Create. Extracts the engine from the HTML into a `vm` context; exports `loadEngine()`. |
| `docs/kyma/test/engine.test.mjs` | Create. Event-log core: `stateAt`, `itemAt`, `healthOf`. |
| `docs/kyma/test/inventory.test.mjs` | Create. `replacementCandidates`, `filterMFCs`. |
| `docs/kyma/test/history.test.mjs` | Create. `logFor`, `changesBetween`, issue↔WO linkage. |
| `docs/_config.yml` | Modify. Exclude `kyma/test`, `kyma/documentation`. |

Rationale for three test files rather than one: they map to the three independent claims the POC makes — state derivation, inventory logic, and history. A reviewer can reject one without the others.

## Engine API

Every later task depends on these exact names. Defined in Tasks 1–5.

```js
globalThis.EpiTrax = {
  SEED,                                  // { entities, events, today } — frozen
  createStore(storage),                  // -> { events(), append(e), reset() }

  // events-first: these need no entity map
  stateAt(events, iso),                  // -> { installed, openIssues, openWOs, toolStates }
  itemAt(events, componentId, iso),      // -> itemId | null

  // entities-first: these walk the hierarchy
  descendantsOf(entities, entityId),                          // -> [entityId], includes self
  healthOf(entities, events, entityId, iso),                  // -> 'green' | 'amber' | 'red'
  logFor(entities, events, entityId, opts),                   // -> [{ at, kind, info, details, comment, by }]
  changesBetween(entities, events, entityId, from, to),       // -> [{ componentId, fromItemId, toItemId, at }]
  replacementCandidates(entities, events, componentId, iso),  // -> [{ itemId, locationKind, ... }]
  filterMFCs(entities, events, filters, iso),                 // -> [item]
};
```

**Argument order is a rule, not a coincidence:** anything that walks the entity
hierarchy takes `entities` first; anything that only replays the log takes
`events` first. Follow it — mismatched call sites are the most likely bug in
this plan.

`stateAt` return shape:

```js
{
  installed:   { [componentId]: itemId | null },
  openIssues:  [{ id, targetId, itemId, text, at, by }],
  openWOs:     [{ id, targetId, text, at, by, issueIds: [] }],
  toolStates:  { [toolId]: 'up' | 'down' | 'decommissioned' | 'qual' | 'pm' },
}
```

---

### Task 1: Test harness and the event-log core

**Files:**
- Create: `docs/kyma/index.html`
- Create: `docs/kyma/test/harness.mjs`
- Create: `docs/kyma/test/engine.test.mjs`
- Modify: `docs/_config.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `EpiTrax.stateAt`, `EpiTrax.itemAt`, and the `<script id="engine">` extraction contract every later test relies on.

- [ ] **Step 1: Add the build exclusions**

In `docs/_config.yml`, under `exclude:`, append:

```yaml
  # Kyma POC test scaffolding; the console itself publishes normally.
  - kyma/test
  # Internal Kyma source decks — must never publish.
  - kyma/documentation
```

- [ ] **Step 2: Create the HTML skeleton with an empty engine**

`docs/kyma/index.html`:

```html
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EpiTrax Maintenance Console — Prototype</title>
<script id="engine">
globalThis.EpiTrax = (() => {
  return {};
})();
</script>
<body></body>
```

- [ ] **Step 3: Write the extraction harness**

`docs/kyma/test/harness.mjs`:

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadEngine() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script id="engine"> block found in index.html');
  const ctx = vm.createContext({});
  vm.runInContext(m[1], ctx);
  if (!ctx.EpiTrax) throw new Error('engine did not define globalThis.EpiTrax');
  return ctx.EpiTrax;
}
```

- [ ] **Step 4: Write the failing tests for `itemAt` and `stateAt`**

`docs/kyma/test/engine.test.mjs`:

```js
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
```

- [ ] **Step 5: Run the tests and confirm they fail**

Run: `node --test docs/kyma/test/engine.test.mjs`
Expected: FAIL — `E.itemAt is not a function`.

- [ ] **Step 6: Implement `itemAt` and `stateAt` in the engine block**

Inside the `<script id="engine">` IIFE, before the `return`:

```js
const upto = (events, iso) =>
  events.filter(e => e.at <= iso).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

function itemAt(events, componentId, iso) {
  let current = null;
  for (const e of upto(events, iso)) {
    if (e.targetId !== componentId) continue;
    if (e.kind === 'item.installed') current = e.payload.itemId;
    if (e.kind === 'item.removed') current = null;
  }
  return current;
}

function stateAt(events, iso) {
  const installed = {}, issues = new Map(), wos = new Map(), toolStates = {};
  for (const e of upto(events, iso)) {
    switch (e.kind) {
      case 'item.installed': installed[e.targetId] = e.payload.itemId; break;
      case 'item.removed':   installed[e.targetId] = null; break;
      case 'issue.opened':
        issues.set(e.id, { id: e.id, targetId: e.targetId, text: e.payload.text,
                           at: e.at, by: e.by, itemId: installed[e.targetId] ?? null });
        break;
      case 'issue.closed':   issues.delete(e.payload.issueId); break;
      case 'wo.opened':
        wos.set(e.id, { id: e.id, targetId: e.targetId, text: e.payload.text,
                        at: e.at, by: e.by, issueIds: e.payload.issueIds ?? [] });
        break;
      case 'wo.closed':      wos.delete(e.payload.woId); break;
      case 'state.changed':  toolStates[e.targetId] = e.payload.state; break;
    }
  }
  for (const k of Object.keys(installed)) if (installed[k] === null) delete installed[k];
  return { installed, openIssues: [...issues.values()], openWOs: [...wos.values()], toolStates };
}
```

Add `itemAt` and `stateAt` to the returned object.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `node --test docs/kyma/test/engine.test.mjs`
Expected: PASS, 7/7.

- [ ] **Step 8: Commit**

```bash
git add docs/kyma/index.html docs/kyma/test/ docs/_config.yml
git commit -m "Add EpiTrax engine skeleton with event-log state derivation"
```

---

### Task 2: Health rollup

**Files:**
- Modify: `docs/kyma/index.html` (engine block)
- Modify: `docs/kyma/test/engine.test.mjs`

**Interfaces:**
- Consumes: `stateAt` from Task 1.
- Produces: `EpiTrax.descendantsOf(entities, entityId)`, `EpiTrax.healthOf(events, entityId, iso)`. Entities are a flat map `{ [id]: { id, kind, name, parentId } }` where `kind` is one of `tool | subsystem | component`.

- [ ] **Step 1: Write the failing tests**

Append to `docs/kyma/test/engine.test.mjs`:

```js
const entities = {
  't.gan11':        { id: 't.gan11', kind: 'tool', name: 'GaN 11', parentId: null },
  's.gan11.gas':    { id: 's.gan11.gas', kind: 'subsystem', name: 'Gas Panel', parentId: 't.gan11' },
  'c.gan11.o2mfc':  { id: 'c.gan11.o2mfc', kind: 'component', name: 'O2 MFC', parentId: 's.gan11.gas' },
  's.gan11.exh':    { id: 's.gan11.exh', kind: 'subsystem', name: 'Exhaust', parentId: 't.gan11' },
};

test('descendantsOf walks the whole subtree, including self', () => {
  const d = E.descendantsOf(entities, 't.gan11');
  assert.deepEqual(new Set(d),
    new Set(['t.gan11', 's.gan11.gas', 'c.gan11.o2mfc', 's.gan11.exh']));
});

test('healthOf is green with no events', () => {
  assert.equal(E.healthOf(entities, [], 't.gan11', '2025-06-01T00:00:00Z'), 'green');
});

test('an issue on a component rolls up to subsystem and tool', () => {
  const evs = [{ id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
                 targetId: 'c.gan11.o2mfc', payload: { text: 'reads high' } }];
  const at = '2025-03-01T00:00:00Z';
  assert.equal(E.healthOf(entities, evs, 'c.gan11.o2mfc', at), 'amber');
  assert.equal(E.healthOf(entities, evs, 's.gan11.gas', at), 'amber');
  assert.equal(E.healthOf(entities, evs, 't.gan11', at), 'amber');
});

test('a sibling subsystem stays green', () => {
  const evs = [{ id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
                 targetId: 'c.gan11.o2mfc', payload: { text: 'reads high' } }];
  assert.equal(E.healthOf(entities, evs, 's.gan11.exh', '2025-03-01T00:00:00Z'), 'green');
});

test('health returns to green when the last issue closes', () => {
  const evs = [
    { id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
      targetId: 'c.gan11.o2mfc', payload: { text: 'reads high' } },
    { id: 'b', at: '2025-04-01T00:00:00Z', by: 'lori', kind: 'issue.closed',
      targetId: 'c.gan11.o2mfc', payload: { issueId: 'a' } },
  ];
  assert.equal(E.healthOf(entities, evs, 't.gan11', '2025-05-01T00:00:00Z'), 'green');
});

test('a down tool is red and outranks an open issue', () => {
  const evs = [
    { id: 'a', at: '2025-02-01T00:00:00Z', by: 'lori', kind: 'issue.opened',
      targetId: 'c.gan11.o2mfc', payload: { text: 'reads high' } },
    { id: 'b', at: '2025-02-02T00:00:00Z', by: 'paul', kind: 'state.changed',
      targetId: 't.gan11', payload: { state: 'down' } },
  ];
  assert.equal(E.healthOf(entities, evs, 't.gan11', '2025-03-01T00:00:00Z'), 'red');
});

test('an open work order alone is enough for amber', () => {
  const evs = [{ id: 'w', at: '2025-02-01T00:00:00Z', by: 'paul', kind: 'wo.opened',
                 targetId: 's.gan11.exh', payload: { text: 'trap rebuild' } }];
  assert.equal(E.healthOf(entities, evs, 't.gan11', '2025-03-01T00:00:00Z'), 'amber');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test docs/kyma/test/engine.test.mjs`
Expected: FAIL — `E.descendantsOf is not a function`.

- [ ] **Step 3: Implement**

```js
function descendantsOf(entities, entityId) {
  const out = [entityId];
  for (const e of Object.values(entities)) {
    if (e.parentId === entityId) out.push(...descendantsOf(entities, e.id));
  }
  return out;
}

const RED_STATES = new Set(['down', 'decommissioned', 'qual', 'pm']);

function healthOf(entities, events, entityId, iso) {
  const st = stateAt(events, iso);
  const scope = new Set(descendantsOf(entities, entityId));
  for (const id of scope) if (RED_STATES.has(st.toolStates[id])) return 'red';
  const open = [...st.openIssues, ...st.openWOs];
  return open.some(o => scope.has(o.targetId)) ? 'amber' : 'green';
}
```

Note the signature takes `entities` first; keep that order everywhere.

- [ ] **Step 4: Run and confirm all pass**

Run: `node --test docs/kyma/test/engine.test.mjs`
Expected: PASS, 14/14.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html docs/kyma/test/engine.test.mjs
git commit -m "Add upward health rollup with red-outranks-amber precedence"
```

---

### Task 3: History — logs, diffs, and issue-to-WO linkage

**Files:**
- Modify: `docs/kyma/index.html` (engine block)
- Create: `docs/kyma/test/history.test.mjs`

**Interfaces:**
- Consumes: `stateAt`, `descendantsOf`.
- Produces: `EpiTrax.logFor(entities, events, entityId, opts)` returning newest-first rows `{ at, kind, info, details, comment, by }` where `kind` is one of `run | maint | issue | state | comment`; `EpiTrax.changesBetween(entities, events, entityId, from, to)`.

- [ ] **Step 1: Write the failing tests**

`docs/kyma/test/history.test.mjs`:

```js
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
  const rows = E.logFor(entities, evs, 't.gan11', {});
  assert.equal(rows.length, 4);
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
  const ch = E.changesBetween(entities, evs, 't.gan11',
    '2025-02-01T00:00:00Z', '2025-03-01T00:00:00Z');
  assert.deepEqual(ch, []);
});

test('an event attaches to the item installed at that moment, not a later one', () => {
  const st = E.stateAt(evs, '2025-03-01T00:00:00Z');
  assert.equal(st.openIssues[0].itemId, 'i.mfc.001');
  const later = E.stateAt(evs, '2025-07-01T00:00:00Z');
  assert.equal(later.openIssues[0].itemId, 'i.mfc.001',
    'the issue keeps the item it was raised against');
});

test('a work order can reference more than one issue', () => {
  const wo = [{ id: 'w1', at: '2025-03-01T00:00:00Z', by: 'paul', kind: 'wo.opened',
                targetId: 'c.gan11.o2mfc', payload: { text: 'swap MFC', issueIds: ['e2', 'x9'] } }];
  const st = E.stateAt([...evs, ...wo], '2025-04-01T00:00:00Z');
  assert.deepEqual(st.openWOs[0].issueIds, ['e2', 'x9']);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test docs/kyma/test/history.test.mjs`
Expected: FAIL — `E.logFor is not a function`.

- [ ] **Step 3: Implement**

```js
const KIND_MAP = {
  'run.recorded': 'run', 'wo.opened': 'maint', 'wo.closed': 'maint',
  'wo.commented': 'maint', 'issue.opened': 'issue', 'issue.closed': 'issue',
  'issue.commented': 'issue', 'state.changed': 'state', 'comment.added': 'comment',
  'item.installed': 'maint', 'item.removed': 'maint',
  'item.shipped': 'maint', 'item.received': 'maint',
};

function logFor(entities, events, entityId, opts = {}) {
  const scope = new Set(descendantsOf(entities, entityId));
  return events
    .filter(e => scope.has(e.targetId))
    .filter(e => (!opts.from || e.at >= opts.from) && (!opts.to || e.at <= opts.to))
    .map(e => ({
      at: e.at,
      kind: KIND_MAP[e.kind] ?? 'comment',
      info: e.payload.info ?? e.kind,
      details: e.payload.text ?? e.payload.details ?? '',
      comment: e.payload.comment ?? '',
      by: e.by,
      raw: e,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function changesBetween(entities, events, entityId, from, to) {
  const scope = descendantsOf(entities, entityId)
    .filter(id => entities[id]?.kind === 'component');
  const out = [];
  for (const componentId of scope) {
    const before = itemAt(events, componentId, from);
    const after = itemAt(events, componentId, to);
    if (before !== after) {
      const swap = upto(events, to).filter(
        e => e.targetId === componentId && e.kind === 'item.installed' && e.at > from).pop();
      out.push({ componentId, fromItemId: before, toItemId: after, at: swap?.at ?? to });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `node --test docs/kyma/test/history.test.mjs`
Expected: PASS, 8/8.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html docs/kyma/test/history.test.mjs
git commit -m "Add entity logs, time-travel diffs, and issue-to-WO linkage"
```

---

### Task 4: Inventory — replacement candidates and MFC filters

**Files:**
- Modify: `docs/kyma/index.html` (engine block)
- Create: `docs/kyma/test/inventory.test.mjs`

**Interfaces:**
- Consumes: `itemAt`, `stateAt`.
- Produces: `EpiTrax.replacementCandidates(entities, events, componentId, iso)` and `EpiTrax.filterMFCs(entities, events, filters, iso)`.

Item entities carry `{ id, kind: 'item', name, partNumberId, serial, mfc?: { type, gas, sccm } }`. Part numbers carry `{ id, kind: 'partNumber', pn, compatibleComponentIds: [] }`. Location is derived: an item installed at a component is on that tool; otherwise its last `item.shipped`/`item.received` event sets `loc.storage`, `loc.repair`, or `loc.onorder`.

Candidate sort order is **in-storage, then on another tool, then on order** — the deck is explicit. Within a group, sort by serial for determinism.

- [ ] **Step 1: Write the failing tests**

`docs/kyma/test/inventory.test.mjs`:

```js
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
  'pn.mfc200o2':   { id: 'pn.mfc200o2', kind: 'partNumber', pn: 'KY-MFC-200-O2',
                     compatibleComponentIds: ['c.gan11.o2mfc', 'c.gan13.o2mfc'] },
  'pn.valve':      { id: 'pn.valve', kind: 'partNumber', pn: 'KY-TV-100',
                     compatibleComponentIds: [] },
  'i.stored':      { id: 'i.stored', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-300',
                     partNumberId: 'pn.mfc200o2', mfc: { type: '1400', gas: 'O2', sccm: 200 } },
  'i.ontool':      { id: 'i.ontool', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-200',
                     partNumberId: 'pn.mfc200o2', mfc: { type: '1100', gas: 'O2', sccm: 200 } },
  'i.onorder':     { id: 'i.onorder', kind: 'item', name: '200 sccm O2 MFC', serial: 'S-100',
                     partNumberId: 'pn.mfc200o2', mfc: { type: 'G-series', gas: 'O2', sccm: 200 } },
  'i.wrongpn':     { id: 'i.wrongpn', kind: 'item', name: 'Throttle Valve', serial: 'S-999',
                     partNumberId: 'pn.valve' },
  'i.bigmfc':      { id: 'i.bigmfc', kind: 'item', name: '2 slm N2 MFC', serial: 'S-400',
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
  const withInstall = [...evs, { id: 'x5', at: '2025-02-01T00:00:00Z', by: 'lori',
    kind: 'item.installed', targetId: 'c.gan11.o2mfc', payload: { itemId: 'i.stored' } }];
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
  assert.deepEqual(r.map(i => i.id).sort(), ['i.ontool', 'i.onorder', 'i.stored'].sort());
});

test('an empty filter returns every MFC', () => {
  assert.equal(E.filterMFCs(entities, evs, {}, AT).length, 4);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test docs/kyma/test/inventory.test.mjs`
Expected: FAIL — `E.replacementCandidates is not a function`.

- [ ] **Step 3: Implement**

```js
function locationOf(entities, events, itemId, iso) {
  for (const [cid, ent] of Object.entries(entities)) {
    if (ent.kind !== 'component') continue;
    if (itemAt(events, cid, iso) === itemId) {
      let node = entities[ent.parentId];
      while (node && node.kind !== 'tool') node = entities[node.parentId];
      return { locationKind: 'tool', locationLabel: node ? node.name : 'unknown', componentId: cid };
    }
  }
  let loc = null, lead = null;
  for (const e of upto(events, iso)) {
    if (e.targetId !== itemId) continue;
    if (e.kind === 'item.received' || e.kind === 'item.shipped') {
      loc = e.payload.to;
      lead = e.payload.leadTimeDays ?? null;
    }
  }
  const kind = loc === 'loc.storage' ? 'storage'
             : loc === 'loc.repair' ? 'repair'
             : loc === 'loc.onorder' ? 'onorder' : 'unknown';
  const label = { storage: 'In storage', repair: 'Out for repair',
                  onorder: 'On order', unknown: 'Unknown' }[kind];
  return { locationKind: kind, locationLabel: label, leadTimeDays: lead };
}

const RANK = { storage: 0, tool: 1, onorder: 2, repair: 3, unknown: 4 };

function replacementCandidates(entities, events, componentId, iso) {
  const installed = itemAt(events, componentId, iso);
  const compatible = Object.values(entities).filter(e =>
    e.kind === 'partNumber' && (e.compatibleComponentIds || []).includes(componentId));
  const pnIds = new Set(compatible.map(p => p.id));
  return Object.values(entities)
    .filter(e => e.kind === 'item' && pnIds.has(e.partNumberId) && e.id !== installed)
    .map(item => ({ itemId: item.id, serial: item.serial, name: item.name,
                    pn: entities[item.partNumberId].pn,
                    ...locationOf(entities, events, item.id, iso) }))
    .sort((a, b) => (RANK[a.locationKind] - RANK[b.locationKind])
                 || (a.serial < b.serial ? -1 : a.serial > b.serial ? 1 : 0));
}

function filterMFCs(entities, events, f = {}, iso) {
  return Object.values(entities)
    .filter(e => e.kind === 'item' && e.mfc)
    .filter(e => !f.type?.length || f.type.includes(e.mfc.type))
    .filter(e => !f.gas?.length || f.gas.includes(e.mfc.gas))
    .filter(e => f.sccmMin == null || e.mfc.sccm >= f.sccmMin)
    .filter(e => f.sccmMax == null || e.mfc.sccm <= f.sccmMax)
    .map(e => ({ ...e, ...locationOf(entities, events, e.id, iso) }))
    .sort((a, b) => (a.serial < b.serial ? -1 : 1));
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `node --test docs/kyma/test/inventory.test.mjs`
Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html docs/kyma/test/inventory.test.mjs
git commit -m "Add replacement candidate ranking and MFC selector filters"
```

---

### Task 5: Seed data — GaN 11 and eighteen months of history

**Files:**
- Modify: `docs/kyma/index.html` (engine block, `SEED`)
- Modify: `docs/kyma/test/engine.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `EpiTrax.SEED = { entities, events }`, frozen.

**Entity inventory to build.** Ten tools: GaN 09, GaN 11, GaN 12, GaN 13, GaN 16, MOCVD, K-Furnace, PVD 2, PVD 4, PVD 5.

GaN 11's seven subsystems come from the dropdown on slides 20 and 21, which is authoritative: **Controls, Electric, Exhaust, Flanging, Furnace Assembly, Gas Panel, Motion.**

Components, mapped from the slide-18 button layout:

| Subsystem | Components |
| --- | --- |
| Flanging | Top Flange, Bottom Flange |
| Exhaust | Convectron, Baratron, Trap 1, Trap 2, Throttle Valve, Dry Pump |
| Gas Panel | the twelve MFC lines below |
| Furnace Assembly | Quartz, Precursors, Source Boat |
| Motion | Rotation, Lift |
| Controls | Water Manifold, Temperature Controller |
| Electric | Heater Element, Power Feedthrough |

The twelve gas-panel lines, in slide-19 order with their flow channel and installed size:

| # | Line | Channel | Size |
| --- | --- | --- | --- |
| 1 | HCl High | Ga Run | 500 sccm |
| 2 | HCl Low | Ga Run | 50 sccm |
| 3 | N₂ [Ga] | Ga Run | 2 slm |
| 4 | H₂ | Ga Run | 1 slm |
| 5 | N₂ [OD] | Outer Diluent | 10 slm |
| 6 | SiH₄ | Inner Diluent 1 | 20 sccm |
| 7 | N₂ [ID1] | Inner Diluent 1 | 5 slm |
| 8 | O₂ | O₂ Run | 200 sccm |
| 9 | N₂ [O₂] | O₂ Run | 1 slm |
| 10 | HCl ID | Inner Diluent 2 | 100 sccm |
| 11 | N₂ [ID2] | Inner Diluent 2 | 5 slm |
| 12 | N₂ [Dump] | Dump Tube | 10 slm |

The 200 sccm O₂ line is the deck's own worked example, so keep that size exactly.

Reserve two empty panel slots, rendered greyed, per the deck's note that the panel has spare capacity.

- [ ] **Step 1: Write the failing tests**

Append to `docs/kyma/test/engine.test.mjs`:

```js
test('SEED covers ten tools', () => {
  const tools = Object.values(E.SEED.entities).filter(e => e.kind === 'tool');
  assert.equal(tools.length, 10);
});

test('GaN 11 has the seven subsystems from the deck dropdown', () => {
  const subs = Object.values(E.SEED.entities)
    .filter(e => e.kind === 'subsystem' && e.parentId === 't.gan11')
    .map(e => e.name).sort();
  assert.deepEqual(subs, ['Controls', 'Electric', 'Exhaust', 'Flanging',
                          'Furnace Assembly', 'Gas Panel', 'Motion']);
});

test('the gas panel has twelve populated MFC lines', () => {
  const lines = Object.values(E.SEED.entities)
    .filter(e => e.kind === 'component' && e.parentId === 's.gan11.gaspanel' && !e.empty);
  assert.equal(lines.length, 12);
});

test('the O2 line is the 200 sccm example from the deck', () => {
  const o2 = E.SEED.entities['c.gan11.mfc.o2'];
  const item = E.SEED.entities[E.itemAt(E.SEED.events, o2.id, E.SEED.today)];
  assert.equal(item.mfc.sccm, 200);
  assert.equal(item.mfc.gas, 'O2');
});

test('seed history spans at least eighteen months', () => {
  const ats = E.SEED.events.map(e => e.at).sort();
  const months = (new Date(ats[ats.length - 1]) - new Date(ats[0])) / 86400000 / 30.44;
  assert.ok(months >= 18, `only ${months.toFixed(1)} months of history`);
});

test('seed is deterministic across two loads', async () => {
  const { loadEngine } = await import('./harness.mjs');
  const B = loadEngine();
  assert.deepEqual(E.SEED.events, B.SEED.events);
});

test('every event targets a known entity', () => {
  for (const ev of E.SEED.events) {
    assert.ok(E.SEED.entities[ev.targetId], `unknown target ${ev.targetId} on ${ev.id}`);
  }
});

test('every event has an author', () => {
  for (const ev of E.SEED.events) assert.ok(ev.by, `no author on ${ev.id}`);
});

test('GaN 11 is amber today, so the demo opens on something interesting', () => {
  assert.equal(E.healthOf(E.SEED.entities, E.SEED.events, 't.gan11', E.SEED.today), 'amber');
});

test('at least one tool is red today', () => {
  const tools = Object.values(E.SEED.entities).filter(e => e.kind === 'tool');
  assert.ok(tools.some(t =>
    E.healthOf(E.SEED.entities, E.SEED.events, t.id, E.SEED.today) === 'red'));
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test docs/kyma/test/engine.test.mjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'entities')`.

- [ ] **Step 3: Build the seed**

Add a `SEED` builder to the engine. Requirements:

- `SEED.today` is a fixed ISO string, `'2026-08-28T12:00:00Z'`. Never `Date.now()`.
- History runs from `2025-02-01` to `SEED.today` — nineteen months.
- Events are generated by walking a fixed array of month offsets, not randomly.
- Roughly 220 events total: growth runs on GaN 11 every few days (`run.recorded`, info `Ran: 23-AFRL-Ga2O3`, details `AG####` counting up from `AG5820`), periodic maintenance WOs (`M#####` from `M00150`), a handful of issues, two tool-state changes, and four component swaps on GaN 11 — one of which must be the O₂ MFC, so time travel has something to show.
- Leave exactly one issue open on a GaN 11 gas-panel component today, so GaN 11 reads amber.
- Put one tool (GaN 12) into `state.changed` → `down` and leave it there — the System Notes timeline mentions a GaN 12 rebuild, so it is plausible.
- Users: `lori`, `paul`, `abdel` — names drawn from the decks.

- [ ] **Step 4: Run and confirm pass**

Run: `node --test docs/kyma/test/`
Expected: PASS across all three files.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html docs/kyma/test/engine.test.mjs
git commit -m "Add deterministic 19-month seed for GaN 11 and the tool floor"
```

---

### Task 6: Persistence overlay

**Files:**
- Modify: `docs/kyma/index.html` (engine block)
- Modify: `docs/kyma/test/engine.test.mjs`

**Interfaces:**
- Produces: `EpiTrax.createStore(storage)` returning `{ events(), append(event), reset() }`. `storage` is any object with `getItem`/`setItem`/`removeItem`, so tests inject a fake and the browser passes `localStorage`.

The seed is never written to. `events()` returns `SEED.events` concatenated with the overlay, sorted by `at`.

- [ ] **Step 1: Write the failing tests**

```js
function fakeStorage() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v),
           removeItem: k => m.delete(k) };
}

test('a fresh store returns exactly the seed', () => {
  const s = E.createStore(fakeStorage());
  assert.equal(s.events().length, E.SEED.events.length);
});

test('appended events survive a new store over the same storage', () => {
  const st = fakeStorage();
  E.createStore(st).append({ id: 'u1', at: '2026-08-28T13:00:00Z', by: 'josh',
    kind: 'issue.opened', targetId: 't.gan11', payload: { text: 'test issue' } });
  assert.equal(E.createStore(st).events().length, E.SEED.events.length + 1);
});

test('reset clears the overlay but not the seed', () => {
  const st = fakeStorage();
  const s = E.createStore(st);
  s.append({ id: 'u1', at: '2026-08-28T13:00:00Z', by: 'josh',
    kind: 'issue.opened', targetId: 't.gan11', payload: { text: 'x' } });
  s.reset();
  assert.equal(s.events().length, E.SEED.events.length);
});

test('the seed array is never mutated by appends', () => {
  const before = E.SEED.events.length;
  E.createStore(fakeStorage()).append({ id: 'u2', at: '2026-08-28T13:00:00Z',
    by: 'josh', kind: 'comment.added', targetId: 't.gan11', payload: { comment: 'hi' } });
  assert.equal(E.SEED.events.length, before);
});

test('events come back in chronological order after an out-of-order append', () => {
  const s = E.createStore(fakeStorage());
  s.append({ id: 'u3', at: '2025-03-15T00:00:00Z', by: 'josh',
    kind: 'comment.added', targetId: 't.gan11', payload: { comment: 'backdated' } });
  const ats = s.events().map(e => e.at);
  assert.deepEqual(ats, [...ats].sort());
});

test('corrupt storage is discarded rather than throwing', () => {
  const st = fakeStorage();
  st.setItem('epitrax-poc-v1', '{not json');
  assert.equal(E.createStore(st).events().length, E.SEED.events.length);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test docs/kyma/test/engine.test.mjs`
Expected: FAIL — `E.createStore is not a function`.

- [ ] **Step 3: Implement**

```js
const STORE_KEY = 'epitrax-poc-v1';

function createStore(storage) {
  const read = () => {
    try {
      const raw = storage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  return {
    events() {
      return [...SEED.events, ...read()]
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    },
    append(event) {
      const next = [...read(), event];
      storage.setItem(STORE_KEY, JSON.stringify(next));
      return event;
    },
    reset() { storage.removeItem(STORE_KEY); },
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `node --test docs/kyma/test/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html docs/kyma/test/engine.test.mjs
git commit -m "Add localStorage overlay over the frozen seed"
```

---

### Task 7: Shell — theme, routing, breadcrumb

**Files:**
- Modify: `docs/kyma/index.html` (styles + UI script)

**Interfaces:**
- Consumes: the whole engine API.
- Produces: `route(view, params)` and a hash-based router. Routes: `#/`, `#/facility`, `#/tool/:id`, `#/subsystem/:id`, `#/component/:id`, `#/item/:id`, `#/spares`, `#/across`.

- [ ] **Step 1: Add the design tokens**

Match the `bite7` console so the two POCs read as siblings, with the deck's status colours layered on:

```css
:root{
  --deep:#0B1012; --slate:#131A1C; --rise:#1B2427; --rise2:#222D31;
  --line:#2C3A3E; --line-soft:#212C2F;
  --chalk:#F2F0EA; --mute:#8FA0A4; --mute2:#65787D;
  --amber:#FFB020;
  --up:#00B050; --warn:#FFC000; --down:#C00000;
  --display:'Oswald',Impact,'Arial Narrow',sans-serif;
  --body:'IBM Plex Sans',-apple-system,'Segoe UI',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
```

- [ ] **Step 2: Build the top rail**

Left: `EPITRAX` wordmark plus the eyebrow `MAINTENANCE CONSOLE — PROTOTYPE`. Centre: breadcrumb. Right: a global date control (Task 13 wires it) and a Reset button calling `store.reset()` then re-render.

- [ ] **Step 3: Build the router**

```js
function parseHash() {
  const [, view = '', id = ''] = (location.hash || '#/').split('/');
  return { view: view || 'home', id: decodeURIComponent(id) };
}
window.addEventListener('hashchange', render);
```

`render()` clears the main element and dispatches on `view`. Every view function takes `(root, ctx)` where `ctx = { entities, events, at, store }`.

- [ ] **Step 4: Build the breadcrumb**

Walk `parentId` up from the current entity to the tool, then prepend Facility and Home. Each hop is a link. Renders as `Home / Facility / GaN 11 / Gas Panel / O₂ MFC`.

- [ ] **Step 5: Verify in a browser**

Run: `python -m http.server 8811 --directory docs` then open `http://localhost:8811/kyma/`.
Expected: the rail renders, the hash router switches between empty placeholder views without console errors.

- [ ] **Step 6: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add console shell, hash router, and breadcrumb"
```

---

### Task 8: Facility view

**Files:**
- Modify: `docs/kyma/index.html` (UI script)

**Interfaces:**
- Consumes: `healthOf`, `SEED.entities`.

Drawn as SVG rather than the deck's building floorplan — a disclosure decision recorded in the spec.

- [ ] **Step 1: Lay out the bays**

Three bays as rounded SVG rects: **HVPE Bay** (GaN 09, GaN 11, GaN 12, GaN 13, GaN 16), **PVD Bay** (PVD 2, PVD 4, PVD 5), **Furnace / MOCVD** (MOCVD, K-Furnace). Tools are tiles inside their bay.

- [ ] **Step 2: Colour and label each tile**

Fill from `healthOf`. Each tile shows the tool name in `--display`, and beneath it the state as text — `UP`, `DOWN`, `QUAL`, `PM`, `DECOMM` — because red covers four states. Open-issue count in the corner when amber.

- [ ] **Step 3: Wire navigation**

Clicking a tile sets `location.hash = '#/tool/' + id`. Tools other than GaN 11 route to a tool view that shows the log and status but no schematic, with a plain note: *"Schematic modelled for GaN 11 only in this prototype."*

- [ ] **Step 4: Verify in a browser**

Expected: ten tiles, GaN 11 amber, GaN 12 red and labelled DOWN, the rest green. Clicking navigates.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add facility view with health-coloured tool tiles"
```

---

### Task 9: Tool view — GaN 11

**Files:**
- Modify: `docs/kyma/index.html` (UI script, embedded image)

**Interfaces:**
- Consumes: `healthOf`, `stateAt`, `logFor`.

Reproduces slide 18. Extracted geometry, in slide inches on a 13.33in canvas — convert to percentages of the layout width:

| Element | x | y | w |
| --- | --- | --- | --- |
| Whiteboard panel | 4.64 | 1.61 | 2.52 |
| Left button column | 7.29 | 0.55–5.48 | 1.44 |
| Right button column | 12.06 | 1.11–5.48 | 1.44 |
| Rotation / Lift | 9.58 | 6.70, 7.12 | 1.44 |
| Date control | 7.29 | 0.00 | 2.76 |
| Rebuild / Refill | 7.29 | 6.14, 6.60 | — |
| Report Issue / Record Maintenance / View Log | 11.89–12.69 | 6.14–7.07 | — |

Left column top to bottom: Top Flange, Gas Panel, Controls, Electric, Water Manifold, Bottom Flange, Convectron, Baratron.
Right column top to bottom: Precursors, Quartz, Furnace Assembly, Trap Assembly, Throttle Valve, Dry Pump.

- [ ] **Step 1: Embed the reactor render**

Source: the CAD render extracted from slide 17 of `Maintenance-SpareParts_20260211.pptx` — 502×512, RGBA with a transparent background, so it needs no treatment on the dark theme.

```bash
base64 -w0 <path-to>/s17_1.png > /tmp/reactor.b64
```

Insert as `background-image: url('data:image/png;base64,<contents>')` on the tool-view centre element, `background-size: contain`, `background-repeat: no-repeat`, `background-position: center`.

If the source PNG is no longer to hand, it is recoverable by re-extracting slide 17's image from the deck.

- [ ] **Step 2: Render the whiteboard panel**

Fields, per the slide's placeholders: build size (derived from installed quartz) and build #, charge code, dopant chemical and concentration, rod height, base pressure, source serial #, estimated Ga level, idle temps, open issues list, latest comment.

- [ ] **Step 3: Render the two button columns**

Each button is coloured by `healthOf` for its entity. Subsystem buttons route to `#/subsystem/:id`; component buttons route straight to `#/component/:id`, per the deck's note that some go to subsystem views and others straight to component views.

- [ ] **Step 4: Add hover detail**

Hovering a subsystem button shows a small panel listing the components inside it and any open issues — the deck asks for this explicitly.

- [ ] **Step 5: Add the action buttons**

Rebuild, Refill, Report Issue, Record Maintenance, View Log. Rebuild and Refill are wired in Task 12; for now they open a stub dialog.

- [ ] **Step 6: Verify in a browser**

Expected: layout matches slide 18, reactor render centred and transparent against the dark background, the gas panel button amber.

- [ ] **Step 7: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add GaN 11 tool view reproducing the deck's slide-18 layout"
```

---

### Task 10: Subsystem view — gas panel

**Files:**
- Modify: `docs/kyma/index.html` (UI script)

Reproduces slide 19: twelve rows, each a gas label plus its installed MFC size, grouped by flow channel with the channel named on the right.

- [ ] **Step 1: Render the channel groups**

Ga Run (4 lines), Outer Diluent (1), Inner Diluent 1 (2), O₂ Run (2), Inner Diluent 2 (2), Dump Tube (1). A tinted band behind each group indicates the channel, per the deck's note that *"background indicates which channel gases flow in."*

- [ ] **Step 2: Render each line**

Left cell: gas label, in `--mono`. Right cell: installed MFC size for the selected date, from `itemAt`. Line colour from `healthOf`. Clicking routes to `#/component/:id`.

- [ ] **Step 3: Render the two empty slots**

Greyed, labelled `— empty slot —`, not clickable. The deck asks for spare slots to be shown rather than hidden.

- [ ] **Step 4: Add subsystem actions**

Report Issue and Record Maintenance at the gas-panel level, plus the date control.

- [ ] **Step 5: Verify in a browser**

Expected: twelve populated lines in slide-19 order with correct channel grouping, two greyed slots, O₂ reading 200 sccm.

- [ ] **Step 6: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add gas panel subsystem view with channel grouping"
```

---

### Task 11: Component and item views

**Files:**
- Modify: `docs/kyma/index.html` (UI script)

- [ ] **Step 1: Build the component header**

Per slide 20: component name, `Currently installed: {description} ({Kyma PN})`, and `Serial #:` — the serial links to `#/item/:id`.

- [ ] **Step 2: Build the subsystem/component navigator**

The two-column picker from slides 20 and 21: a Subsystem list on the left, a Component list on the right filtered to the selected subsystem, both reflecting the current selection. Selecting navigates.

- [ ] **Step 3: Build the open issues and WOs table**

Columns: date, text, author, and a Close action per row. Long text wraps on hover and is selectable, per the deck's note about copy-able comments.

- [ ] **Step 4: Build the component log**

Four columns matching the real screenshot: StartDate, Info, Details, Comment. Rows tinted by kind — runs plain, maintenance blue, issues purple, state changes red.

- [ ] **Step 5: Build the item view**

One serialized object across its life: every component slot it has occupied with dates, every tool it has lived on, maintenance and issue events it inherited while installed, and shipping/repair events.

- [ ] **Step 6: Verify in a browser**

Expected: the O₂ MFC component view shows its installed item, the open issue, and a log; clicking the serial opens the item view showing both slots it has occupied.

- [ ] **Step 7: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add component and serialized item views"
```

---

### Task 12: Actions

**Files:**
- Modify: `docs/kyma/index.html` (UI script)

Every action appends to the store and re-renders. No mutation.

- [ ] **Step 1: Report Issue**

The slide-8 fork. Dialog asks *"Would you like to open a new issue?"* with Yes and No. Yes gives a text box and Save, appending `issue.opened`. No lists open issues with Comment and Close on each. **A "put tool down" checkbox is present and unchecked by default** — the deck says explicitly it is not the autoselected option.

- [ ] **Step 2: Record Maintenance**

The slide-9 flow, in order:

1. *"Record new maintenance?"* Yes or No. No shows the log.
2. Yes gives a title box and a description-of-work box, then Save.
3. Save appends `wo.opened` and `wo.closed` with the description as the completion comment.
4. Then: *"Would you like to close any open issues?"* Yes lists open issues at this level; picking one appends `issue.closed` plus an auto-generated `issue.commented` naming the WO.
5. Then: *"Close another?"* — loop until No.

- [ ] **Step 3: Replace Component**

Dropdown from `replacementCandidates`, already sorted in-storage first. Each option shows serial, PN, location label, and lead time when on order. Then a prompt for where the removed item goes: Storage, Repair, Another tool, Scrap. Appends `item.removed` (with `to`) then `item.installed`. A **Remove without replacing** option appends only `item.removed`.

- [ ] **Step 4: MFC Selector**

Opens from an MFC component view instead of the plain dropdown. Multi-select chips for Type (1100, 1400, G-series, black, green) and Calibrated gas (N₂, Ar, NH₃, O₂, H₂, CH₄), plus min/max sccm inputs. Results from `filterMFCs`, showing serial, size, gas, type, and location. Selecting one fills the Serial # field; Replace Component then commits it.

- [ ] **Step 5: Rebuild and Refill**

Rebuild appends three WOs on the tool, exactly as the deck names them: *HVPE Rebuild (Tear Down/Cleaning)*, *HVPE Rebuild (Assembly)*, *HVPE Rebuild (Ramp Up)*. Refill takes a Ga lot number — a dropdown of in-stock Ga bottles from inventory — and grams used, appending a `comment.added` event carrying both.

- [ ] **Step 6: Verify in a browser**

Expected: open an issue on the throttle valve, watch the tool tile turn amber on the facility view, record maintenance against it, close the issue through the follow-up prompt, and watch it return to green. Reload the page and the changes persist. Reset restores the seed.

- [ ] **Step 7: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add issue, maintenance, replacement, and MFC selector flows"
```

---

### Task 13: Time travel

**Files:**
- Modify: `docs/kyma/index.html` (UI script, embedded SVG)

- [ ] **Step 1: Wire the date control**

A date input on the tool and subsystem views, defaulting to `SEED.today`. Changing it sets `ctx.at` and re-renders. Every view already derives from `ctx.at`, so this should require no per-view changes — if it does, the view is reading state it should be deriving.

- [ ] **Step 2: Mark what changed**

Components changed between the selected date and today get an outline and a small glyph, from `changesBetween`.

- [ ] **Step 3: Add the "changed since" strip**

Under the date control when the date is not today: one row per swap, reading `O₂ MFC · S-200 → S-300 · 2 Jun 2025`, each linking to the component.

- [ ] **Step 4: Add the DeLorean**

When `ctx.at` is not `SEED.today`, fade in a DeLorean silhouette behind the tool view at low opacity, plus a `VIEWING <date>` marker in the rail. Inline SVG, hand-drawn, no external asset. The deck asks for this by name.

- [ ] **Step 5: Verify in a browser**

Expected: scrub to March 2025 — the O₂ line shows its previous MFC, the open issue disappears if it was raised later, changed components are outlined, and the DeLorean appears. Return to today and it all reverts.

- [ ] **Step 6: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add date-scrubbing time travel with change markers"
```

---

### Task 14: Home, spares, and cross-tool history

**Files:**
- Modify: `docs/kyma/index.html` (UI script)

- [ ] **Step 1: Build the home screen**

The deck's three panels: spares below threshold, PMs coming due, items out for repair. Every row links into the spine. Above them, a floor summary strip: counts of tools up, amber, and down.

- [ ] **Step 2: Build the spares view**

Searchable inventory table: part number, description, quantity in storage, quantity on tools, quantity on order, location. Filter by text, by compatible component, and by location. Low-stock rows flagged amber. Out-for-repair items listed with the tool they came from.

- [ ] **Step 3: Build the cross-tool history view**

The deck's own example. Pick a component type (Throttle Valve, Baratron, Convectron, Dry Pump, MFC) and a set of tools (all, HVPE only, PVD only, or hand-picked). Output is a merged timeline across every matching component, each row naming its tool.

- [ ] **Step 4: Verify in a browser**

Expected: home lists the seeded low-stock parts and open repairs; the cross-tool view for Throttle Valve across HVPE tools returns a merged timeline.

- [ ] **Step 5: Commit**

```bash
git add docs/kyma/index.html
git commit -m "Add home screen, spares inventory, and cross-tool history"
```

---

### Task 15: Verification and finish

**Files:**
- Modify: `docs/kyma/index.html`
- Modify: `docs/index.md`

- [ ] **Step 1: Run the whole suite**

Run: `node --test docs/kyma/test/`
Expected: all tests pass. Record the count.

- [ ] **Step 2: Confirm the page is genuinely self-contained**

Run: `grep -oE 'src="[^"]+"|href="[^"]+"' docs/kyma/index.html`
Expected: the only external reference is the Google Fonts stylesheet. No other `src`/`href` to a network path.

- [ ] **Step 3: Confirm the exclusions hold**

Run: `grep -n "kyma" docs/_config.yml`
Expected: both `kyma/test` and `kyma/documentation` are excluded.

- [ ] **Step 4: Add the project link**

In `docs/index.md`, under `## > projects`, add:

```markdown
- [EpiTrax Maintenance Console](/kyma/) — concept console for a semiconductor
  crystal-growth floor: tool-to-component drill-down, spare parts, and a date
  scrubber that rebuilds any tool's past from its event log.
```

- [ ] **Step 5: Walk the demo path end to end in a browser**

Home → Facility → GaN 11 → Gas Panel → O₂ MFC → item view → back up → report an issue → watch it roll up to the facility tile → record maintenance → close the issue → scrub back six months → confirm the DeLorean and the changed-component markers → Reset.

- [ ] **Step 6: Check the console is clean**

Expected: no errors or warnings in the browser console across that whole path.

- [ ] **Step 7: Commit**

```bash
git add docs/kyma/index.html docs/index.md
git commit -m "Link EpiTrax console from the site index"
```

---

## Self-Review

**Spec coverage.** Walked each spec section against the tasks:

| Spec section | Task |
| --- | --- |
| Data model — entities, events, derived views | 1, 2, 3 |
| Issue attachment rule | 1 (test), 3 (test) |
| Home | 14 |
| Facility | 8 |
| Tool — GaN 11 | 9 |
| Subsystem — gas panel | 10 |
| Component, Item | 11 |
| Spares | 14 |
| Cross-tool history | 14 |
| Report Issue, Record Maintenance, Replace, MFC Selector | 12 |
| Rebuild / Refill | 12 |
| Time travel, DeLorean | 13 |
| Seed data | 5 |
| Persistence | 6 |
| Colour | 7, 8 |
| Depth (GaN 11 deep, others shallow) | 5, 8 |
| Testing | 1–6, 15 |

No gaps. The spec's `?test=1` harness is deliberately superseded, recorded above.

**Placeholder scan.** No TBDs, no "add error handling", no "similar to Task N". Task 5 step 3 and the UI tasks describe structure and data rather than transcribing every line — the engine tasks carry full code because they carry the tests.

**Type consistency.** Checked the signatures across tasks: `healthOf`, `logFor`, `changesBetween`, `replacementCandidates`, and `filterMFCs` all take `entities` first; `stateAt` and `itemAt` take `events` first because they need no entity map. `descendantsOf` includes self, and Tasks 2 and 3 both rely on that. Entity ids used in tests (`t.gan11`, `s.gan11.gaspanel`, `c.gan11.mfc.o2`) match the seed ids asserted in Task 5.
