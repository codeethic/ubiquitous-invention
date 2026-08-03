import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solarDeclinationDeg, dayLengthHours, flatDayLengthHours,
  solarAngularDiameterDeg, flatSunDiameterKm, flatSunAngularDiameterDeg,
  globeRadiusFromPairKm, flatSunAltitudeFromPairKm,
  isDaylitGlobe, isDaylitFlat,
} from '../js/physics/solar.js';
import { OBLIQUITY_DEG, ERATOSTHENES_MIN_LAT_DEG } from '../js/physics/constants.js';

const near = (a, e, tol, label) =>
  assert.ok(Math.abs(a - e) <= tol, `${label}: expected ${e} ±${tol}, got ${a}`);

test('declination peaks at the obliquity on the solstices', () => {
  near(solarDeclinationDeg(172), 23.44, 0.02, 'June solstice');
  near(solarDeclinationDeg(355), -23.44, 0.02, 'December solstice');
});

test('day length is 24 h at 70N on the June solstice', () => {
  assert.equal(dayLengthHours(70, 172), 24);
});

test('day length is 0 h at 70N on the December solstice', () => {
  assert.equal(dayLengthHours(70, 355), 0);
});

test('the Arctic Circle itself is deliberately not asserted at 24 h', () => {
  // 66.56 computes to ~23.91 h — exactly the boundary case that makes a test
  // flaky. Documented here so nobody "fixes" it to 24 later.
  assert.ok(dayLengthHours(66.56, 172) < 24);
  assert.ok(dayLengthHours(66.56, 172) > 23.5);
});

test('the flat model reproduces the ARCTIC midnight sun', () => {
  // Its spotlight covers the whole northern region. This is the flat model at
  // its best, and the app says so rather than hiding it.
  assert.equal(flatDayLengthHours(70, 172), 24);
});

test('the flat model CANNOT reproduce the Antarctic midnight sun', () => {
  assert.equal(dayLengthHours(-70, 355), 24);          // observed
  near(flatDayLengthHours(-70, 355), 6.95, 0.1, 'flat 70S December');
});

test('the flat model wrongly lights the Arctic in December', () => {
  assert.equal(dayLengthHours(70, 355), 0);            // observed: polar night
  near(flatDayLengthHours(70, 355), 17.37, 0.1, 'flat 70N December');
});

test('solar angular diameter stays inside 0.524-0.542 deg all year', () => {
  let min = Infinity, max = -Infinity;
  for (let d = 1; d <= 365; d += 1) {
    const a = solarAngularDiameterDeg(d);
    min = Math.min(min, a); max = Math.max(max, a);
  }
  near(min, 0.5241, 0.002, 'aphelion');
  near(max, 0.5420, 0.002, 'perihelion');
});

test('flat sun diameter is derived, never hard-coded at 51 km', () => {
  near(flatSunDiameterKm(), 46.505, 0.05, 'derived diameter');
  near(flatSunAngularDiameterDeg(0), 0.5329, 0.002, 'overhead matches observed');
});

test('the flat sun should more than halve in size by 10000 km ground distance', () => {
  const overhead = flatSunAngularDiameterDeg(0);
  const far = flatSunAngularDiameterDeg(10000);
  near(far, 0.2383, 0.002, 'flat sun at 10000 km');
  assert.ok(far < overhead / 2);
});

test('the globe gives one radius from every latitude pair', () => {
  near(globeRadiusFromPairKm(30, 45, 0), 6371, 1, 'pair A.B');
  near(globeRadiusFromPairKm(45, 60, 0), 6371, 1, 'pair B.C');
});

test('globeRadiusFromPairKm actually reads its inputs', () => {
  // Inside the valid domain the answer is exactly R for ANY pair — the physical
  // point, but also why `return R_EARTH_KM` would satisfy the test above. This
  // case steps deliberately OUTSIDE the domain, putting the subsolar latitude
  // between the observers so the shadow angles no longer subtract. A real
  // computation diverges; a hard-coded constant would not.
  const outOfDomain = globeRadiusFromPairKm(10, 50, 25);
  assert.ok(Math.abs(outOfDomain - 6371) > 1000,
    `expected out-of-domain divergence, got ${outOfDomain}`);
});

test('the Eratosthenes controls cannot reach the degenerate case', () => {
  // Observer A starts at ERATOSTHENES_MIN_LAT_DEG, above the maximum declination, so the
  // subsolar point can never fall between two observers. Sourcing the bound from
  // a constant means widening the slider later fails the test suite instead of
  // shipping the degenerate case.
  assert.ok(ERATOSTHENES_MIN_LAT_DEG > OBLIQUITY_DEG,
    'lowest selectable observer latitude must exceed the maximum declination');
  assert.equal(
    Number.isFinite(globeRadiusFromPairKm(ERATOSTHENES_MIN_LAT_DEG, 41, OBLIQUITY_DEG)),
    true);
});

test('the flat model gives contradictory sun altitudes from two pairs', () => {
  const ab = flatSunAltitudeFromPairKm(30, 45, 0);
  const bc = flatSunAltitudeFromPairKm(45, 60, 0);
  near(ab, 3946.4, 5, 'pair A.B');
  near(bc, 2278.4, 5, 'pair B.C');
  const divergence = Math.abs(ab - bc) / Math.max(ab, bc);
  assert.ok(divergence > 0.20, `expected >20% divergence, got ${divergence}`);
});

test('the flat spotlight lights places that are actually in darkness', () => {
  const london = { lat: 51.5074, lon: -0.1278 };
  assert.equal(isDaylitGlobe(london, 172, 0), false);
  assert.equal(isDaylitFlat(london, 172, 0), true);
});
