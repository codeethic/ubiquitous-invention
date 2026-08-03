import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SUN_ALTITUDE_KM, DEG,
} from '../physics/constants.js';
import {
  solarDeclinationDeg, dayLengthHours, flatDayLengthHours,
} from '../physics/solar.js';
import { azimuthalEquidistantRadiusKm } from '../physics/geodesy.js';
import {
  makeDisc, makeGlobeOcean, makeSun, makeObserverMarker, disposeTree,
} from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const SUN_DRAW_KM = 800;   // drawn oversized so it is visible at world scale

let flatRoot, globeRoot, flatRig, globeRig, flatSun, globeSun, flatObs, globeObs;
let clock = 0;

export default {
  id: 'midnight-sun',
  title: 'Midnight Sun',
  claim: 'A sun circling above the disc explains 24-hour daylight at the poles.',

  controls: [
    { id: 'latDeg', label: 'Observer latitude', min: -85, max: 85, step: 1, unit: '°' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  // Opens on the Antarctic summer — the case the flat model cannot produce.
  defaults: { latDeg: -70, dayOfYear: 355 },

  // Linked: the rigs sit at different distances, but orbit() propagates angle
  // deltas rather than absolute positions, so linking works across scales.
  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    flatSun = makeSun(SUN_DRAW_KM);
    flatObs = makeObserverMarker(R_EARTH_KM * 0.04);
    flatRoot.add(flatSun, flatObs);
    // Aim the sun's light at the world origin. Three.js aims a DirectionalLight
    // at a default target that is never added to any scene, so without this the
    // sun glows but illuminates nothing.
    flatSun.userData.light.target = flatRoot;

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    globeSun = makeSun(SUN_DRAW_KM * 4);
    globeObs = makeObserverMarker(R_EARTH_KM * 0.04);
    globeRoot.add(globeSun, globeObs);
    globeSun.userData.light.target = globeRoot;

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.8, far: 1e6, polar: 0.9 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 4, far: 1e6, polar: 1.2 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state, dt) {
    clock = (clock + dt * 0.15) % 1;              // one full day per ~6.7 s
    // Negated: the sun must move westward (time-zones' subsolarPoint moves
    // lon = -15(u-12), i.e. westward), and an unnegated hourAngle drove this
    // module's sun eastward instead, disagreeing with time-zones.
    const hourAngle = -(clock * Math.PI * 2);
    const decl = solarDeclinationDeg(state.dayOfYear);

    // Flat pane: sun circles above the disc at the subsolar AE radius.
    const rSun = azimuthalEquidistantRadiusKm(decl);
    flatSun.position.set(
      rSun * Math.sin(hourAngle), FLAT_SUN_ALTITUDE_KM, rSun * Math.cos(hourAngle));
    const rObs = azimuthalEquidistantRadiusKm(state.latDeg);
    flatObs.position.set(0, 0, rObs);

    // Globe pane: sun far away along the declination direction, observer on
    // the surface at the chosen latitude.
    const d = decl * DEG;
    const far = R_EARTH_KM * 12;
    globeSun.position.set(
      far * Math.cos(d) * Math.sin(hourAngle),
      far * Math.sin(d),
      far * Math.cos(d) * Math.cos(hourAngle));
    const phi = state.latDeg * DEG;
    globeObs.position.set(0, R_EARTH_KM * Math.sin(phi), R_EARTH_KM * Math.cos(phi));
    // Stand the marker on the local vertical. Without this its "up" stays world
    // +Y, correct only at the pole — at this module's own default of -70° the
    // post leans ~160° off and points into the globe. Same pattern as the
    // gnomons in eratosthenes.js.
    globeObs.lookAt(globeObs.position.clone().multiplyScalar(2));
    globeObs.rotateX(Math.PI / 2);
  },

  readout(state) {
    const globeHours = dayLengthHours(state.latDeg, state.dayOfYear);
    const flatHours = flatDayLengthHours(state.latDeg, state.dayOfYear);
    const agrees = Math.abs(globeHours - flatHours) < 0.5;

    return {
      flat: [
        { label: 'Daylight', value: `${flatHours.toFixed(1)} h` },
        { label: 'Matches observation', value: agrees ? 'yes' : 'no' },
      ],
      globe: [
        { label: 'Daylight', value: `${globeHours.toFixed(1)} h` },
        { label: 'Matches observation', value: 'yes' },
      ],
      observed: agrees
        ? 'At this latitude and date the flat model happens to agree. Its spotlight '
          + 'covers the whole northern region, so it reproduces the Arctic midnight '
          + 'sun. Set the latitude to -70° in December to see where it fails.'
        : flatHours < globeHours
          ? `Observed daylight here is ${globeHours.toFixed(1)} h. The flat model `
            + `predicts only ${flatHours.toFixed(1)} h: its sun circles above the disc `
            + 'and must move away from this latitude and set. No circling sun can keep '
            + 'the southern rim lit for a full day.'
          : `Observed daylight here is ${globeHours.toFixed(1)} h. The flat model `
            + `predicts ${flatHours.toFixed(1)} h — too much. Its spotlight still covers `
            + 'this latitude when the real sky is dark. A disc cannot tilt away from the '
            + 'sun, so it has no way to produce a polar night.',
    };
  },

  dispose() {
    flatRig?.dispose(); globeRig?.dispose();
    if (flatRoot) disposeTree(flatRoot);
    if (globeRoot) disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = null;
    flatSun = globeSun = flatObs = globeObs = null;
    clock = 0;
  },
};
