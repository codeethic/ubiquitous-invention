import { R_EARTH_KM, DEG } from './constants.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Distance to the visible horizon for an observer eyeHeightM above the surface. */
export function horizonDistanceKm(eyeHeightM) {
  const h = Math.max(0, eyeHeightM) / 1000;
  return Math.sqrt(2 * R_EARTH_KM * h);
}

/** Curvature drop of the surface over distanceKm. NOT what an observer sees hidden. */
export function geometricDropM(distanceKm) {
  const d = Math.max(0, distanceKm);
  return (d * d) / (2 * R_EARTH_KM) * 1000;
}

/**
 * Height of a distant object concealed below the observer's line of sight.
 * Zero inside the horizon. This is the quantity the UI reports, because it is
 * what is actually observed — geometricDropM is the commonly misquoted one.
 */
export function hiddenHeightM(distanceKm, eyeHeightM) {
  const beyond = distanceKm - horizonDistanceKm(eyeHeightM);
  if (beyond <= 0) return 0;
  return (beyond * beyond) / (2 * R_EARTH_KM) * 1000;
}

/**
 * Radial distance from the disc's centre (the north pole) on the standard
 * north-polar azimuthal equidistant map. Latitude -90 lands on the rim.
 */
export function azimuthalEquidistantRadiusKm(latDeg) {
  return R_EARTH_KM * (Math.PI / 2 - latDeg * DEG);
}
