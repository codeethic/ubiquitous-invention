import * as THREE from 'three';

/**
 * Lighting rig for the globe pane.
 *
 * Eratosthenes' module puts the globe's sun 1 AU away, so its rays are
 * effectively parallel: a DirectionalLight is the physically correct choice,
 * and it is the only light this module still provides. A local, diverging
 * source for the flat pane (`makeLocalSun`, previously here) was removed in
 * a fix round: the flat pane no longer casts a shadow at all, it draws one
 * as data (see eratosthenes.js), so no flat-pane light type is needed. See
 * that file's `update()` comment for why a forward-simulated light there
 * would tautologically hide the exact contradiction the module exists to
 * show, independent of the cone-angle bug that also motivated removing it.
 */

/**
 * Parallel-ray sun for the globe pane.
 *
 * spanKm sizes the orthographic shadow frustum. At the default 3,000 km span
 * with a 2048 map that is 1.5 km per texel against a 300 km gnomon shadow — a
 * 200x margin, comfortably clear of the acne/peter-panning regime.
 */
export function makeParallelSun(spanKm) {
  const light = new THREE.DirectionalLight(0xfff4e0, 2.4);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const h = spanKm / 2;
  const cam = light.shadow.camera;
  cam.left = -h; cam.right = h; cam.top = h; cam.bottom = -h;
  cam.near = 1; cam.far = spanKm * 8;
  cam.updateProjectionMatrix();
  // normalBias, not constant bias: it scales with surface orientation, which
  // is what a 300 km stick standing on a 6,371 km sphere needs.
  light.shadow.normalBias = spanKm * 1e-3;
  return light;
}
