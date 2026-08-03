/**
 * Texture-space projections for the globe and the disc.
 *
 * The disc projection delegates to azimuthalEquidistantXY — the SAME function
 * flight-routes uses to compute its 25,684 km readout. The map drawn on the
 * disc and the number printed above it therefore come from one function and
 * cannot disagree. That is the whole reason this file imports geodesy rather
 * than reimplementing the projection.
 *
 * Imports only js/physics/, so it runs under `node --test`.
 */
import { FLAT_DISC_RADIUS_KM, RAD } from '../physics/constants.js';
import { azimuthalEquidistantXY } from '../physics/geodesy.js';

/** Equirectangular UV, as SphereGeometry's default UVs expect. v = 0 is north. */
export function equirectUV(lat, lon) {
  return { u: (lon + 180) / 360, v: (90 - lat) / 180 };
}

/**
 * Azimuthal-equidistant UV on the unit square: the north pole at (0.5, 0.5),
 * the south pole on a circle of radius 0.5. This is the classic flat-earth
 * map, with Antarctica smeared into a ring around the rim.
 *
 * v is flipped relative to the projection's +y because texture space runs
 * downward while the map's north-up y runs upward.
 */
export function discUV(lat, lon) {
  const { x, y } = azimuthalEquidistantXY({ lat, lon });
  const s = 2 * FLAT_DISC_RADIUS_KM;
  return { u: 0.5 + x / s, v: 0.5 - y / s };
}

/** Inverse of discUV. */
export function discToLatLon(u, v) {
  const s = 2 * FLAT_DISC_RADIUS_KM;
  const x = (u - 0.5) * s, y = (0.5 - v) * s;
  const r = Math.hypot(x, y);
  // azimuthalEquidistantRadiusKm(lat) = R * (PI/2 - lat*DEG), inverted here.
  const lat = (Math.PI / 2 - r / (FLAT_DISC_RADIUS_KM / Math.PI)) * RAD;
  return { lat, lon: Math.atan2(x, y) * RAD };
}

/**
 * Insert intermediate vertices so no edge spans more than maxStepDeg.
 *
 * Required before projecting a ring through discUV: the AE projection is
 * non-linear, so a long straight edge in lat/lon is a curve on the disc. Fill
 * the projected polygon without densifying and the rasteriser cuts the corner,
 * which shows up as continents with chunks sliced off near the rim — exactly
 * where Antarctica lives.
 */
export function densifyRing(ring, maxStepDeg) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxStepDeg));
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
}
