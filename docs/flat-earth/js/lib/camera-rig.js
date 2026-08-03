import * as THREE from 'three';

/**
 * Orbit camera on a spherical rig. Deliberately hand-rolled rather than pulling
 * in OrbitControls, so the vendored payload stays to the two Three.js files.
 *
 * The rig owns NO event listeners. The harness (main.js) installs one set of
 * pointer listeners on the canvas, decides which pane a drag started in, and
 * drives that pane's rig directly. Two rigs sharing one canvas must not both
 * listen: when linked, each drag would move both rigs twice; when unlinked,
 * a drag on either pane would still move both.
 *
 * setLinked(other) makes drags on this rig drive the other rig too.
 */
export function createOrbitRig({
  fov = 50, near, far,
  distance = 10, target = new THREE.Vector3(0, 0, 0),
  minDistance = 0.1, maxDistance,
  polar = Math.PI / 2.4, azimuth = 0,
} = {}) {
  const explicitNear = near !== undefined;
  const explicitFar = far !== undefined;
  const camera = new THREE.PerspectiveCamera(
    fov, 1, explicitNear ? near : distance / 1e4, explicitFar ? far : distance * 20);
  const state = { distance, polar, azimuth, target: target.clone() };
  // Default clamp so zooming out cannot push all geometry past the far
  // plane, which is itself derived from distance below.
  maxDistance = maxDistance ?? distance * 15;
  let linked = null;

  // Derived from the rig distance, not fixed. A hard near = 0.01 against
  // far = 1e6 gives a 1e8 ratio, where the depth increment at the camera
  // exceeds the offset of every overlay in this app — they currently survive
  // only because MATERIALS.ocean happens to hold the lowest material id and
  // so draws first. Deriving the planes makes that independent of
  // declaration order.
  function applyPlanes() {
    if (!explicitFar) camera.far = state.distance * 20;
    // Bounded by BOTH: a pure distance/1e4 derivation assumes far scales with
    // distance, which holds for the world-scale modules but not for
    // southern-stars (distance 1 inside a radius-1000 star sphere, far 4000),
    // where it produced a 4e7 ratio — worse than the fixed near it replaced.
    // Taking the max against far/1e5 caps the ratio at 1e5 everywhere.
    if (!explicitNear) camera.near = Math.max(state.distance / 1e4, camera.far / 1e5);
    camera.updateProjectionMatrix();
  }

  function apply() {
    const sp = Math.sin(state.polar), cp = Math.cos(state.polar);
    camera.position.set(
      state.target.x + state.distance * sp * Math.sin(state.azimuth),
      state.target.y + state.distance * cp,
      state.target.z + state.distance * sp * Math.cos(state.azimuth),
    );
    camera.lookAt(state.target);
    applyPlanes();
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

  apply();

  return {
    camera,
    orbit,
    zoom,
    setDistance(d) { state.distance = d; apply(); },
    setTarget(v) { state.target.copy(v); apply(); },
    setLinked(other) { linked = other; },
    dispose() { linked = null; },
  };
}
