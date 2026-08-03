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
 * spanKm sizes the orthographic shadow frustum, and the ONLY thing that
 * matters about it is CONTAINMENT, not resolution. The frustum is a box
 * centred on the light's target — the world origin — with half-extent
 * spanKm/2 measured PERPENDICULAR TO THE LIGHT AXIS. Anything further off
 * that axis than the half-extent is simply outside the shadow map, and
 * Three.js reports it fully lit; it does not clamp, dim, or warn.
 *
 * That is how the previous sizing failed silently. It was chosen as
 * R_EARTH_KM * 0.5 to "fit the ~3,000 km gnomon region", reasoning from the
 * length of the shadows. But the gnomons do not stand at the origin: they
 * stand on the sphere's SURFACE, at perpendicular offsets of 3,198 / 4,515 /
 * 5,524 km from the light axis at the default latitudes. All three sat
 * outside a +/-1,593 km frustum, so the globe pane rendered zero shadows at
 * every setting — the visible half of this module's entire demonstration,
 * quietly absent.
 *
 * So size it by GEOMETRY POSITION, not shadow length: the frustum has to
 * contain the whole lit hemisphere plus whatever stands on it, at any
 * declination and any latitude the controls allow. The worst case is a
 * gnomon top on the limb, 6,371 + 300 = 6,671 km off the axis. R_EARTH_KM *
 * 2.1 gives a half-extent of 6,690 km, which covers it with nothing to spare
 * and nothing wasted.
 *
 * Resolution is not the binding constraint at that size: 13,379 km across a
 * 2048 map is 6.5 km per texel against the shortest shadow the defaults
 * produce (174 km), still a 27x margin.
 */
export function makeParallelSun(spanKm) {
  const light = new THREE.DirectionalLight(0xfff4e0, 2.4);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const h = spanKm / 2;
  const cam = light.shadow.camera;
  cam.left = -h; cam.right = h; cam.top = h; cam.bottom = -h;
  // far must reach past the far limb: the light sits at 4 R_EARTH_KM and the
  // sphere is another R_EARTH_KM beyond the origin, ~31,900 km in all.
  // spanKm * 8 is 107,000 km — ample.
  cam.near = 1; cam.far = spanKm * 8;
  cam.updateProjectionMatrix();
  // normalBias, not constant bias: it scales with surface orientation, which
  // is what a 300 km stick standing on a 6,371 km sphere needs. Tied to
  // spanKm so it stays proportionate to the texel size it exists to cover.
  light.shadow.normalBias = spanKm * 1e-3;
  return light;
}

/**
 * Non-shadow-casting fill for a pane that has no sun of its own, so that a
 * split-screen comparison is not also a brightness comparison.
 *
 * Deliberately NOT a light in viewport.js: the fixed DirectionalLight that
 * used to live there lit every scene from a corner unrelated to where the sun
 * actually was, which became a visible contradiction the moment anything cast
 * a shadow. This is opt-in, per module, and castShadow stays false — it adds
 * illumination, never geometry-implying shadows that would compete with the
 * pane's real evidence.
 */
export function makeFillSun(intensity = 1.4) {
  const light = new THREE.DirectionalLight(0xfff4e0, intensity);
  light.castShadow = false;
  return light;
}
