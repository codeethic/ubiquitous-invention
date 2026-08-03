/** Altitude of the visible celestial pole equals |latitude|. */
export const celestialPoleAltitudeDeg = latDeg => Math.abs(latDeg);

/**
 * On a globe the sky turns counter-clockwise about Polaris in the north and
 * clockwise about Sigma Octantis in the south. On the equator neither pole
 * dominates.
 */
export function skyRotationGlobe(latDeg) {
  if (latDeg > 0) return 'CCW';
  if (latDeg < 0) return 'CW';
  return 'NONE';
}

/**
 * The flat model has a single dome pivoting on the disc's centre, so every
 * observer everywhere sees the same rotation direction. This is the failure:
 * southern observers demonstrably see the opposite.
 */
export const skyRotationFlat = () => 'CCW';

export const poleStarName = latDeg => (latDeg >= 0 ? 'Polaris' : 'Sigma Octantis');
