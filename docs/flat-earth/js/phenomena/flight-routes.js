import * as THREE from 'three';
import { R_EARTH_KM, FLAT_DISC_RADIUS_KM, DEG } from '../physics/constants.js';
import {
  greatCircleKm, azimuthalEquidistantKm, azimuthalEquidistantXY, flightHours,
} from '../physics/geodesy.js';
import { makeDisc, makeGlobeOcean, disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

const ROUTES = [
  { id: 'syd-scl', from: 'syd', to: 'scl', scheduledHours: 12.6 },
  { id: 'jnb-per', from: 'jnb', to: 'per', scheduledHours: 9.5 },
  { id: 'scl-per', from: 'scl', to: 'per', scheduledHours: 14.5 },
];

let cities = null;
let flatRoot, globeRoot, flatRig, globeRig, flatLine, globeLine;
let lastRouteId = null;

// The rig's opening view direction (polar = PI/2.4, azimuth = 0), used to face
// the selected route toward the camera on load.
const DEFAULT_VIEW = new THREE.Vector3(
  0, Math.cos(Math.PI / 2.4), Math.sin(Math.PI / 2.4)).normalize();
const MID = new THREE.Vector3();

const byId = id => {
  const c = cities?.find(x => x.id === id);
  if (!c) throw new Error(`Unknown city id "${id}"`);
  return c;
};

const route = id => ROUTES.find(r => r.id === id) ?? ROUTES[0];

function latLonToVec3(p, radius) {
  const phi = p.lat * DEG, lam = p.lon * DEG;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(lam),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lam));
}

function makeLine(points, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  // Not from MATERIALS, so this module owns it and disposeTree must free it.
  line.userData.ownsMaterial = true;
  return line;
}

export default {
  id: 'flight-routes',
  title: 'Southern Hemisphere Flight Routes',
  claim: 'Long southern flights are consistent with the standard flat map.',

  controls: [{
    id: 'routeId', label: 'Route', options: ROUTES.map(r => ({
      value: r.id, label: r.id.toUpperCase().replace('-', ' → '),
    })),
  }],
  defaults: { routeId: 'syd-scl' },

  // A disc map and a globe are not at the same scale; linking would be nonsense.
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
    globeRoot = new THREE.Group();
    globeRoot.add(makeGlobeOcean(R_EARTH_KM));

    flatRig = createOrbitRig({ distance: FLAT_DISC_RADIUS_KM * 1.7, far: 1e6, polar: 0.4 });
    globeRig = createOrbitRig({ distance: R_EARTH_KM * 3.5, far: 1e6 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state) {
    // Rebuild only when the route actually changes. update() runs every frame,
    // and the rest of this codebase keeps its hot path allocation-free; without
    // this guard both lines — including a fresh 65-point BufferGeometry — would
    // be disposed and re-created 60 times a second for no reason.
    if (state.routeId === lastRouteId) return;
    lastRouteId = state.routeId;

    const r = route(state.routeId);
    const a = byId(r.from), b = byId(r.to);

    if (flatLine) { flatRoot.remove(flatLine); flatLine.geometry.dispose(); flatLine.material.dispose(); }
    if (globeLine) { globeRoot.remove(globeLine); globeLine.geometry.dispose(); globeLine.material.dispose(); }

    // Flat: a straight line across the disc, which is what the map implies.
    const pa = azimuthalEquidistantXY(a), pb = azimuthalEquidistantXY(b);
    flatLine = makeLine([
      new THREE.Vector3(pa.x, 50, pa.y),
      new THREE.Vector3(pb.x, 50, pb.y),
    ], 0xe0a33e);
    flatRoot.add(flatLine);

    // Globe: the great circle, sampled.
    const va = latLonToVec3(a, R_EARTH_KM), vb = latLonToVec3(b, R_EARTH_KM);
    const pts = [];
    for (let i = 0; i <= 64; i += 1) {
      pts.push(new THREE.Vector3().copy(va).lerp(vb, i / 64)
        .normalize().multiplyScalar(R_EARTH_KM * 1.005));
    }
    globeLine = makeLine(pts, 0xe0a33e);
    globeRoot.add(globeLine);

    // Turn the globe so the route faces the opening camera. Without this the
    // arc renders mostly BEHIND the opaque sphere: at the rig's default
    // orientation Sydney is 147.9° off-axis and Perth 119.7°, so a viewer sees
    // a stub near one endpoint until they think to drag. Rotating the root
    // (not the rig) leaves the user free to orbit afterwards. Measured after
    // the fix, both endpoints land 37–57° from centre on every route — the
    // whole arc is on the visible hemisphere.
    MID.copy(va).add(vb).normalize();
    globeRoot.quaternion.setFromUnitVectors(MID, DEFAULT_VIEW);
  },

  readout(state) {
    // Correction 1: Guard against missing city data
    if (!cities) {
      const pending = [{ label: 'Route data', value: 'unavailable' }];
      return {
        flat: pending,
        globe: pending,
        observed: 'City data could not be loaded, so no route can be measured.',
      };
    }

    const r = route(state.routeId);
    const a = byId(r.from), b = byId(r.to);
    const gc = greatCircleKm(a, b);
    const ae = azimuthalEquidistantKm(a, b);

    return {
      flat: [
        { label: 'Distance', value: `${ae.toFixed(0)} km` },
        { label: 'Implied flight time', value: `${flightHours(ae).toFixed(1)} h` },
        { label: 'Assumed cruise speed', value: '900 km/h' },
        { label: 'Versus schedule', value: `${(flightHours(ae) / r.scheduledHours).toFixed(1)}×` },
      ],
      globe: [
        { label: 'Distance', value: `${gc.toFixed(0)} km` },
        { label: 'Implied flight time', value: `${flightHours(gc).toFixed(1)} h` },
        { label: 'Assumed cruise speed', value: '900 km/h' },
        { label: 'Versus schedule', value: `${(flightHours(gc) / r.scheduledHours).toFixed(1)}×` },
      ],
      observed:
        `${a.name} to ${b.name} is scheduled at about ${r.scheduledHours} hours and `
        + 'flies non-stop. Times assume a 900 km/h cruise. The flat map demands an '
        + 'aircraft roughly twice as fast as anything in service.',
    };
  },

  dispose() {
    flatRig?.dispose(); globeRig?.dispose();
    if (flatRoot) disposeTree(flatRoot);
    if (globeRoot) disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatLine = globeLine = null;
    lastRouteId = null;
  },
};
