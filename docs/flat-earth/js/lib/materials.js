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
  domeGlass: new THREE.MeshBasicMaterial({
    color: 0x4a6fa5, transparent: true, opacity: 0.12, side: THREE.BackSide,
  }),
  shadow:    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.85, transparent: true }),
  starPoint: new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.6, sizeAttenuation: false }),
  // Observer-marker cap. Deliberately its OWN material, separate from
  // sunGlow/sunSprite: it must never receive the sun-disc texture (see
  // sunSprite below), just a plain bright colour.
  marker:    new THREE.MeshBasicMaterial({ color: 0xffd27f }),
  // Shared material for makeSun's camera-facing Sprite. Kept apart from
  // sunGlow (the untextured fallback sphere) and marker (the observer cap)
  // because both of those are SphereGeometry/plain meshes: the sun texture's
  // square-canvas alpha-0 corners wrap onto a sphere's equirectangular UVs
  // and punch holes in it, and sharing it with the marker would defeat the
  // fix that made the marker visible by re-skinning it as a tiny sun.
  sunSprite: new THREE.SpriteMaterial({ color: 0xffd27f }),
};

/**
 * Per-surface material used where a textured globe/disc map is wanted.
 *
 * 0x11314f is the UNTEXTURED FALLBACK colour — a deep ocean blue for the case
 * where texture generation failed and these materials are all the surface has.
 * It is set here, in the constructor, and NOT left in place once a map is
 * attached; see the warning in applyMaterials().
 */
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

  // COLOUR MULTIPLIES MAP. This is the trap that made the entire geography
  // feature invisible once already: MeshStandardMaterial's fragment shader
  // computes `diffuse = color * texture2D(map, uv)`, so leaving the dark
  // 0x11314f fallback in place multiplies a texture of mean RGB (47,78,98)
  // by (17,49,79)/255 and renders it essentially black. White is the identity
  // for that multiply and is the only correct value once a map exists.
  //
  // Set HERE rather than in the constructor above, because the constructor's
  // dark colour is still needed on the no-texture path — this function
  // returns early in that case and the fallback survives. Whoever next feels
  // the urge to "restore the nice blue" on these two materials: that blue is
  // a tint over the map, not a base colour.
  SURFACE.globe.color.setHex(0xffffff);
  SURFACE.globe.map = TEXTURES.earth;
  SURFACE.globe.normalMap = TEXTURES.earthNormal;
  SURFACE.globe.normalScale = new THREE.Vector2(0.6, 0.6);
  SURFACE.globe.needsUpdate = true;

  SURFACE.disc.color.setHex(0xffffff);
  SURFACE.disc.map = TEXTURES.disc;
  SURFACE.disc.normalMap = TEXTURES.discNormal;
  SURFACE.disc.normalScale = new THREE.Vector2(0.6, 0.6);
  SURFACE.disc.needsUpdate = true;

  // Shading detail only. The ocean geometry stays perfectly flat; see
  // OCEAN_DISPLACEMENT_M in signal-budget.js.
  //
  // The tile count lives on the texture (OCEAN_TILE_REPEAT in textures.js),
  // not here, because RepeatWrapping without a repeat is just a single
  // stretched copy — the two settings are one decision and must not drift
  // apart in two files.
  MATERIALS.ocean.normalMap = TEXTURES.oceanNormal;
  MATERIALS.ocean.normalScale = new THREE.Vector2(0.35, 0.35);
  MATERIALS.ocean.roughness = 0.45;
  MATERIALS.ocean.needsUpdate = true;

  // NOT MATERIALS.sunGlow: that material is also used by makeObserverMarker's
  // cap (a SphereGeometry) and by makeSun's own no-texture fallback sphere.
  // The sun-disc texture has alpha 0 outside its circular disc; wrapped onto
  // a sphere's equirectangular UVs it punches holes in the sphere, and if
  // shared with the marker it would re-skin the marker as a tiny sun instead
  // of a plain bright cap. sunSprite is a Sprite-only material — a sprite is
  // an exact circle from every angle, so the disc texture never needs to
  // wrap onto anything.
  MATERIALS.sunSprite.map = TEXTURES.sun;
  MATERIALS.sunSprite.transparent = true;
  MATERIALS.sunSprite.needsUpdate = true;
}

export function disposeMaterials() {
  for (const m of Object.values(MATERIALS)) m.dispose();
  for (const m of Object.values(SURFACE)) m.dispose();
}
