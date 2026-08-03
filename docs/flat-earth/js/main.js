import { createDualViewport } from './viewport.js';
import { createState } from './app-state.js';
import { MODULES, getModule } from './registry.js';
import { renderSelector } from './ui/selector.js';
import { renderControls } from './ui/controls.js';
import { renderReadout } from './ui/readout.js';
import { showErrorCard, clearErrorCard } from './ui/error-card.js';
import { setLoading } from './ui/loading.js';
import { renderParamsDialog } from './ui/params-dialog.js';
import { loadCoastlines, generateTextures } from './lib/textures.js';
import { applyMaterials } from './lib/materials.js';

const canvas = document.getElementById('scene-canvas');
const canvasError = document.getElementById('canvas-error');
const state = createState({});

let viewport = null;
let active = null;
let built = null;
let moduleFaulted = false;

function teardown() {
  if (!active) return;
  if (built) for (const side of [built.flat, built.globe]) side.rig?.setLinked(null);
  if (built && viewport) {
    viewport.flatScene.remove(built.flat.root);
    viewport.globeScene.remove(built.globe.root);
  }
  try { active.dispose(); } catch { /* teardown must not block a switch */ }
  active = null;
  built = null;
  moduleFaulted = false;
}

let activationSeq = 0;

async function activate(id) {
  const seq = ++activationSeq;
  teardown();
  const module = getModule(id);
  state.reset({ ...module.defaults });
  active = module;

  try {
    if (module.load) await module.load();
    // A phenomenon switch during load() would otherwise resume here with a
    // stale module: building into the live scenes behind the new one,
    // installing the wrong cameras, and orphaning roots that teardown can
    // no longer reach.
    if (seq !== activationSeq) return;
    // Guarded on `viewport`: when WebGL is unavailable, boot() already showed
    // an accurate "WebGL unavailable" card, and blindly touching
    // viewport.flatScene here would throw, overwriting it with a misleading
    // per-module error that also wrongly claims other phenomena are
    // unaffected (all of them are, since there is no renderer). `load()`
    // still runs above so data-fetch failures surface correctly either way.
    if (viewport) {
      built = module.build({ canvas });
      viewport.flatScene.add(built.flat.root);
      viewport.globeScene.add(built.globe.root);
      viewport.setCameras(built.flat.camera, built.globe.camera);
      if (module.linkCameras && built.flat.rig && built.globe.rig) {
        built.flat.rig.setLinked(built.globe.rig);
        built.globe.rig.setLinked(built.flat.rig);
      }
      clearErrorCard(canvasError);
    }
  } catch (err) {
    if (built && viewport) {
      viewport.flatScene.remove(built.flat.root);
      viewport.globeScene.remove(built.globe.root);
    }
    built = null;
    showErrorCard(canvasError, `${module.title} is unavailable`,
      `${err.message} — other phenomena are unaffected.`);
  }

  // Guarded separately from build(): a module whose readout() throws must not
  // escape activate(). boot() awaits activate(), so an uncaught throw here
  // would skip the rAF loop and setLoading(false) entirely, wedging the app on
  // the loading screen with WebGL perfectly healthy. Most likely trigger is a
  // readout() dereferencing load()-fetched data that never arrived.
  try {
    renderControls(document.getElementById('control-strip'), module.controls, state);
    renderReadout(document.getElementById('readout-panel'), module, state);
  } catch (err) {
    showErrorCard(canvasError, `${module.title} readout failed`, err.message);
  }
  if (built) {
    try {
      module.update(state.get(), 0);
    } catch (err) {
      moduleFaulted = true;
      showErrorCard(canvasError, `${module.title} stopped`, err.message);
    }
  }
}

/**
 * One listener set for the app's lifetime, installed once from boot(). Never
 * re-attached on phenomenon switch, so switching cannot accumulate listeners.
 * Rigs themselves own no listeners (see js/lib/camera-rig.js) — this is the
 * harness routing drags to whichever rig's pane they started in.
 */
