import * as THREE from 'three';
import {
  R_EARTH_KM, FLAT_DISC_RADIUS_KM, FLAT_SPOTLIGHT_RADIUS_KM, DEG,
} from '../physics/constants.js';
import { isDaylitGlobe, isDaylitFlat, subsolarPoint } from '../physics/solar.js';
import { azimuthalEquidistantXY } from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { MATERIALS } from '../lib/materials.js';
import { createOrbitRig } from '../lib/camera-rig.js';
import { fetchJson } from '../lib/fetch-json.js';

let cities = null;
let flatRoot, globeRoot, flatRig, globeRig, spotlight, terminator, cityDots = [], globeCityDots = [];

// The half-sphere's patch is centred on its local +Z; this vector rotates onto
// the antisolar direction to place night on the correct side of the globe.
const PATCH_AXIS = new THREE.Vector3(0, 0, 1);
const ANTISOLAR = new THREE.Vector3();

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

  /**
   * Bounded by fetchJson rather than a bare fetch. `activate()` awaits this
   * before build(), so a STALLED connection - a captive portal, or a proxy
   * that accepts and never answers - would never reject and would leave the
   * switch half-finished forever: an empty canvas under the controls of the
   * phenomenon the user just left. Failing loudly after 5 s is strictly
   * better, and the harness already knows what to do with a thrown Error
   * (a per-module card; every other phenomenon stays selectable).
   */
  async load() {
    cities = await fetchJson('./data/cities.json', { label: 'cities.json' });
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
    // Fix 4a: Flag the spotlight material so disposeTree frees it
    spotlight.userData.ownsMaterial = true;
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

    // Fix 3: Create city dots for the globe pane so both panes show cities
    globeCityDots = cities.map(() => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(120, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      dot.userData.ownsMaterial = true;
      globeRoot.add(dot);
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

    // Fix 1: Point the dark hemisphere at the antisolar direction.
    //
    // Do NOT hand-compose a Y-rotation. The half-sphere's patch is centred on
    // its own local +Z, and an earlier `rotation.set(0, -(sub.lon + 90)*DEG, 0)`
    // put that centre at (−cos L, 0, −sin L) when the antisolar direction is
    // (−sin L, 0, −cos L). Those agree only at UTC 9 and 21: the boundary was
    // 90° off at UTC 0, 6, 12 and 18, and fully inverted at UTC 3 — day and
    // night on the wrong sides, at the module's own default hour, while every
    // readout number stayed correct.
    //
    // A quaternion from the patch axis also carries solar declination, so the
    // boundary now tilts with the seasons instead of staying a fixed vertical
    // great circle through the poles.
    const dRad = sub.lat * DEG, lRad = sub.lon * DEG;
    ANTISOLAR.set(
      -Math.cos(dRad) * Math.sin(lRad),
      -Math.sin(dRad),
      -Math.cos(dRad) * Math.cos(lRad)).normalize();
    terminator.quaternion.setFromUnitVectors(PATCH_AXIS, ANTISOLAR);

    cities.forEach((c, i) => {
      const q = azimuthalEquidistantXY(c);
      cityDots[i].position.set(q.x, 60, q.y);
      const lit = isDaylitFlat(c, state.dayOfYear, state.utcHours);
      cityDots[i].material.color.set(lit ? 0xffd27f : 0x44506a);

      // Fix 3: Position and colour globe city dots using 3D cartesian coords
      const phi = c.lat * DEG, lam = c.lon * DEG;
      const rr = R_EARTH_KM * 1.01;
      globeCityDots[i].position.set(
        rr * Math.cos(phi) * Math.sin(lam),
        rr * Math.sin(phi),
        rr * Math.cos(phi) * Math.cos(lam));
      const litG = isDaylitGlobe(c, state.dayOfYear, state.utcHours);
      globeCityDots[i].material.color.set(litG ? 0xffd27f : 0x44506a);
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

    // Fix 4b: Format local time with minutes, not just hours
    const sample = mismatches.slice(0, 3)
      .map(c => {
        const h = localHour(c, state.utcHours);
        const hh = String(Math.floor(h)).padStart(2, '0');
        const mm = String(Math.round((h % 1) * 60)).padStart(2, '0');
        return `${c.name} ${hh}:${mm}`;
      })
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
        + 'circle. The disc\'s spotlight radius is chosen so a centred circle would '
        + 'cover half the disc; in operation it overhangs the rim and still lights '
        + 'places that are demonstrably in the dark. '
        + 'Offsets are standard time; daylight saving is ignored.',
    };
  },

  dispose() {
    flatRig?.dispose(); globeRig?.dispose();
    // Correction 2: Remove manual material disposal. disposeTree handles it via ownsMaterial flag.
    if (flatRoot) disposeTree(flatRoot);
    if (globeRoot) disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = spotlight = terminator = null;
    cityDots = [];
    globeCityDots = [];
  },
};
