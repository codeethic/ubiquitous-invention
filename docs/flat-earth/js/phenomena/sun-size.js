import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SUN_ALTITUDE_KM, DEG,
} from '../physics/constants.js';
import {
  solarAngularDiameterDeg, flatSunAngularDiameterDeg, flatSunDiameterKm,
  solarDeclinationDeg, earthSunDistanceKm,
} from '../physics/solar.js';
import { azimuthalEquidistantRadiusKm } from '../physics/geodesy.js';
import { makeOcean, makeGlobeCap, makeSun, disposeTree } from '../lib/primitives.js';

const EYE_KM = 0.002;          // 2 m observer eye height
const VIEW_FOV_DEG = 10;       // narrow, so a 0.53° disc is a readable fraction
const GLOBE_SUN_RENDER_KM = 2e6;

/**
 * Ground distance from the observer to the subsolar point.
 *
 * The observer stands at the subsolar LATITUDE, so at local noon the sun is
 * directly overhead. As the hour angle turns, the subsolar point travels a
 * circle of radius `r` on the azimuthal-equidistant map and the ground
 * separation is the chord across that turn: 2·r·sin(Δhour·π/24).
 *
 * This replaces an earlier linear ramp that was invented rather than derived.
 * The two disagree badly — at 18:00 the ramp implied 71% of noon size where the
 * real geometry gives 33% — and it ignored dayOfYear entirely despite the
 * control existing. A fabricated relationship displayed beside real physics is
 * exactly the credibility failure this project cannot afford.
 */
function groundDistanceKm(hour, dayOfYear) {
  const r = azimuthalEquidistantRadiusKm(solarDeclinationDeg(dayOfYear));
  return 2 * r * Math.sin(Math.abs(hour - 12) * Math.PI / 24);
}

let flatRoot, globeRoot, flatCam, globeCam, flatSun, globeSun;

export default {
  id: 'sun-size',
  title: 'Apparent Size of the Sun',
  claim: 'The sun is small and nearby, about 5000 km above the disc.',

  controls: [
    { id: 'hour', label: 'Local hour', min: 0, max: 24, step: 0.25, unit: 'h' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { hour: 12, dayOfYear: 81 },

  // FIXED-CAMERA, like horizon. Both panes stand at the observer's eye looking
  // toward the sun, and the sun is drawn at its true diameter, so the rendered
  // angular size IS the number in the readout. An orbiting third-person view
  // cannot show apparent size at all — the mesh is a fixed size and only its
  // position changes — which would leave a module named "Apparent Size of the
  // Sun" unable to demonstrate its own claim.
  linkCameras: false,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeOcean(FLAT_DISC_RADIUS_KM * 2));
    flatSun = makeSun(flatSunDiameterKm());          // TRUE derived diameter
    flatRoot.add(flatSun);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeCap(R_EARTH_KM, 200));    // local ground reference
    globeSun = makeSun(1);                           // rescaled per frame
    globeRoot.add(globeSun);

    flatCam = new THREE.PerspectiveCamera(VIEW_FOV_DEG, 1, 0.001, 1e6);
    globeCam = new THREE.PerspectiveCamera(VIEW_FOV_DEG, 1, 0.001, 1e7);

    return {
      flat: { root: flatRoot, camera: flatCam, rig: null },
      globe: { root: globeRoot, camera: globeCam, rig: null },
    };
  },

  update(state) {
    // Flat pane: observer at the origin, sun at its true altitude and ground
    // distance along +Z. Camera at eye height looking straight at it.
    const ground = groundDistanceKm(state.hour, state.dayOfYear);
    flatSun.position.set(0, FLAT_SUN_ALTITUDE_KM, ground);
    flatCam.position.set(0, EYE_KM, 0);
    flatCam.lookAt(flatSun.position);

    // Globe pane: observer on the surface at the subsolar latitude, so the sun
    // is overhead at noon exactly as on the flat pane.
    const d = solarDeclinationDeg(state.dayOfYear) * DEG;
    const theta = (state.hour - 12) / 24 * Math.PI * 2;
    const sunDir = new THREE.Vector3(
      Math.cos(d) * Math.sin(theta), Math.sin(d), Math.cos(d) * Math.cos(theta));
    globeSun.position.copy(sunDir).multiplyScalar(GLOBE_SUN_RENDER_KM);

    // Drawn at a reduced distance with a diameter chosen to preserve the TRUE
    // angular size — placing it at a real 1 AU would wreck depth precision
    // while changing nothing a viewer can see.
    const angDeg = solarAngularDiameterDeg(state.dayOfYear);
    const renderDiameter =
      2 * GLOBE_SUN_RENDER_KM * Math.tan(angDeg / 2 * DEG);
    globeSun.scale.setScalar(renderDiameter);

    const obs = new THREE.Vector3(0, Math.sin(d), Math.cos(d))
      .multiplyScalar(R_EARTH_KM + EYE_KM);
    globeCam.position.copy(obs);
    globeCam.lookAt(globeSun.position);
  },

  readout(state) {
    const ground = groundDistanceKm(state.hour, state.dayOfYear);
    const globeDeg = solarAngularDiameterDeg(state.dayOfYear);
    const flatDeg = flatSunAngularDiameterDeg(ground);
    const flatNoon = flatSunAngularDiameterDeg(0);

    return {
      flat: [
        { label: 'Angular diameter', value: `${flatDeg.toFixed(3)}°` },
        { label: 'Relative to noon', value: `${(100 * flatDeg / flatNoon).toFixed(0)}%` },
        { label: 'Sun diameter (derived)', value: `${flatSunDiameterKm().toFixed(1)} km` },
        { label: 'Distance to sun', value: `${Math.hypot(FLAT_SUN_ALTITUDE_KM, ground).toFixed(0)} km` },
      ],
      globe: [
        { label: 'Angular diameter', value: `${globeDeg.toFixed(3)}°` },
        // Exactly 100% by construction, not a placeholder: the Earth–Sun
        // distance does not measurably change within a single day, so the globe
        // model's apparent size is the same at every hour of that day.
        { label: 'Relative to noon', value: '100%' },
        { label: 'Sun diameter', value: '1 391 400 km' },
        { label: 'Distance to sun', value: `${(earthSunDistanceKm(state.dayOfYear) / 1e6).toFixed(1)} million km` },
      ],
      observed:
        'The sun measures 0.52°–0.54° all day, every day. The flat model\'s sun is '
        + 'sized here to match exactly at noon — its best case — and still falls to '
        + 'roughly a third of that by 18:00, and never actually sets.',
    };
  },

  dispose() {
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatCam = globeCam = flatSun = globeSun = null;
  },
};
