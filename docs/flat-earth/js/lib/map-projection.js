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
 * Mesh rotation about +Y that reconciles TWO DIFFERENT LONGITUDE CONVENTIONS.
 * Applied by primitives.js `makeGlobeOcean`; asserted against the real
 * SphereGeometry in test/map-projection.test.js. Do not delete it as
 * mysterious — without it the globe's map is 90° out in longitude, which is
 * invisible to any "do the continents look right?" glance.
 *
 *  1. THIS APP'S convention, used by every phenomenon that places anything on
 *     the globe (`latLonToVec3` in flight-routes.js and the identical
 *     construction in time-zones.js, midnight-sun.js and eratosthenes.js):
 *         x = R·cos(lat)·sin(lon), y = R·sin(lat), z = R·cos(lat)·cos(lon)
 *     so lon 0 points at world +Z and lon +90 at world +X.
 *
 *  2. THREE.SphereGeometry's convention, which is what `equirectUV` has to
 *     feed. Its vertices are built as
 *         x = −R·cos(φ)·sin(θ), z = +R·sin(φ)·sin(θ),  φ = 2π·u
 *     so u = 0 (equirectUV's lon −180) lands on world −X, and u = 0.25 lands
 *     on +Z. Read as longitude, the geometry is at lon = 360·u − 180 + 90.
 *
 * The two therefore disagree by a uniform +90° in longitude — equirectUV
 * paints u = 0.5 where the geometry samples u = 0.25 — and rotating the mesh
 * by −90° about +Y cancels it exactly, for every latitude at once.
 *
 * Rotating the MESH rather than shifting equirectUV is deliberate: shifting
 * the projection would move the rasteriser's ±180° seam into the middle of
 * the coastline ring data, and every polygon crossing the new seam would be
 * smeared right across the map by the canvas fill.
 */
export const GLOBE_TEXTURE_ROTATION_Y = -Math.PI / 2;

/**
 * `CanvasTexture.flipY` for each of the two map families. These are part of
 * the projection contract, not an incidental texture setting, so they live
 * next to the projections and are asserted in map-projection.test.js.
 *
 * Both `equirectUV` and `discUV` return `v` as a CANVAS ROW fraction — row 0
 * is the top row, which is what the rasteriser in textures.js writes at
 * `y = v·h`. Whether that agrees with what the GPU samples depends entirely
 * on flipY, which decides whether canvas row 0 becomes texture v = 0 or
 * texture v = 1:
 *
 *   EQUIRECT: SphereGeometry's uv.y is 1 at the north pole and 0 at the
 *     south, while equirectUV puts north at v = 0. The two are already
 *     opposite, so the default flipY = true is exactly right and must stay.
 *
 *   DISC: CircleGeometry's uv.y increases with the mesh's local +y, which
 *     makeDisc's −90° X rotation maps to world −Z; discUV's v likewise
 *     decreases with the projection's north-up +y. The two already agree, so
 *     the default flipY = true would flip the map, displaying lon' = 180 − lon
 *     — a mirrored world. It must be false.
 */
export const EQUIRECT_FLIP_Y = true;
export const DISC_FLIP_Y = false;

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