function installPointerControls() {
  let activeRig = null;
  let lastX = 0, lastY = 0;

  // Which rig a pointer event belongs to. Resolved per event rather than
  // cached, because the split axis flips with the viewport aspect.
  const rigAt = e => {
    if (!built || !viewport) return null;
    return viewport.paneIndexAt(e.clientX, e.clientY) === 0
      ? built.flat.rig
      : built.globe.rig;
  };

  canvas.addEventListener('pointerdown', e => {
    activeRig = rigAt(e);
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { activeRig = null; });
  window.addEventListener('pointercancel', () => { activeRig = null; });
  window.addEventListener('pointermove', e => {
    if (!activeRig) return;
    activeRig.orbit(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('wheel', e => {
    const rig = rigAt(e);
    if (!rig) return;
    e.preventDefault();
    rig.zoom(e.deltaY);
  }, { passive: false });
}

async function boot() {
  try {
    await bootSteps();
  } finally {
    // The LAST line of defence, and the reason it is a finally rather than the
    // end of a happy path: `#loading-screen` is a full-screen opaque overlay,
    // so anything that escapes bootSteps() hides an app that may be perfectly
    // usable — every readout is computed from js/physics/ and needs no
    // rendering at all. Individual steps are still guarded where a sensible
    // local recovery exists; this catches whatever nobody thought of.
    setLoading(false);
  }
}

async function bootSteps() {
  try {
    viewport = createDualViewport(canvas);
    installPointerControls();
  } catch (err) {
    showErrorCard(canvasError, 'WebGL unavailable',
      `${err.message} — the numeric readouts below still work.`);
    canvas.hidden = true;
  }

  // Textures are an enhancement, never a dependency. A missing or malformed
  // coastlines.json must not take the app down: seven of the eight modules
  // need no geography at all, and the eighth degrades to an untextured globe
  // with every readout intact. Nothing here may add a new way to go blank.
  //
  // The whole block is guarded, applyMaterials() included. It was previously
  // the one bare call in boot(): it walks a dozen shared materials, and any
  // throw inside it skipped the selector, the rAF loop and setLoading(false)
  // in one go — a blank page behind the loading overlay, caused by a purely
  // cosmetic step.
  //
  // loadCoastlines() carries its own 5 s abort timeout (see textures.js). A
  // fetch that REJECTS was already handled here; one that simply never
  // settles — captive portal, proxy that accepts and never answers — would
  // otherwise leave this await pending forever with setLoading(false)
  // downstream of it, which is the same class of bug this app has shipped
  // once already. Nothing on the path to setLoading(false) may be unbounded.
  try {
    await loadCoastlines();
  } catch (err) {
    console.warn('Coastline data unavailable; surfaces render without land.', err);
  }
  try {
    await generateTextures();
    applyMaterials();
  } catch (err) {
    console.warn('Surface textures unavailable; rendering with flat colour.', err);
  }

  renderSelector(document.getElementById('phenomenon-select'),
    MODULES, MODULES[0].id, activate);

  renderParamsDialog(document.getElementById('params-dialog'),
    document.getElementById('params-button'));

  state.subscribe(v => {
    if (active && built) {
      try {
        active.update(v, 0);
      } catch (err) {
        moduleFaulted = true;
        showErrorCard(canvasError, `${active.title} stopped`, err.message);
      }
    }
    if (!active) return;
    try {
      renderReadout(document.getElementById('readout-panel'), active, state);
    } catch (err) {
      showErrorCard(canvasError, `${active.title} readout failed`, err.message);
    }
  });

  await activate(MODULES[0].id);

  if (viewport) {
    window.addEventListener('resize', viewport.resize);
    let last = performance.now();
    (function loop(now) {
      const dt = (now - last) / 1000; last = now;
      // A throwing update() must not take the loop with it: without this guard
      // neither viewport.render() nor requestAnimationFrame() below would run,
      // and rendering would stop permanently with nothing on screen to say why.
      // moduleFaulted latches so a broken module is not re-entered 60x/second.
      if (active && built && !moduleFaulted) {
        try {
          active.update(state.get(), dt);
        } catch (err) {
          moduleFaulted = true;
          showErrorCard(canvasError, `${active.title} stopped`, err.message);
        }
      }
      viewport.render();
      requestAnimationFrame(loop);
    })(last);
  }
}

boot();
