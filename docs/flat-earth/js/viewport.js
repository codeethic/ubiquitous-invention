import * as THREE from 'three';

/**
 * One WebGLRenderer, one canvas, two scenes drawn into two scissored viewports.
 * Splits horizontally when the canvas is wide, vertically when it is tall, so
 * the split always agrees with whatever layout CSS produced.
 */
export function createDualViewport(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setScissorTest(true);
  renderer.setClearColor(0x0b0e13, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES compresses highlights globally, and horizon reads hull occlusion
  // against a bright limb. If that contrast measurably suffers, this comes
  // back off: the measurement outranks the look.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const flatScene = new THREE.Scene();
  const globeScene = new THREE.Scene();
  // Ambient plus a hemisphere fill only.
  //
  // The old fixed DirectionalLight at (1,1,1) is deliberately gone and is NOT
  // coming back: it lit every scene from a corner that had nothing to do with
  // where the sun was, which was invisible while nothing cast shadows and
  // becomes a contradiction the moment something does. Modules that have a sun
  // bring their own light with it (see makeSun); modules that do not are lit
  // by this fill, which casts nothing.
  //
  // Levels. Five modules — horizon, lunar-eclipse, time-zones, flight-routes,
  // and eratosthenes' flat pane — have no sun at all and see ONLY these two
  // numbers, through ACES tone mapping. At 0.28 + 0.45 their brightest
  // possible surface reached 0.73 where the pre-branch rig (ambient 0.35 plus
  // a 1.1 directional) reached 1.45, and they were correspondingly murky.
  //
  // 0.35 + 0.85 restores the old floor exactly (an unlit, downward-facing
  // surface still gets 0.35) and brings an up-facing one to 1.20, just under
  // the old peak. The extra brightness is put in the HEMISPHERE rather than
  // the ambient on purpose: ambient is direction-independent and flattens
  // form, whereas the hemisphere term scales with how much sky a surface
  // faces. That distinction is load-bearing for `horizon`, whose whole claim
  // is read from a dark hull silhouetted against a bright limb: the sea is
  // sky-facing and the hull is near-vertical, so raising the hemisphere lifts
  // the background more than the subject and the silhouette gets CRISPER, not
  // washed out. 1.20 also stays below the knee where ACES starts compressing
  // hard, so that contrast survives tone mapping. Do not push these higher
  // without re-checking the hull against the limb.
  for (const scene of [flatScene, globeScene]) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    scene.add(new THREE.HemisphereLight(0x93b4d8, 0x0b0e13, 0.85));
  }

  let flatCam = null, globeCam = null;

  function panes() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return w >= h
      ? [{ x: 0, y: 0, w: w / 2, h }, { x: w / 2, y: 0, w: w / 2, h }]
      : [{ x: 0, y: h / 2, w, h: h / 2 }, { x: 0, y: 0, w, h: h / 2 }];
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    const [a, b] = panes();
    if (flatCam) { flatCam.aspect = a.w / a.h; flatCam.updateProjectionMatrix(); }
    if (globeCam) { globeCam.aspect = b.w / b.h; globeCam.updateProjectionMatrix(); }
  }

  function render() {
    if (!flatCam || !globeCam) return;
    const [a, b] = panes();
    for (const [pane, scene, cam] of [[a, flatScene, flatCam], [b, globeScene, globeCam]]) {
      renderer.setViewport(pane.x, pane.y, pane.w, pane.h);
      renderer.setScissor(pane.x, pane.y, pane.w, pane.h);
      renderer.render(scene, cam);
    }
  }

  /**
   * Which pane a client-space point falls in: 0 = flat, 1 = globe.
   * DOM coordinates are y-down while GL's are y-up, so the stacked case tests
   * `y < h/2` for the flat pane even though its scissor rect uses `y = h/2`.
   */
  function paneIndexAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return w >= h ? (x < w / 2 ? 0 : 1) : (y < h / 2 ? 0 : 1);
  }

  return {
    renderer, flatScene, globeScene, render, resize, paneIndexAt,
    setCameras(f, g) { flatCam = f; globeCam = g; resize(); },
    dispose() { renderer.dispose(); },
  };
}
