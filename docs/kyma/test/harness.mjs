// The console ships as one self-contained HTML file, so there is no module to
// import. Instead we lift the engine's <script id="engine"> block out of the
// page and run it in a bare vm context — no DOM, no globals. This is why the
// engine block must stay side-effect free at load.
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
