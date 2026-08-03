/**
 * What each phenomenon measures, and the ceiling on any visual detail placed
 * near it.
 *
 * Seven of the eight modules shipped a defect during the original build where
 * the readout was numerically correct and the picture showed something else,
 * and all seven passed the automated suite. Realism is a new and generous
 * source of exactly that failure: a wave taller than the hidden hull, a glow
 * wider than the solar disc, a cloud over the terminator.
 *
 * `magnitude` is the size of the effect the module demonstrates. `maxDetail`
 * is the largest visual perturbation the renderer is permitted to add near it,
 * in the SAME unit. test/signal-budget.test.js enforces a 10x separation.
 *
 * This locks the declared numbers. It cannot verify the renderer honours them
 * — nothing headless can, which is why README.md's manual visual checklist
 * still runs. What it converts is "someone remembers the ocean must stay flat"
 * into "the build fails if someone writes a displacement value".
 *
 * Zero imports, so it loads under `node --test`.
 */

export const SIGNAL_BUDGET = {
  horizon: {
    signal: 'hull height hidden by curvature at 12 km, 2 m eye height',
    magnitude: 3.79, maxDetail: 0, unit: ' m',
  },
  eratosthenes: {
    signal: 'gnomon shadow length at world scale',
    magnitude: 300, maxDetail: 6, unit: ' km',
  },
  'midnight-sun': {
    signal: 'daylight hours disagreement between models',
    magnitude: 17, maxDetail: 1, unit: ' h',
  },
  'sun-size': {
    signal: 'apparent solar diameter change from noon to 18:00',
    magnitude: 0.356, maxDetail: 0, unit: '°',
  },
  'lunar-eclipse': {
    signal: 'curvature radius of the cast shadow edge',
    magnitude: 555, maxDetail: 55, unit: ' km',
  },
  'southern-stars': {
    signal: 'apparent rotation rate about the celestial pole',
    magnitude: 15, maxDetail: 0, unit: '°/h',
  },
  'flight-routes': {
    signal: 'route length difference between models',
    magnitude: 14337, maxDetail: 200, unit: ' km',
  },
  'time-zones': {
    signal: 'terminator position error in the flat model',
    magnitude: 6, maxDetail: 0, unit: ' h',
  },
};

/**
 * Ocean vertical displacement, in metres. MUST be zero.
 *
 * Imported by primitives.js so this is a live code path, not a comment: the
 * ocean geometry is built flat and the sea's appearance comes entirely from a
 * normal map, which perturbs shading and adds no geometry. hiddenHeightM()
 * therefore stays exactly 3.79 m at 12 km.
 */
export const OCEAN_DISPLACEMENT_M = 0;
