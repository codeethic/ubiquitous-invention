import { R_EARTH_KM, DEG } from './constants.js';

/** A sphere's shadow cross-section: a circle, whatever the orientation. */
export function sphereShadowAxesKm() {
  return { a: R_EARTH_KM, b: R_EARTH_KM };
}

/**
 * A disc's shadow cross-section: an ellipse whose minor axis collapses with
 * cos(orientation). Circular only when the disc faces the sun square-on.
 */
export function discShadowAxesKm(orientationDeg) {
  return { a: R_EARTH_KM, b: R_EARTH_KM * Math.abs(Math.cos(orientationDeg * DEG)) };
}

/** Curvature at the end of the major axis of an ellipse: a / b². */
export function shadowEdgeCurvaturePerKm({ a, b }) {
  if (b === 0) return Infinity;
  return a / (b * b);
}
