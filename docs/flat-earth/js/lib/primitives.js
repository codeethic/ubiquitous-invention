import * as THREE from 'three';
import { MATERIALS, SURFACE } from './materials.js';
import { GLOBE_TEXTURE_ROTATION_Y } from './map-projection.js';
import { OCEAN_DISPLACEMENT_M } from './signal-budget.js';
import { TEXTURES } from './textures.js';

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

/**
 * Whole sphere of radius radiusKm centred at the origin. For whole-globe views.
 *
 * The Y rotation is LOAD-BEARING, not a cosmetic tweak: SphereGeometry's UV
 * seam and this app's longitude convention disagree by a uniform 90°, so
 * without it every coastline on the globe sits 90° east of where every marker,
 * route and terminator says it should be. The full derivation, and why the
 * fix belongs on the mesh rather than in equirectUV, is on
 * GLOBE_TEXTURE_ROTATION_Y in map-projection.js. test/map-projection.test.js
 * asserts it against a real SphereGeometry.
 *
 * Only the surface mesh is rotated. Callers add markers to the enclosing
 * Group, never to this mesh, so nothing else moves with it.
 */
export function makeGlobeOcean(radiusKm) {
  const geo = new THREE.SphereGeometry(radiusKm, 96, 64);
  const mesh = new THREE.Mesh(geo, SURFACE.globe);
  mesh.rotation.y = GLOBE_TEXTURE_ROTATION_Y;
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
 *
 * Deliberately NOT given makeGlobeOcean's GLOBE_TEXTURE_ROTATION_Y. It is the
 * same SphereGeometry and so has the same 90° UV offset, but nothing
 * geographic is ever painted on it: it wears MATERIALS.ocean, whose only
 * texture is the tiling ocean-ripple NORMAL map. That map is isotropic noise
 * with no longitude in it, so rotating it would change nothing observable —
 * and its sole consumer, `horizon`, sits at a nameless point on an open ocean
 * whose readout depends on the limb's shape, not on which sea it is.
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
 *
 * No castShadow flags here. The ship's only consumer, `horizon`, contains no
 * shadow-casting light at all (only viewport.js's ambient + hemisphere fill),
 * so the five flags this used to carry were dead configuration that read as
 * if shadows were expected. If a caster is ever added to a scene holding a
 * ship, set them then — deliberately, with the sizes checked.
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

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(scaleKm * 0.78, scaleKm * 0.03, scaleKm * 0.24),
    MATERIALS.deck);
  deck.position.y = hullH;

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(scaleKm * 0.015, scaleKm * 0.022, scaleKm * 0.75, 8),
    MATERIALS.deck);
  mast.position.y = hullH + scaleKm * 0.375;

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
  main.userData.ownsMaterial = true;

  const jib = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleKm * 0.22, scaleKm * 0.32), sailMat);
  jib.position.set(scaleKm * -0.16, hullH + scaleKm * 0.30, 0);

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
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(scaleKm * 0.16, 12, 8), MATERIALS.marker);
  cap.position.y = scaleKm;
  g.add(post, cap);
  return g;
}

/**
 * Recursively free geometry owned by a subtree. Shared MATERIALS are never
 * freed — only materials a mesh explicitly owns, flagged with
 * `userData.ownsMaterial` (e.g. the ship's cloned double-sided sail).
 *
 * `THREE.Sprite` is deliberately skipped: every Sprite in the app shares ONE
 * module-level BufferGeometry internal to Three.js (it's how Sprite is
 * implemented, not something we opted into). Disposing it here would free
 * that shared geometry on the very first module switch and permanently break
 * every sprite created afterwards, app-wide. Do not "simplify" this away.
 *
 * Lights in the subtree are disposed too. A shadow-casting light owns a
 * render target — eratosthenes' sun holds a 2048x2048 depth map, 16 MB of
 * VRAM — and geometry.dispose() does not touch it, so every rebuild orphaned
 * a fresh one. Handled HERE rather than in each module's dispose() on
 * purpose: this kills the whole class of leak, so a future module that adds a
 * caster cannot reintroduce it by forgetting. Safe for the app's other lights
 * — makeSun's DirectionalLight never casts, so its shadow has no map and
 * dispose() is a no-op, and the ambient/hemisphere fills live on the scene in
 * viewport.js, outside every module root, so disposeTree never reaches them.
 */
export function disposeTree(root) {
  root.traverse(obj => {
    if (obj.geometry && !obj.isSprite) obj.geometry.dispose();
    if (obj.userData?.ownsMaterial && obj.material) obj.material.dispose();
    if (obj.isLight) obj.dispose();
  });
}

/**
 * Vertical stick, in one of two modes depending on which pane it stands in.
 *
 * Default (`drawnShadow: false`): the stick CASTS a real shadow and draws
 * none of its own. Used by the globe pane, where the demonstration's whole
 * point is that the rendered shadow is a *consequence* of a light placed
 * from the same solar declination the readout uses — geometry produces the
 * number instead of illustrating it.
 *
 * `drawnShadow: true`: the stick instead draws its own shadow, a plane whose
 * length is written by hand via `userData.setShadow`, and does not cast a
 * real one. This is for the flat pane, which shows *observed* shadow data,
 * not a forward simulation — see the comment in eratosthenes.js `update()`
 * for why a real light there could only ever hide the model's contradiction.
 * Restores the pre-shadow-casting drawn-shadow mechanism, scoped to just
 * this mode so the globe pane keeps its real shadow.
 */
