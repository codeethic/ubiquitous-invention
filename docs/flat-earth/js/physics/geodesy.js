import { R_EARTH_KM, CRUISE_SPEED_KMH, DEG } from './constants.js';

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

/** Shortest surface distance between two points on a sphere. */
export function greatCircleKm(a, b) {
  const p1 = a.lat * DEG, p2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return R_EARTH_KM * Math.acos(clamp(c, -1, 1));
}

/** Position on the north-polar azimuthal equidistant map, in km from centre. */
export function azimuthalEquidistantXY(p) {
  const r = azimuthalEquidistantRadiusKm(p.lat);
  const t = p.lon * DEG;
  return { x: r * Math.sin(t), y: r * Math.cos(t) };
}

/** Straight-line distance across the flat disc map. */
export function azimuthalEquidistantKm(a, b) {
  const p = azimuthalEquidistantXY(a), q = azimuthalEquidistantXY(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

export function flightHours(distanceKm, speedKmh = CRUISE_SPEED_KMH) {
  return distanceKm / speedKmh;
}
