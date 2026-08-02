import { createDualViewport } from './viewport.js';
import { createState } from './app-state.js';
import { MODULES, getModule } from './registry.js';
import { renderSelector } from './ui/selector.js';
import { renderControls } from './ui/controls.js';
import { renderReadout } from './ui/readout.js';
import { showErrorCard, clearErrorCard } from './ui/error-card.js';
import { setLoading } from './ui/loading.js';

const canvas = document.getElementById('scene-canvas');
const canvasError = document.getElementById('canvas-error');
const state = createState({});

let viewport = null;
let active = null;
let built = null;

function teardown() {
  if (!active) return;
  if (built) {
    viewport.flatScene.remove(built.flat.root);
    viewport.globeScene.remove(built.globe.root);
  }
  try { active.dispose(); } catch { /* teardown must not block a switch */ }
  active = null;
  built = null;
}

function activate(id) {
  teardown();
  const module = getModule(id);
  state.reset({ ...module.defaults });

  // Guarded on `viewport`: when WebGL is unavailable createDualViewport already
  // showed an accurate card, and blindly touching viewport.flatScene here would
  // throw, overwriting it with a misleading per-module error that also falsely
  // claims other phenomena are unaffected.
  try {
    if (viewport) {
      built = module.build({ canvas });
      viewport.flatScene.add(built.flat.root);
      viewport.globeScene.add(built.globe.root);
      viewport.setCameras(built.flat.camera, built.globe.camera);
      clearErrorCard(canvasError);
    }
  } catch (err) {
    built = null;
    showErrorCard(canvasError, `${module.title} failed to load`,
      `${err.message} — other phenomena are unaffected.`);
  }

  active = module;
  renderControls(document.getElementById('control-strip'), module.controls, state);
  renderReadout(document.getElementById('readout-panel'), module, state);
  if (built) module.update(state.get(), 0);
}

function boot() {
  try {
    viewport = createDualViewport(canvas);
  } catch (err) {
    showErrorCard(canvasError, 'WebGL unavailable',
      `${err.message} — the numeric readouts below still work.`);
    canvas.hidden = true;
  }

  renderSelector(document.getElementById('phenomenon-select'),
    MODULES, MODULES[0].id, activate);

  state.subscribe(v => {
    if (active && built) active.update(v, 0);
    if (active) renderReadout(document.getElementById('readout-panel'), active, state);
  });

  activate(MODULES[0].id);

  if (viewport) {
    window.addEventListener('resize', viewport.resize);
    let last = performance.now();
    (function loop(now) {
      const dt = (now - last) / 1000; last = now;
      if (active && built) active.update(state.get(), dt);
      viewport.render();
      requestAnimationFrame(loop);
    })(last);
  }

  setLoading(false);
}

boot();
