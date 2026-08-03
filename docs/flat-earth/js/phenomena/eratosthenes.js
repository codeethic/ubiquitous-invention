import * as THREE from 'three';
import { R_EARTH_KM, FLAT_DISC_RADIUS_KM, DEG, ERATOSTHENES_MIN_LAT_DEG, FLAT_SUN_ALTITUDE_KM } from '../physics/constants.js';
import {
  solarDeclinationDeg, globeRadiusFromPairKm, flatSunAltitudeFromPairKm,
} from '../physics/solar.js';
import { azimuthalEquidistantRadiusKm } from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, makeGnomon, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';
import { makeParallelSun, makeLocalSun } from '../lib/world.js';

const STICK_KM = 300;   // exaggerated so the shadow is visible at world scale

let flatRoot, globeRoot, flatRig, globeRig, flatGnomons, globeGnomons;
let flatSun, globeSun, flatSunTarget, globeSunTarget;

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
      const f = makeGnomon(STICK_KM);
      const g = makeGnomon(STICK_KM);
      flatGnomons.push(f); globeGnomons.push(g);
      flatRoot.add(f); globeRoot.add(g);
    }

    // The flat model's sun is 5,000 km up, so its rays DIVERGE and strike each
    // observer at a different angle. The globe's sun is 1 AU away, so its rays
    // are parallel. That difference is the entire argument of this module, so
    // each pane gets the light type its model actually claims.
    // Span half the disc radius: gnomon sites sit at AE radii of roughly
    // 5,000-7,200 km and the subsolar point between ~4,500 and ~8,900 km, so
    // a +/-5,000 km frustum covers every reachable configuration at 4.9 km per
    // texel — a 60x margin against a 300 km shadow.
    flatSun = makeLocalSun(FLAT_SUN_ALTITUDE_KM, FLAT_DISC_RADIUS_KM / 2);
    flatSunTarget = new THREE.Object3D();
    flatSun.target = flatSunTarget;
    flatRoot.add(flatSun, flatSunTarget);

    globeSun = makeParallelSun(R_EARTH_KM * 0.5);
    globeSunTarget = new THREE.Object3D();
    globeSun.target = globeSunTarget;
    globeRoot.add(globeSun, globeSunTarget);

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
    });

    // Both suns are placed from `decl` — the same value readout() feeds to
    // globeRadiusFromPairKm and flatSunAltitudeFromPairKm. The shadows on
    // screen and the numbers in the panel therefore share one input, so the
    // picture can be checked against the readout instead of merely illustrating
    // it. shadowLength() is gone: nothing draws a shadow any more.
    const subsolarR = azimuthalEquidistantRadiusKm(decl);
    flatSun.position.set(0, FLAT_SUN_ALTITUDE_KM, subsolarR);
    flatSunTarget.position.set(0, 0, subsolarR);

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
    if (flatRoot) disposeTree(flatRoot);
    if (globeRoot) disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatGnomons = globeGnomons = null;
    flatSun = globeSun = flatSunTarget = globeSunTarget = null;
  },
};
