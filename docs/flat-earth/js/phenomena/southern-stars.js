import * as THREE from 'three';
import { DEG } from '../physics/constants.js';
import {
  celestialPoleAltitudeDeg, skyRotationGlobe, skyRotationFlat, poleStarName,
} from '../physics/sky.js';
import { makeStarSphere } from '../lib/starfield.js';
import { disposeTree } from '../lib/primitives.js';
import { createOrbitRig } from '../lib/camera-rig.js';

let flatRoot, globeRoot, flatRig, globeRig, flatStars, globeStars;
let spin = 0;

export default {
  id: 'southern-stars',
  title: 'Rotation of the Night Sky',
  claim: 'One dome of stars turns above the disc, the same way for everyone.',

  controls: [
    { id: 'latDeg', label: 'Observer latitude', min: -80, max: 80, step: 1, unit: '°' },
  ],
  defaults: { latDeg: -35 },

  // Each pane is an observer-local sky whose orientation is the thing being
  // compared, so linking the cameras would hide the very difference on show.
  linkCameras: false,

  build() {
    flatRoot = new THREE.Group();
    flatStars = makeStarSphere();
    flatRoot.add(flatStars);

    globeRoot = new THREE.Group();
    globeStars = makeStarSphere();
    globeRoot.add(globeStars);

    flatRig = createOrbitRig({ distance: 1, far: 4000, fov: 70 });
    globeRig = createOrbitRig({ distance: 1, far: 4000, fov: 70 });

    return {
      flat: { root: flatRoot, camera: flatRig.camera, rig: flatRig },
      globe: { root: globeRoot, camera: globeRig.camera, rig: globeRig },
    };
  },

  update(state, dt) {
    spin += dt * 0.25;
    const tilt = (90 - Math.abs(state.latDeg)) * DEG;

    // Flat: one dome on one pivot, turning the same way for every observer.
    //
    // The tilt uses |latDeg|, NOT the signed value. With the signed value the
    // flat tilt becomes (180° − globeTilt) for southern latitudes, and the
    // resulting angular-velocity vector is *exactly equal* to the globe's
    // southern one — verified: at −35° both are (−0.819, −0.574, 0). The two
    // panes would then spin identically while the readout claimed they differ,
    // which is the module's entire argument.
    //
    // Note the panes SHOULD look identical for northern latitudes: there the
    // readout says both are CCW, because the flat model genuinely does agree in
    // the north. Only the southern half must diverge.
    flatStars.rotation.set(0, 0, 0);
    flatStars.rotateZ((90 - Math.abs(state.latDeg)) * DEG);
    flatStars.rotateY(spin);

    // Globe: the pole the observer sees flips with hemisphere, and so does the
    // apparent rotation direction.
    const south = state.latDeg < 0;
    globeStars.rotation.set(0, 0, 0);
    globeStars.rotateZ(south ? -tilt : tilt);
    globeStars.rotateY(south ? -spin : spin);
  },

  readout(state) {
    const alt = celestialPoleAltitudeDeg(state.latDeg);
    const rotation = skyRotationGlobe(state.latDeg);
    return {
      flat: [
        { label: 'Rotation direction', value: skyRotationFlat(state.latDeg) },
        { label: 'Pivot', value: 'Disc centre (Polaris)' },
        { label: 'Southern circumpolar stars', value: 'not possible' },
      ],
      globe: [
        { label: 'Rotation direction', value: rotation },
        // At the equator BOTH poles sit on the horizon and neither dominates,
        // so naming one star beside a rotation of "NONE" would read as
        // self-contradictory. poleStarName() breaks the tie toward Polaris for
        // latDeg >= 0; the readout must not present that tie-break as fact.
        { label: 'Pole star',
          value: rotation === 'NONE'
            ? 'both poles on the horizon'
            : poleStarName(state.latDeg) },
        { label: 'Pole altitude', value: `${alt.toFixed(0)}°` },
      ],
      observed:
        'Southern observers see the sky turn clockwise about Sigma Octantis, '
        + 'opposite to the north. A single dome pivoting on one point cannot turn '
        + 'both ways at once, whatever its size.',
    };
  },

  dispose() {
    flatRig.dispose(); globeRig.dispose();
    disposeTree(flatRoot); disposeTree(globeRoot);
    flatRoot = globeRoot = flatRig = globeRig = flatStars = globeStars = null;
    spin = 0;
  },
};
