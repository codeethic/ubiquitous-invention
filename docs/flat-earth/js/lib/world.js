import * as THREE from 'three';

/**
 * Lighting rigs whose TYPE encodes the model being tested.
 *
 * Eratosthenes' argument is entirely about ray divergence: the flat model
 * needs a nearby sun so that rays strike observers at different latitudes at
 * different angles, and the globe model has a sun 1 AU away whose rays are
 * parallel. Using a DirectionalLight for both panes would silently give the
 * flat model the globe's geometry and destroy the comparison. The light type
 * is therefore load-bearing, not a rendering detail.
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

/**
 * Diverging-ray sun for the flat pane, at the flat model's own stated sun
 * altitude. Gnomon sites sit at AE radii of roughly 5,000-7,200 km, so the
 * frustum spans ~10,000 km: 4.9 km per texel at 2048, a 60x margin against a
 * 300 km shadow.
 */
export function makeLocalSun(altitudeKm, spanKm) {
  const half = Math.atan2(spanKm / 2, altitudeKm);
  const light = new THREE.SpotLight(0xfff4e0, 2.4, 0, Math.min(half * 1.2, 1.4), 0.15, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = altitudeKm * 0.05;
  light.shadow.camera.far = altitudeKm * 4;
  light.shadow.normalBias = spanKm * 1e-3;
  return light;
}
