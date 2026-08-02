import * as THREE from 'three';
import { R_EARTH_KM } from '../physics/constants.js';
import { hiddenHeightM, horizonDistanceKm, geometricDropM } from '../physics/geodesy.js';
import { makeOcean, makeGlobeCap, makeShip, disposeTree } from '../lib/primitives.js';

const SHIP_HEIGHT_KM = 0.04;   // 40 m mast-top — a schematic tall ship
const CAP_EXTENT_KM = 60;

let flatRoot, globeRoot, flatShip, globeShip, flatCam, globeCam;

export default {
  id: 'horizon',
  title: 'Ship Over the Horizon',
  claim: 'Ships shrink into the distance — they do not sink behind a curve.',

  controls: [
    { id: 'distanceKm', label: 'Distance', min: 0, max: 40, step: 0.5, unit: 'km' },
    { id: 'eyeHeightM', label: 'Eye height', min: 2, max: 30, step: 1, unit: 'm' },
  ],
  defaults: { distanceKm: 12, eyeHeightM: 2 },

  // Fixed-camera module: the readout asserts a hidden height for a specific
  // eye position, so orbiting away from that eye would desync the rendered
  // occlusion from the number on screen. See the camera-ownership rule in
  // the module contract (README.md).
  linkCameras: false,

  build() {
    flatRoot = new THREE.Group();
    flatRoot.add(makeOcean(200));
    flatShip = makeShip(SHIP_HEIGHT_KM);
    flatRoot.add(flatShip);

    globeRoot = new THREE.Group();
    // A CAP, not the whole globe: at whole-globe tessellation the entire 0–40 km
    // control range falls inside one flat facet, and the curvature this module
    // exists to show would not render at all.
    globeRoot.add(makeGlobeCap(R_EARTH_KM, CAP_EXTENT_KM));
    globeShip = makeShip(SHIP_HEIGHT_KM);
    globeRoot.add(globeShip);

    // Both cameras sit at the observer's eye, looking along +Z toward the ship.
    // Fixed cameras, not rigs: update() positions them directly every frame,
    // and no pointer routing or linking applies (rig: null below).
    flatCam = new THREE.PerspectiveCamera(12, 1, 0.001, 5000);
    globeCam = new THREE.PerspectiveCamera(12, 1, 0.001, 5000);

    return {
      flat: { root: flatRoot, camera: flatCam, rig: null },
      globe: { root: globeRoot, camera: globeCam, rig: null },
    };
  },

  update(state) {
    const d = state.distanceKm;
    const eyeKm = state.eyeHeightM / 1000;

    // Flat pane: ocean in the XZ plane, observer at the origin.
    flatShip.position.set(0, 0, d);
    flatCam.position.set(0, eyeKm, 0);
    flatCam.lookAt(0, eyeKm, d);

    // Globe pane: observer at the north pole of a globe-radius sphere; the ship
    // sits on the surface d km away along a great circle.
    const theta = d / R_EARTH_KM;
    globeShip.position.set(
      0, R_EARTH_KM * Math.cos(theta), R_EARTH_KM * Math.sin(theta));
    globeShip.rotation.x = theta;
    globeCam.position.set(0, R_EARTH_KM + eyeKm, 0);
    globeCam.lookAt(globeShip.position);
  },

  readout(state) {
    const hidden = hiddenHeightM(state.distanceKm, state.eyeHeightM);
    const horizon = horizonDistanceKm(state.eyeHeightM);
    const drop = geometricDropM(state.distanceKm);
    const shipM = SHIP_HEIGHT_KM * 1000;

    return {
      flat: [
        { label: 'Hidden height', value: '0.0 m' },
        { label: 'Visible fraction', value: '100%' },
        { label: 'Horizon distance', value: 'unbounded' },
      ],
      globe: [
        { label: 'Hidden height', value: `${hidden.toFixed(1)} m` },
        { label: 'Visible fraction',
          value: `${Math.max(0, 100 * (1 - hidden / shipM)).toFixed(0)}%` },
        { label: 'Horizon distance', value: `${horizon.toFixed(2)} km` },
        { label: 'Geometric drop (not what is seen)', value: `${drop.toFixed(1)} m` },
      ],
      observed:
        'The hull disappears before the mast, from the bottom up. Only a curved ' +
        'surface produces this; a shrinking object stays whole as it shrinks.',
    };
  },

  dispose() {
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatShip = globeShip = flatCam = globeCam = null;
  },
};
