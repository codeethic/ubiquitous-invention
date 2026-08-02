// Physical constants. All distances km, all angles degrees unless named *Rad.
export const R_EARTH_KM = 6371;
export const AU_KM = 149597870.7;
export const SUN_DIAMETER_KM = 1391400;
export const EARTH_ORBIT_ECCENTRICITY = 0.0167;
export const OBLIQUITY_DEG = 23.44;

// Flat-model parameters. The sun's altitude is the model's own standard figure.
// Its diameter is NOT fixed here — solar.js derives it so the sun subtends the
// observed angular size when overhead, which hands the model its best case.
export const FLAT_SUN_ALTITUDE_KM = 5000;

// Disc radius: north pole at centre, south "rim" at latitude -90.
export const FLAT_DISC_RADIUS_KM = R_EARTH_KM * Math.PI;

/**
 * Radius of the flat model's illuminated spotlight, chosen so it lights exactly
 * half the disc's AREA. This is the model's best case: smaller and it fails
 * trivially, larger and it lights more than half the world at once.
 */
export const FLAT_SPOTLIGHT_RADIUS_KM = FLAT_DISC_RADIUS_KM / Math.SQRT2;

export const CRUISE_SPEED_KMH = 900;

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/**
 * Lowest observer latitude the Eratosthenes module may offer. Must stay above
 * OBLIQUITY_DEG so the subsolar point can never fall between two observers —
 * see the DOMAIN note on globeRadiusFromPairKm. Lives here rather than as a
 * literal in the module so a pure test can enforce it; the module itself
 * imports Three.js and cannot be loaded under `node --test`.
 */
export const ERATOSTHENES_MIN_LAT_DEG = 25;
