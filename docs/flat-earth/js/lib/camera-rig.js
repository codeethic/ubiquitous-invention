import * as THREE from 'three';

/**
 * Orbit camera on a spherical rig. Deliberately hand-rolled rather than pulling
 * in OrbitControls, so the vendored payload stays to a single Three.js file.
 * setLinked(other) makes drags on this rig drive the other rig too.
 */
export function createOrbitRig({
  fov = 50, near = 0.01, far = 1e9,
  distance = 10, target = new THREE.Vector3(0, 0, 0),
  minDistance = 0.1, maxDistance = 1e8,
  polar = Math.PI / 2.4, azimuth = 0,
} = {}) {
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const state = { distance, polar, azimuth, target: target.clone() };
  let linked = null;
  let el = null;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function apply() {
    const sp = Math.sin(state.polar), cp = Math.cos(state.polar);
    camera.position.set(
      state.target.x + state.distance * sp * Math.sin(state.azimuth),
      state.target.y + state.distance * cp,
      state.target.z + state.distance * sp * Math.cos(state.azimuth),
    );
    camera.lookAt(state.target);
  }

  function orbit(dx, dy, propagate = true) {
    state.azimuth -= dx * 0.005;
    state.polar = Math.min(Math.PI - 0.01, Math.max(0.01, state.polar - dy * 0.005));
    apply();
    if (propagate && linked) linked.orbit(dx, dy, false);
  }

  function zoom(delta, propagate = true) {
    state.distance = Math.min(maxDistance,
      Math.max(minDistance, state.distance * (1 + delta * 0.001)));
    apply();
    if (propagate && linked) linked.zoom(delta, false);
  }

  const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
  const onUp = () => { dragging = false; };
  const onMove = e => {
    if (!dragging) return;
    orbit(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  };
  const onWheel = e => { e.preventDefault(); zoom(e.deltaY); };

  apply();

  return {
    camera,
    orbit,
    zoom,
    setDistance(d) { state.distance = d; apply(); },
    setTarget(v) { state.target.copy(v); apply(); },
    setLinked(other) { linked = other; },
    attach(element) {
      el = element;
      el.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
      el.addEventListener('wheel', onWheel, { passive: false });
    },
    dispose() {
      if (!el) return;
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('wheel', onWheel);
      el = null;
      linked = null;
    },
  };
}
