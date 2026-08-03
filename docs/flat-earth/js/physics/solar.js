import {
  R_EARTH_KM, AU_KM, SUN_DIAMETER_KM, EARTH_ORBIT_ECCENTRICITY,
  OBLIQUITY_DEG, FLAT_SUN_ALTITUDE_KM, FLAT_SPOTLIGHT_RADIUS_KM, DEG, RAD,
} from './constants.js';
import { azimuthalEquidistantRadiusKm } from './geodesy.js';

const DAYS = 365.25;

/** Solar declination. Simple obliquity model; accurate to a few tenths of a degree. */
export function solarDeclinationDeg(dayOfYear) {
  return -OBLIQUITY_DEG * Math.cos(2 * Math.PI * (dayOfYear + 10) / DAYS);
}

export function subsolarPoint(dayOfYear, utcHours) {
  return { lat: solarDeclinationDeg(dayOfYear), lon: -15 * (utcHours - 12) };
}

/** Hours between sunrise and sunset on a globe. Geometric, no refraction. */
export function dayLengthHours(latDeg, dayOfYear) {
  const cosH = -Math.tan(latDeg * DEG) * Math.tan(solarDeclinationDeg(dayOfYear) * DEG);
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return 24 * Math.acos(cosH) / Math.PI;
}

/**
 * Hours the flat model's spotlight covers an observer as it circles the disc.
 * Note this reproduces the Arctic midnight sun correctly — the model's genuine
 * failure is the Antarctic one, and the Arctic winter, not the Arctic summer.
 */
export function flatDayLengthHours(latDeg, dayOfYear) {
  const ro = azimuthalEquidistantRadiusKm(latDeg);
  const rs = azimuthalEquidistantRadiusKm(solarDeclinationDeg(dayOfYear));
  const cosDl = (ro * ro + rs * rs - FLAT_SPOTLIGHT_RADIUS_KM ** 2) / (2 * ro * rs);
  if (cosDl <= -1) return 24;
  if (cosDl >= 1) return 0;
  return 24 * Math.acos(cosDl) / Math.PI;
}

export function earthSunDistanceKm(dayOfYear) {
  return AU_KM * (1 - EARTH_ORBIT_ECCENTRICITY
    * Math.cos(2 * Math.PI * (dayOfYear - 4) / DAYS));
}

export function solarAngularDiameterDeg(dayOfYear) {
  return 2 * Math.atan(SUN_DIAMETER_KM / 2 / earthSunDistanceKm(dayOfYear)) * RAD;
}

/**
 * The flat sun's diameter is SOLVED, not asserted: it is whatever makes the sun
 * subtend the observed mean angular size when directly overhead. Hard-coding the
 * commonly quoted 51 km would make it visibly the wrong size even at noon, which
 * reads as a rigged premise.
 */
export function flatSunDiameterKm(altitudeKm = FLAT_SUN_ALTITUDE_KM) {
  const target = 2 * Math.atan(SUN_DIAMETER_KM / 2 / AU_KM);
  return 2 * altitudeKm * Math.tan(target / 2);
}

export function flatSunAngularDiameterDeg(groundDistanceKm,
                                          altitudeKm = FLAT_SUN_ALTITUDE_KM) {
  const slant = Math.hypot(altitudeKm, groundDistanceKm);
  return 2 * Math.atan(flatSunDiameterKm(altitudeKm) / 2 / slant) * RAD;
}

/**
 * Earth radius inferred from two noon shadow angles. Same answer for every pair.
 *
 * DOMAIN: both observers must lie on the SAME side of the subsolar latitude.
 * That is the classical Eratosthenes setup, and within it the two shadow angles
 * subtract cleanly and the result is exactly R for any pair — which is the
 * whole point. If the subsolar latitude falls BETWEEN the observers the angles
 * no longer subtract: the result diverges wildly, and at the symmetric case
 * (both equidistant from the subsolar latitude) the denominator is zero and the
 * result is Infinity. Callers must keep every observer on one side; the
 * Eratosthenes module does this by starting its lowest latitude above the
 * maximum declination.
 */
export function globeRadiusFromPairKm(latA, latB, declinationDeg) {
  const arcKm = R_EARTH_KM * Math.abs(latA - latB) * DEG;
  const dTheta = Math.abs(Math.abs(latA - declinationDeg)
    - Math.abs(latB - declinationDeg)) * DEG;
  return arcKm / dTheta;
}

/**
 * Sun altitude inferred from the same two shadow angles under the flat model,
 * using the pair to eliminate the unknown subsolar position. Different pairs
 * give different answers — the model contradicts itself.
 */
export function flatSunAltitudeFromPairKm(latA, latB, declinationDeg) {
  const dx = azimuthalEquidistantRadiusKm(latA) - azimuthalEquidistantRadiusKm(latB);
  const dTan = Math.tan(Math.abs(latA - declinationDeg) * DEG)
    - Math.tan(Math.abs(latB - declinationDeg) * DEG);
  return Math.abs(dx / dTan);
}

export function isDaylitGlobe(point, dayOfYear, utcHours) {
  const s = subsolarPoint(dayOfYear, utcHours);
  const cosZenith = Math.sin(point.lat * DEG) * Math.sin(s.lat * DEG)
    + Math.cos(point.lat * DEG) * Math.cos(s.lat * DEG)
    * Math.cos((point.lon - s.lon) * DEG);
  return cosZenith > 0;
}

export function isDaylitFlat(point, dayOfYear, utcHours) {
  const s = subsolarPoint(dayOfYear, utcHours);
  const ro = azimuthalEquidistantRadiusKm(point.lat);
  const rs = azimuthalEquidistantRadiusKm(s.lat);
  const dLon = (point.lon - s.lon) * DEG;
  const d = Math.sqrt(ro * ro + rs * rs - 2 * ro * rs * Math.cos(dLon));
  return d <= FLAT_SPOTLIGHT_RADIUS_KM;
}
