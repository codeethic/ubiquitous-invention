import * as THREE from 'three';
import { MATERIALS, SURFACE } from './materials.js';
import { OCEAN_DISPLACEMENT_M } from './signal-budget.js';

/**
 * Flat ocean plane, sizeKm across, lying in the XZ plane at y = 0.
 *
 * Segmented for normal-map sampling ONLY. The plane is built at exactly
 * y = 0 with no vertical displacement: OCEAN_DISPLACEMENT_M is asserted zero
 * in test/signal-budget.test.js because wave crests of even a metre or two
 * would be comparable to the 3.79 m of hidden hull the horizon module exists
 * to measure, and would swallow the entire effect.
 */
export function makeOcean(sizeKm) {
  const geo = new THREE.PlaneGeometry(sizeKm, sizeKm, 64, 64);
  if (OCEAN_DISPLACEMENT_M !== 0) {
    throw new Error('Ocean displacement must be zero; see signal-budget.js');
  }
  const mesh = new THREE.Mesh(geo, MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/** Whole sphere of radius radiusKm centred at the origin. For whole-globe views. */
export function makeGlobeOcean(radiusKm) {
  const geo = new THREE.SphereGeometry(radiusKm, 96, 64);
  const mesh = new THREE.Mesh(geo, SURFACE.globe);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Finely tessellated spherical cap centred on the +Y pole, spanning extentKm of
 * surface arc. Use this — NOT makeGlobeOcean — for any view that looks along the
 * surface at human scale.
 *
 * Why: makeGlobeOcean's 64 height segments put one flat facet across 313 km of
 * arc, with a 1,919 m sagitta. Any effect smaller than that (the horizon module's
 * hidden height is 3.8 m) is swallowed entirely and the globe renders flat. A
 * 60 km cap at 160 radial bands gives 375 m bands and a 2.8 mm sagitta instead.
 */
export function makeGlobeCap(radiusKm, extentKm, radialSegments = 160, angularSegments = 96) {
  const thetaLength = extentKm / radiusKm;
  const geo = new THREE.SphereGeometry(
    radiusKm, angularSegments, radialSegments, 0, Math.PI * 2, 0, thetaLength);
  const mesh = new THREE.Mesh(geo, MATERIALS.ocean);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Ship: tapered hull, deck, mast, boom and two sails, total height ~scaleKm.
 * Origin sits at the waterline so it can be placed directly on a surface.
 *
 * Detail here is free: horizon measures how much of the hull is OCCLUDED, and
 * occlusion depends on the hull's silhouette against the limb, not on how the
 * hull is shaded. A more convincing ship makes the disappearing-hull effect
 * easier to read, not harder.
 */
export function makeShip(scaleKm) {
  const group = new THREE.Group();
  const hullH = scaleKm * 0.35;

  // CylinderGeometry with 4 radial segments and a smaller top radius gives a
  // tapered, boat-like hull for one geometry instead of a box.
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.30, scaleKm * 0.16, hullH, 4, 1),
    MATERIALS.hull);
  hull.rotation.y = Math.PI / 4;
  hull.scale.set(1.5, 1, 0.55);
  hull.position.y = hullH / 2;
  hull.castShadow = true;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(scaleKm * 0.78, scaleKm * 0.03, scaleKm * 0.24),
    MATERIALS.deck);
  deck.position.y = hullH;
  deck.castShadow = true;

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.015, scaleKm * 0.022, scaleKm * 0.75, 8),
    MATERIALS.deck);
  mast.position.y = hullH + scaleKm * 0.375;
  mast.castShadow = true;

  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.01, scaleKm * 0.01, scaleKm * 0.34, 6),
    MATERIALS.deck);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(scaleKm * 0.10, hullH + scaleKm * 0.10, 0);

  // The sails need DoubleSide. They get their OWN material: writing
  // `sail.material.side` would mutate the shared MATERIALS.sail singleton and
  // silently make every later phenomenon's use of it double-sided too, with
  // nothing ever reverting it.
  const sailMat = MATERIALS.sail.clone();
  sailMat.side = THREE.DoubleSide;

  const main = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.34, scaleKm * 0.46), sailMat);
  main.position.set(scaleKm * 0.10, hullH + scaleKm * 0.36, 0);
  main.castShadow = true;
  main.userData.ownsMaterial = true;

  const jib = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.22, scaleKm * 0.32), sailMat);
  jib.position.set(scaleKm * -0.16, hullH + scaleKm * 0.30, 0);
  jib.castShadow = true;

  group.add(hull, deck, mast, boom, main, jib);
  return group;
}

/**
 * Observer marker: a post with a bright cap, sized against the scene it sits
 * in rather than a fixed 0.5 km.
 *
 * The last visual checklist recorded this as "present at the southern limb but
 * a near-invisible speck" — correct, and unreadable. midnight-sun's claim is
 * about where this marker points, so it has to be visible to be evidence.
 */
export function makeObserverMarker(scaleKm = 200) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.06, scaleKm * 0.06, scaleKm, 8),
    MATERIALS.sail);
  post.position.y = scaleKm / 2;
  post.castShadow = true;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(scaleKm * 0.16, 12, 8), MATERIALS.sunGlow);
  cap.position.y = scaleKm;
  g.add(post, cap);
  return g;
}

/**
 * Recursively free geometry owned by a subtree. Shared MATERIALS are never
 * freed — only materials a mesh explicitly owns, flagged with
 * `userData.ownsMaterial` (e.g. the ship's cloned double-sided sail).
 */
export function disposeTree(root) {
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.userData?.ownsMaterial && obj.material) obj.material.dispose();
  });
}

/**
 * Vertical stick that CASTS a real shadow.
 *
 * The old version drew its own shadow: a black plane whose length physics
 * computed and wrote via `userData.setShadow`. That made the picture an
 * illustration of the number rather than evidence for it. The shadow is now
 * cast by the light, so a disagreement between the rendered shadow and the
 * reported sun angle would be visible instead of impossible.
 *
 * The old second parameter (shadowLengthKm) is gone with the plane it sized.
 */
export function makeGnomon(heightKm) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(heightKm * 0.04, heightKm * 0.05, heightKm, 12),
    MATERIALS.sail);
  stick.position.y = heightKm / 2;
  stick.castShadow = true;
  stick.receiveShadow = true;
  g.add(stick);
  return g;
}

/** Flat disc of the whole world, radius radiusKm, in the XZ plane. */
export function makeDisc(radiusKm) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radiusKm, 256), SURFACE.disc);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Emissive sun sphere of the given diameter, WITH its light attached.
 *
 * Before this, both scenes lit from a DirectionalLight hard-coded at (1,1,1)
 * while the sun mesh was moved independently by physics. The glowing sphere
 * and the illumination already disagreed; nothing cast shadows, so it never
 * showed. Parenting the light to the sun means every existing physics call
 * that moves the sun moves the light too, permanently in sync.
 *
 * The caller must set `sun.userData.light.target` to an object at the world
 * origin — normally its own root — or Three.js aims the light at a default
 * target that is never added to the scene.
 */
export function makeSun(diameterKm) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(diameterKm / 2, 48, 32), MATERIALS.sunGlow);
  const light = new THREE.DirectionalLight(0xfff4e0, 2.2);
  g.add(mesh, light);
  g.userData.light = light;
  g.userData.mesh = mesh;
  return g;
}
