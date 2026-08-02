import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SUN_ALTITUDE_KM,
} from '../physics/constants.js';
import {
  solarAngularDiameterDeg, flatSunAngularDiameterDeg, flatSunDiameterKm,
  solarDeclinationDeg,
} from '../physics/solar.js';
import { makeDisc, makeGlobeOcean, makeSun, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

// Ground distance from the observer to the subsolar point, as a function of
// hour angle. At hour 12 the sun is overhead; at 0 and 24 it is farthest.
const groundDistanceKm = hour =>
  Math.abs(hour - 12) / 12 * FLAT_DISC_RADIUS_KM * 0.5;

let flatRoot, globeRoot, flatRig, globeRig, flatSun, globeSun;

export default {
  id: 'sun-size',
  title: 'Apparent Size of the Sun',
  claim: 'The sun is small and nearby, about 5000 km above the disc.',

  controls: [
    { id: 'hour', label: 'Local hour', min: 0, max: 24, step: 0.25, unit: 'h' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { hour: 12, dayOfYear: 81 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    flatSun = makeSun(flatSunDiameterKm() * 40);   // drawn 40x for visibility
    flatRoot.add(flatSun);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    globeSun = makeSun(R_EARTH_KM * 0.8);
    globeRoot.add(globeSun);

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.4, far: 1e7 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 5, far: 1e7 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const ground = groundDistanceKm(state.hour);
    flatSun.position.set(ground, FLAT_SUN_ALTITUDE_KM, 0);

    const decl = solarDeclinationDeg(state.dayOfYear);
    const angle = (state.hour / 24) * Math.PI * 2;
    const far = R_EARTH_KM * 20;
    globeSun.position.set(far * Math.sin(angle), far * Math.sin(decl * Math.PI / 180),
      far * Math.cos(angle));
  },

  readout(state) {
    const ground = groundDistanceKm(state.hour);
    const globeDeg = solarAngularDiameterDeg(state.dayOfYear);
    const flatDeg = flatSunAngularDiameterDeg(ground);
    const flatNoon = flatSunAngularDiameterDeg(0);

    return {
      flat: [
        { label: 'Angular diameter', value: `${flatDeg.toFixed(3)}°` },
        { label: 'Relative to noon', value: `${(100 * flatDeg / flatNoon).toFixed(0)}%` },
        { label: 'Sun diameter (derived)', value: `${flatSunDiameterKm().toFixed(1)} km` },
      ],
      globe: [
        { label: 'Angular diameter', value: `${globeDeg.toFixed(3)}°` },
        { label: 'Relative to noon', value: '100%' },
        { label: 'Distance', value: '≈150 million km' },
      ],
      observed:
        'The sun measures 0.52°–0.54° all day, every day. The flat model\'s sun is '
        + 'sized here to match exactly at noon — its best case — and still has to '
        + 'shrink by more than half by evening, and never actually set.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatSun = globeSun = null;
  },
};
