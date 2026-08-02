import * as THREE from 'three';
import { MATERIALS } from './materials.js';

/** Flat ocean plane, sizeKm across, lying in the XZ plane at y = 0. */
export function makeOcean(sizeKm) {
  const geo = new THREE.PlaneGeometry(sizeKm, sizeKm, 1, 1);
  const mesh = new THREE.Mesh(geo, MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Whole sphere of radius radiusKm centred at the origin. For whole-globe views. */
export function makeGlobeOcean(radiusKm) {
  const geo = new THREE.SphereGeometry(radiusKm, 96, 64);
  return new THREE.Mesh(geo, MATERIALS.ocean);
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
  return new THREE.Mesh(geo, MATERIALS.ocean);
}

/**
 * Schematic ship: hull box plus mast and sail, total height ~scaleKm.
 * Origin sits at the waterline so it can be placed directly on a surface.
 */
export function makeShip(scaleKm) {
  const group = new THREE.Group();
  const hullH = scaleKm * 0.35;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(scaleKm * 0.9, hullH, scaleKm * 0.3), MATERIALS.hull);
  hull.position.y = hullH / 2;

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.02, scaleKm * 0.02, scaleKm * 0.65, 8),
    MATERIALS.sail);
  mast.position.y = hullH + scaleKm * 0.325;

  // The sail needs DoubleSide. It gets its OWN material: writing
  // `sail.material.side` would mutate the shared MATERIALS.sail singleton and
  // silently make every later phenomenon's use of it double-sided too, with
  // nothing ever reverting it.
  const sailMat = MATERIALS.sail.clone();
  sailMat.side = THREE.DoubleSide;
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.4, scaleKm * 0.45), sailMat);
  sail.position.set(scaleKm * 0.2, hullH + scaleKm * 0.35, 0);
  sail.userData.ownsMaterial = true;

  group.add(hull, mast, sail);
  return group;
}

export function makeObserverMarker() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), MATERIALS.sail);
  post.position.y = 0.25;
  g.add(post);
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

/** Vertical stick plus its cast shadow, for shadow-angle demonstrations. */
export function makeGnomon(heightKm, shadowLengthKm) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(heightKm * 0.04, heightKm * 0.04, heightKm, 8),
    MATERIALS.sail);
  stick.position.y = heightKm / 2;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(heightKm * 0.1, Math.max(1e-6, shadowLengthKm)),
    MATERIALS.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.z = shadowLengthKm / 2;
  g.add(stick, shadow);
  g.userData.setShadow = len => {
    shadow.scale.y = Math.max(1e-6, len) / Math.max(1e-6, shadowLengthKm);
    shadow.position.z = len / 2;
  };
  return g;
}

/** Flat disc of the whole world, radius radiusKm, in the XZ plane. */
export function makeDisc(radiusKm) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radiusKm, 128), MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Emissive sun sphere of the given diameter. */
export function makeSun(diameterKm) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(diameterKm / 2, 32, 24), MATERIALS.sunGlow);
}
