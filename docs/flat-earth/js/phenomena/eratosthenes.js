import * as THREE from 'three';
import { R_EARTH_KM, FLAT_DISC_RADIUS_KM, DEG, ERATOSTHENES_MIN_LAT_DEG } from '../physics/constants.js';
import {
  solarDeclinationDeg, globeRadiusFromPairKm, flatSunAltitudeFromPairKm,
} from '../physics/solar.js';
import { azimuthalEquidistantRadiusKm } from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, makeGnomon, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';
import { makeParallelSun, makeFillSun } from '../lib/world.js';

const STICK_KM = 300;   // exaggerated so the shadow is visible at world scale

let flatRoot, globeRoot, flatRig, globeRig, flatGnomons, globeGnomons;
let globeSun, globeSunTarget, flatFill, flatFillTarget;

const shadowLength = (stickKm, zenithDeg) => stickKm * Math.tan(zenithDeg * DEG);

export default {
  id: 'eratosthenes',
  title: 'Eratosthenes: Shadow Angles',
  claim: 'Shadow angles are explained by a small, nearby sun above a flat Earth.',

  controls: [
    // The minimum comes from constants.js, NOT a literal. It is load-bearing:
    // globeRadiusFromPairKm is only valid while all observers sit on the same
    // side of the subsolar latitude. Allowing A down to 5°N would let the sun
    // pass between A and B near the June solstice — at A=5 / B=41 / declination
    // 23 the denominator is exactly zero and the globe pane would report
    // "Earth radius: Infinity km", destroying the very consistency this module
    // exists to demonstrate. Sourcing it from a constant lets a pure test
    // enforce the bound; a literal here could only be documented, not checked,
    // because this file imports Three.js and so cannot be loaded under node --test.
    { id: 'latA', label: 'Observer A', min: ERATOSTHENES_MIN_LAT_DEG, max: 40, step: 1, unit: '°N' },
    { id: 'latB', label: 'Observer B', min: 41, max: 55, step: 1, unit: '°N' },
    { id: 'latC', label: 'Observer C', min: 56, max: 80, step: 1, unit: '°N' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { latA: 30, latB: 45, latC: 60, dayOfYear: 81 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));

    flatGnomons = [];
    globeGnomons = [];
    for (let i = 0; i < 3; i += 1) {
      // Flat pane: shadows are drawn as observed data (see update()).
      // Globe pane: shadows are cast by a real light (see below).
      const f = makeGnomon(STICK_KM, { drawnShadow: true });
      const g = makeGnomon(STICK_KM);
      flatGnomons.push(f); globeGnomons.push(g);
      flatRoot.add(f); globeRoot.add(g);
    }

    // The globe's sun is 1 AU away, so its rays are parallel: a real
    // DirectionalLight casts the globe pane's shadows, and their length falls
    // out of the renderer's own shadow math as a consequence of geometry (see
    // the derivation in update()) rather than being an authored value. A
    // matching local, diverging light for the flat pane was tried and removed
    // in a fix round: forward-simulating a single flat sun is tautologically
    // self-consistent, so it can only ever draw shadows that agree with
    // themselves and can never show the contradiction this module exists to
    // demonstrate. The flat pane instead draws the same observed shadow
    // lengths as data — see update() for the full reasoning.
    //
    // The span must contain the LIT HEMISPHERE, not the shadows: the
    // orthographic shadow frustum is centred on the light's target at the
    // origin, and the gnomons stand out on the surface, thousands of km off
    // that axis. See makeParallelSun for the arithmetic and for what the
    // previous, too-small value silently did (nothing — no shadow at all).
    globeSun = makeParallelSun(R_EARTH_KM * 2.1);
    globeSunTarget = new THREE.Object3D();
    globeSun.target = globeSunTarget;
    globeRoot.add(globeSun, globeSunTarget);
    // globeSun's 2048x2048 depth target is freed by disposeTree() in
    // dispose(), which disposes lights as well as geometry — see primitives.js.

    // The flat pane has no sun of its own and must not get one: a
    // forward-simulated flat sun is the tautology this module exists to
    // refute (see update()). But with nothing but viewport.js's fill it also
    // rendered at roughly a third of the globe pane's brightness, and two
    // panes whose entire purpose is side-by-side comparison cannot differ
    // that much for a reason the viewer cannot see. So: a parallel FILL that
    // casts nothing and predicts nothing.
    //
    // Intensity 1.8 against the globe's 2.4. Not equal on purpose — the flat
    // disc is one plane facing the light almost head-on, so it sits at a
    // near-uniform 1.8 * 0.95 = 1.71, whereas a Lambertian sphere lit
    // head-on averages 2/3 of its peak over the visible disc, 2.4 * 0.67 =
    // 1.6. Matching the MEANS is what makes the two panes read alike;
    // matching the peaks would leave the flat pane visibly the brighter one.
    //
    // Direction is up-and-inward, agreeing in sense with the shadows the flat
    // gnomons draw (which run outward, away from the disc centre). It is a
    // fixed direction and makes no claim about where a flat sun would be.
    flatFill = makeFillSun(1.8);
    flatFillTarget = new THREE.Object3D();
    flatFill.position.set(0, FLAT_DISC_RADIUS_KM * 3, -FLAT_DISC_RADIUS_KM);
    flatFill.target = flatFillTarget;
    flatRoot.add(flatFill, flatFillTarget);

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.6, far: 1e6 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 3.2, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const decl = solarDeclinationDeg(state.dayOfYear);
    const lats = [state.latA, state.latB, state.latC];

    lats.forEach((lat, i) => {
      // Flat pane: observers laid out along the AE radius from the disc centre.
      const r = azimuthalEquidistantRadiusKm(lat);
      flatGnomons[i].position.set(0, 0, r);

      // Globe pane: observers on the surface, sticks along the local vertical.
      const phi = lat * DEG;
      const pos = new THREE.Vector3(
        0, R_EARTH_KM * Math.sin(phi), R_EARTH_KM * Math.cos(phi));
      globeGnomons[i].position.copy(pos);
      globeGnomons[i].lookAt(pos.clone().multiplyScalar(2));
      globeGnomons[i].rotateX(Math.PI / 2);

      // The shadow drawn here is the OBSERVATION, not a model's prediction: a
      // stick of height STICK_KM at zenith angle |lat - decl| casts a shadow
      // STICK_KM * tan(|lat - decl|) long. This is the same length the globe
      // pane's real light produces (see the derivation below), because both
      // panes are showing the same measured fact. The flat pane draws it by
      // hand instead of casting it because the model's failure is precisely
      // that no single sun height, forward-simulated, reproduces all three
      // observed lengths at once (that is what readout()'s
      // flatSunAltitudeFromPairKm disagreement shows) — a real light here
      // would be internally consistent by construction and could never
      // expose that contradiction. Only inferring a height FROM the fixed
      // data can fail to agree with itself; simulating forward from an
      // assumed height cannot.
      const len = shadowLength(STICK_KM, Math.abs(lat - decl));
      flatGnomons[i].userData.setShadow(len);
    });

    // The globe sun is placed from `decl` — the same value readout() feeds to
    // globeRadiusFromPairKm and flatSunAltitudeFromPairKm, and the same value
    // used just above for the flat pane's drawn shadow lengths. All three
    // numbers on screen therefore share one input.
    //
    // Derivation that the globe's CAST shadow reproduces
    // STICK_KM * tan(|lat - decl|) as a consequence of geometry, not as an
    // authored number: the light sits at (0, sin(d), cos(d)) * 4 R_EARTH_KM
    // and targets the origin, so its rays travel in the fixed direction
    // -(0, sin(d), cos(d)) everywhere (a DirectionalLight's rays don't
    // depend on position — that's what "1 AU away" buys the globe model).
    // The direction FROM the surface TOWARD the sun is therefore
    // (0, sin(d), cos(d)): the local vertical at latitude `decl`, i.e. the
    // subsolar point. A gnomon at latitude `lat` stands along ITS OWN local
    // vertical, (0, sin(phi), cos(phi)). Both are unit vectors in the same
    // y-z plane, so the angle between "straight up" and "toward the sun" at
    // that gnomon is exactly |lat - decl| — the zenith angle. A stick of
    // height STICK_KM standing at zenith angle |lat - decl| casts a shadow
    // of length STICK_KM * tan(|lat - decl|) across the local horizontal
    // plane by ordinary shadow geometry, which is exactly what
    // shadowLength() computes by hand above for the flat pane. Here it falls
    // out of the renderer's shadow-mapping math instead of being written
    // down: the globe pane proves its own number.
    const d = decl * DEG;
    globeSun.position.set(
      0, Math.sin(d) * R_EARTH_KM * 4, Math.cos(d) * R_EARTH_KM * 4);
    globeSunTarget.position.set(0, 0, 0);
  },

  readout(state) {
    const decl = solarDeclinationDeg(state.dayOfYear);
    const rAB = globeRadiusFromPairKm(state.latA, state.latB, decl);
    const rBC = globeRadiusFromPairKm(state.latB, state.latC, decl);
    const globeSpread = 100 * Math.abs(rAB - rBC) / Math.max(rAB, rBC);
    const hAB = flatSunAltitudeFromPairKm(state.latA, state.latB, decl);
    const hBC = flatSunAltitudeFromPairKm(state.latB, state.latC, decl);
    const spread = 100 * Math.abs(hAB - hBC) / Math.max(hAB, hBC);

    return {
      flat: [
        { label: 'Sun altitude from A·B', value: `${hAB.toFixed(0)} km` },
        { label: 'Sun altitude from B·C', value: `${hBC.toFixed(0)} km` },
        { label: 'Disagreement', value: `${spread.toFixed(0)}%` },
      ],
      globe: [
        { label: 'Earth radius from A·B', value: `${rAB.toFixed(0)} km` },
        { label: 'Earth radius from B·C', value: `${rBC.toFixed(0)} km` },
        { label: 'Disagreement', value: `${globeSpread.toFixed(0)}%` },
      ],
      observed:
        'Every pair of observers yields the same Earth radius, 6371 km. The flat ' +
        'model must infer a different sun altitude from each pair, so it ' +
        'contradicts itself before it ever contradicts the globe.',
    };
  },

  dispose() {
    flatRig?.dispose(); globeRig?.dispose();
    // disposeTree frees globeSun's 2048x2048 shadow map along with the
    // geometry: it disposes every light it walks. Without that, each build of
    // this module orphaned another 16 MB depth target on the GPU, once per
    // phenomenon switch, for the life of the page.
    if (flatRoot) disposeTree(flatRoot);
    if (globeRoot) disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatGnomons = globeGnomons = null;
    globeSun = globeSunTarget = flatFill = flatFillTarget = null;
  },
};
