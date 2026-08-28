// The console ships as one self-contained HTML file, so there is no module to
// import. Instead we lift the engine's <script id="engine"> block out of the
// page and run it here. This is why the engine block must stay side-effect
// free at load: no DOM access, no work beyond defining globalThis.EpiTrax.
//
// It runs in *this* realm rather than a fresh vm context on purpose. A fresh
// context gets its own intrinsics, so an array built inside the engine would
// have a different Array.prototype than one built in a test file, and
// assert.deepStrictEqual would reject two structurally identical arrays.
// Running in-realm keeps prototypes shared. We restore any previous value
// afterwards so repeated calls hand back independent engine objects.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadEngine() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script id="engine"> block found in index.html');

  const previous = globalThis.EpiTrax;
  vm.runInThisContext(m[1], { filename: 'index.html#engine' });
  const engine = globalThis.EpiTrax;
  globalThis.EpiTrax = previous;

  if (!engine) throw new Error('engine did not define globalThis.EpiTrax');
  return engine;
}
