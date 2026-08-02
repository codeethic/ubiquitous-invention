import * as THREE from 'three';
import { R_EARTH_KM, DEG } from '../physics/constants.js';
import {
  sphereShadowAxesKm, discShadowAxesKm, shadowEdgeCurvaturePerKm,
} from '../physics/eclipse.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { MATERIALS } from '../lib/materials.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const MOON_RADIUS_KM = 1737;

let flatRoot, globeRoot, flatRig, globeRig;
let flatMoon, globeMoon, flatShadow, globeShadow, flatEarth;

function makeMoon() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS_KM, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 1 }));
}

/** Flat ellipse standing in front of the moon, representing the cast shadow. */
function makeShadowEllipse() {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(MOON_RADIUS_KM * 1.4, 96),
    MATERIALS.shadow);
  mesh.position.z = MOON_RADIUS_KM * 1.05;
  return mesh;
}

export default {
  id: 'lunar-eclipse',
  title: 'Shape of the Eclipse Shadow',
  claim: 'The shadow on the moon is cast by the flat disc of the Earth.',

  controls: [
    { id: 'orientationDeg', label: 'Disc orientation', min: 0, max: 85, step: 1, unit: '°' },
    { id: 'progress', label: 'Eclipse progress', min: -1.4, max: 1.4, step: 0.05, unit: '' },
  ],
  defaults: { orientationDeg: 55, progress: 0 },

  linkCameras: true,

  build() {
    flatRoot = new THREE.Group();
    flatEarth = makeDisc(R_EARTH_KM);
    flatEarth.position.set(0, 0, -R_EARTH_KM * 4);
    flatMoon = makeMoon();
    flatShadow = makeShadowEllipse();
    flatMoon.add(flatShadow);
    flatRoot.add(flatEarth, flatMoon);

    globeRoot = new THREE.Group();
    const globeEarth = makeGlobeOcean(R_EARTH_KM);
    globeEarth.position.set(0, 0, -R_EARTH_KM * 4);
    globeMoon = makeMoon();
    globeShadow = makeShadowEllipse();
    globeMoon.add(globeShadow);
    globeRoot.add(globeEarth, globeMoon);

    flatRig = createOrbitRig({ distance: R_EARTH_KM * 9, far: 1e6 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 9, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    flatEarth.rotation.x = -Math.PI / 2 + state.orientationDeg * DEG;

    const disc = discShadowAxesKm(state.orientationDeg);
    const sphere = sphereShadowAxesKm();
    const norm = axes => ({ x: axes.a / R_EARTH_KM, y: axes.b / R_EARTH_KM });

    const f = norm(disc), g = norm(sphere);
    flatShadow.scale.set(f.x, Math.max(0.02, f.y), 1);
    globeShadow.scale.set(g.x, g.y, 1);

    const offset = state.progress * MOON_RADIUS_KM * 2;
    flatShadow.position.x = offset;
    globeShadow.position.x = offset;
  },

  readout(state) {
    const disc = discShadowAxesKm(state.orientationDeg);
    const sphere = sphereShadowAxesKm();
    const cDisc = shadowEdgeCurvaturePerKm(disc);
    const cSphere = shadowEdgeCurvaturePerKm(sphere);
    const cDiscFace = shadowEdgeCurvaturePerKm(discShadowAxesKm(0));

    return {
      flat: [
        { label: 'Shadow minor axis', value: `${disc.b.toFixed(0)} km` },
        { label: 'Edge curvature', value: `${cDisc.toExponential(2)} /km` },
        { label: 'Change vs face-on', value: `${(cDisc / cDiscFace).toFixed(1)}×` },
      ],
      globe: [
        { label: 'Shadow minor axis', value: `${sphere.b.toFixed(0)} km` },
        { label: 'Edge curvature', value: `${cSphere.toExponential(2)} /km` },
        { label: 'Change vs face-on', value: '1.0×' },
      ],
      observed:
        'Every lunar eclipse ever recorded shows the same circular shadow edge, '
        + 'from every location and at every angle. A disc produces a circle only '
        + 'when square-on to the sun, and an increasingly flattened ellipse otherwise.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = null;
    flatMoon = globeMoon = flatShadow = globeShadow = flatEarth = null;
  },
};
