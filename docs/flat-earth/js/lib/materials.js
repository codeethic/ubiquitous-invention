import * as THREE from 'three';
import { TEXTURES } from './textures.js';

/**
 * Shared material singletons, upgraded in place once textures exist.
 *
 * Still singletons, still never disposed per-module — disposeTree only frees
 * materials a mesh explicitly owns via `userData.ownsMaterial`. Mutating them
 * in applyMaterials() rather than replacing them means every mesh already
 * built keeps working, and no phenomenon needs to know textures arrived.
 */
export const MATERIALS = {
  ocean:     new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.7 }),
  land:      new THREE.MeshStandardMaterial({ color: 0x2f4f3a, roughness: 0.9 }),
  hull:      new THREE.MeshStandardMaterial({ color: 0x8a3324, roughness: 0.55, metalness: 0.05 }),
  deck:      new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.85 }),
  sail:      new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.8 }),
  sunGlow:   new THREE.MeshBasicMaterial({ color: 0xffd27f }),
  moon:      new THREE.MeshStandardMaterial({ color: 0xb9b9b4, roughness: 1.0 }),
  domeGlass: new THREE.MeshBasicMaterial({
    color: 0x4a6fa5, transparent: true, opacity: 0.12, side: THREE.BackSide,
  }),
  shadow:    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.85, transparent: true }),
  starPoint: new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.6, sizeAttenuation: false }),
};

/** Per-surface material used where a textured globe/disc map is wanted. */
export const SURFACE = {
  globe: new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.85 }),
  disc:  new THREE.MeshStandardMaterial({ color: 0x11314f, roughness: 0.85 }),
};

/**
 * Attach whatever textures were generated. Safe to call when generation
 * failed: every field is null then, nothing is assigned, and the materials
 * keep the flat colours they were constructed with.
 */
export function applyMaterials() {
  if (!TEXTURES.ready) return;

  SURFACE.globe.map = TEXTURES.earth;
  SURFACE.globe.normalMap = TEXTURES.earthNormal;
  SURFACE.globe.normalScale = new THREE.Vector2(0.6, 0.6);
  SURFACE.globe.needsUpdate = true;

  SURFACE.disc.map = TEXTURES.disc;
  SURFACE.disc.normalMap = TEXTURES.discNormal;
  SURFACE.disc.normalScale = new THREE.Vector2(0.6, 0.6);
  SURFACE.disc.needsUpdate = true;

  // Shading detail only. The ocean geometry stays perfectly flat; see
  // OCEAN_DISPLACEMENT_M in signal-budget.js.
  MATERIALS.ocean.normalMap = TEXTURES.oceanNormal;
  MATERIALS.ocean.normalScale = new THREE.Vector2(0.35, 0.35);
  MATERIALS.ocean.roughness = 0.45;
  MATERIALS.ocean.needsUpdate = true;

  MATERIALS.moon.map = TEXTURES.moon;
  MATERIALS.moon.needsUpdate = true;

  MATERIALS.sunGlow.map = TEXTURES.sun;
  MATERIALS.sunGlow.transparent = true;
  MATERIALS.sunGlow.needsUpdate = true;
}

export function disposeMaterials() {
  for (const m of Object.values(MATERIALS)) m.dispose();
  for (const m of Object.values(SURFACE)) m.dispose();
}
