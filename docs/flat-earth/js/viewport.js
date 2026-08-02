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

  const flatScene = new THREE.Scene();
  const globeScene = new THREE.Scene();
  for (const scene of [flatScene, globeScene]) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(1, 1, 1);
    scene.add(key);
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

  return {
    renderer, flatScene, globeScene, render, resize,
    setCameras(f, g) { flatCam = f; globeCam = g; resize(); },
    dispose() { renderer.dispose(); },
  };
}