export function makeGnomon(heightKm, { drawnShadow = false } = {}) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(heightKm * 0.04, heightKm * 0.05, heightKm, 12),
    MATERIALS.sail);
  stick.position.y = heightKm / 2;
  g.add(stick);

  if (drawnShadow) {
    // Base length is arbitrary and nonzero; userData.setShadow rescales it to
    // whatever length the caller reports, so the base itself carries no
    // meaning beyond avoiding a zero-size plane before the first update().
    const base = heightKm;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(heightKm * 0.1, base),
      MATERIALS.shadow);
    shadow.rotation.x = -Math.PI / 2;
    // Lifted off the disc surface so it is not exactly coplanar with it —
    // otherwise near/far depth precision decides which one wins the z-test.
    shadow.position.y = heightKm * 0.01;
    shadow.position.z = base / 2;
    g.add(shadow);
    g.userData.setShadow = len => {
      shadow.scale.y = Math.max(1e-6, len) / base;
      shadow.position.z = len / 2;
    };
  } else {
    stick.castShadow = true;
    stick.receiveShadow = true;
  }

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
 * Emissive sun of the given diameter, WITH its light attached.
 *
 * Renders as a camera-facing Sprite when the procedural sun-disc texture is
 * available: a sprite is an exact circle from every angle, which preserves
 * limb darkening and gives sun-size a clean silhouette to measure the sun's
 * apparent angular diameter against. A SphereGeometry cannot be used with
 * this texture — the disc texture's alpha-0 corners (outside its circular
 * disc) wrap onto the sphere's equirectangular UVs and punch holes in it,
 * corrupting exactly the silhouette sun-size measures.
 *
 * Falls back to the old plain emissive sphere when texture generation failed
 * (TEXTURES.ready is false): an untextured SpriteMaterial renders as a
 * bright SQUARE, which would be a regression from the sphere this replaces.
 * Gated on TEXTURES.ready rather than TEXTURES.sun directly, so this branch
 * and applyMaterials()'s decision to populate sunSprite's map can never
 * disagree — generateTextures() can otherwise throw after TEXTURES.sun is
 * assigned but before ready flips true, leaving .sun truthy with no map
 * ever applied.
 *
 * DEFERRED GENERATION MAKES THE FALLBACK REACHABLE ON THE HAPPY PATH. Textures
 * are now built after first paint (see scheduleTextureUpgrade in main.js), so
 * for the ~1.7 s before they land TEXTURES.ready is false during NORMAL,
 * SUCCESSFUL operation and not only after a failure. A module built inside
 * that window gets the fallback sphere and keeps it until it is next rebuilt,
 * while the disc and globe around it upgrade themselves — those are materials
 * mutated in place, this is a build-time branch.
 *
 * That is accepted deliberately rather than papered over:
 *
 *  - The exposure is small and the fallback is not a degradation. `horizon` is
 *    MODULES[0] and has no sun, so the default path never sees it; only
 *    midnight-sun and sun-size call makeSun at all. A sphere's silhouette is
 *    an exact circle from every angle, at the same apparent diameter the
 *    sprite was scaled to reproduce, so sun-size's measurement and its
 *    declared maxDetail: 0 are unaffected. What is missing is limb darkening
 *    — decoration.
 *
 *  - Re-activating the module when textures land would cost more than it
 *    buys. activate() resets state to the module's defaults and rebuilds both
 *    camera rigs, so a user who had already moved a slider or orbited the view
 *    would watch both snap back 1.7 s in, on an app that was working. It would
 *    also give a spontaneous build the chance to raise an error card over a
 *    healthy page. That is a bad trade for limb darkening.
 *
 *  - Generating just the cheap 256 px sun disc eagerly (~4 ms; it needs no
 *    coastlines and none of the expensive paint loops) would close the window
 *    entirely, but only by adding a second readiness flag alongside
 *    TEXTURES.ready. A split source of truth between makeSun and
 *    applyMaterials is precisely the bug Task 6's second fix round existed to
 *    eliminate, and it is not worth reopening for this.
 *
 * It is self-healing: makeSun re-reads TEXTURES.ready on every build, so the
 * next switch into the module gives it the sprite.
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
  let visual;
  if (TEXTURES.ready) {
    visual = new THREE.Sprite(MATERIALS.sunSprite);
    visual.scale.set(diameterKm, diameterKm, 1);
  } else {
    visual = new THREE.Mesh(
      new THREE.SphereGeometry(diameterKm / 2, 48, 32), MATERIALS.sunGlow);
  }
  const light = new THREE.DirectionalLight(0xfff4e0, 2.2);
  g.add(visual, light);
  g.userData.light = light;
  g.userData.mesh = visual;
  return g;
}
