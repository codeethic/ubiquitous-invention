import * as THREE from 'three';
import { MATERIALS } from './materials.js';

/** Flat ocean plane, sizeKm across, lying in the XZ plane at y = 0. */
export function makeOcean(sizeKm) {
  const geo = new THREE.PlaneGeometry(sizeKm, sizeKm, 1, 1);
  const mesh = new THREE.Mesh(geo, MATERIALS.ocean);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Sphere of radius radiusKm centred at the origin. */
export function makeGlobeOcean(radiusKm) {
  const geo = new THREE.SphereGeometry(radiusKm, 96, 64);
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

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.4, scaleKm * 0.45), MATERIALS.sail);
  sail.position.set(scaleKm * 0.2, hullH + scaleKm * 0.35, 0);
  sail.material.side = THREE.DoubleSide;

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

/** Recursively free geometry owned by a subtree. Shared materials are not freed. */
export function disposeTree(root) {
  root.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
}
