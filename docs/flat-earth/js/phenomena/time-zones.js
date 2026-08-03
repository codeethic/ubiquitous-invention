import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SPOTLIGHT_RADIUS_KM, DEG,
} from '../physics/constants.js';
import { isDaylitGlobe, isDaylitFlat, subsolarPoint } from '../physics/solar.js';
import { azimuthalEquidistantXY } from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { MATERIALS } from '../lib/materials.js';
import { createOrbitRig } from '../lib/camera-rig.js';

let cities = null;
let flatRoot, globeRoot, flatRig, globeRig, spotlight, terminator, cityDots = [];

const localHour = (city, utcHours) => ((utcHours + city.utcOffset) % 24 + 24) % 24;

export default {
  id: 'time-zones',
  title: 'Day and Night Together',
  claim: 'A spotlight sun above the disc explains day and night around the world.',

  controls: [
    { id: 'utcHours', label: 'UTC hour', min: 0, max: 23.5, step: 0.5, unit: 'h' },
    { id: 'dayOfYear', label: 'Day of year', min: 1, max: 365, step: 1, unit: '' },
  ],
  defaults: { utcHours: 0, dayOfYear: 172 },

  linkCameras: false,

  async load() {
    const res = await fetch('./data/cities.json');
    if (!res.ok) throw new Error(`cities.json returned HTTP ${res.status}`);
    cities = await res.json();
  },

  build() {
    if (!cities) throw new Error('City data was not loaded');

    flatRoot = new THREE.Group();
    flatRoot.add(makeDisc(FLAT_DISC_RADIUS_KM));
    spotlight = new THREE.Mesh(
      new THREE.CircleGeometry(FLAT_SPOTLIGHT_RADIUS_KM, 96),
      new THREE.MeshBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.18 }));
    spotlight.rotation.x = -Math.PI / 2;
    spotlight.position.y = 20;
    flatRoot.add(spotlight);

    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));
    terminator = new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH_KM * 1.002, 64, 48, 0, Math.PI),
      MATERIALS.shadow);
    globeRoot.add(terminator);

    cityDots = cities.map(() => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(180, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      // Correction 2: Flag this material as owned by this module so disposeTree frees it
      dot.userData.ownsMaterial = true;
      flatRoot.add(dot);
      return dot;
    });

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.7, far: 1e6, polar: 0.35 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 3.5, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    const sub = subsolarPoint(state.dayOfYear, state.utcHours);
    const p = azimuthalEquidistantXY(sub);
    spotlight.position.set(p.x, 20, p.y);

    // The night hemisphere faces away from the subsolar point.
    terminator.rotation.set(0, -(sub.lon + 90) * DEG, 0);

    cities.forEach((c, i) => {
      const q = azimuthalEquidistantXY(c);
      cityDots[i].position.set(q.x, 60, q.y);
      const lit = isDaylitFlat(c, state.dayOfYear, state.utcHours);
      cityDots[i].material.color.set(lit ? 0xffd27f : 0x44506a);
    });
  },

  readout(state) {
    // Correction 1: Guard against null cities
    if (!cities) {
      const pending = [{ label: 'City data', value: 'unavailable' }];
      return {
        flat: pending,
        globe: pending,
        observed: 'City data could not be loaded, so no comparison can be made.',
      };
    }

    const mismatches = cities.filter(c =>
      isDaylitGlobe(c, state.dayOfYear, state.utcHours)
      !== isDaylitFlat(c, state.dayOfYear, state.utcHours));

    const litFlat = cities.filter(c => isDaylitFlat(c, state.dayOfYear, state.utcHours));
    const litGlobe = cities.filter(c => isDaylitGlobe(c, state.dayOfYear, state.utcHours));

    const sample = mismatches.slice(0, 3)
      .map(c => `${c.name} ${String(Math.floor(localHour(c, state.utcHours))).padStart(2, '0')}:00`)
      .join(', ');

    return {
      flat: [
        { label: 'Cities in daylight', value: `${litFlat.length} of ${cities.length}` },
        { label: 'Wrong for', value: `${mismatches.length} cities` },
        { label: 'Examples', value: sample || 'none' },
      ],
      globe: [
        { label: 'Cities in daylight', value: `${litGlobe.length} of ${cities.length}` },
        { label: 'Wrong for', value: '0 cities' },
        { label: 'Lit fraction', value: 'exactly half the surface' },
      ],
      observed:
        'Exactly half the Earth is lit at any instant, and the boundary is a great '
        + 'circle. The disc\'s spotlight is sized here to light half the map\'s area '
        + 'and still lights places that are demonstrably in the dark. '
        + 'Offsets are standard time; daylight saving is ignored.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    // Correction 2: Remove manual material disposal. disposeTree handles it via ownsMaterial flag.
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = spotlight = terminator = null;
    cityDots = [];
  },
};
