import horizon from './phenomena/horizon.js';
import eratosthenes from './phenomena/eratosthenes.js';
import midnightSun from './phenomena/midnight-sun.js';
import sunSize from './phenomena/sun-size.js';
import lunarEclipse from './phenomena/lunar-eclipse.js';

/** Ordered list. Adding a phenomenon is one import plus one array entry. */
export const MODULES = [horizon, eratosthenes, midnightSun, sunSize, lunarEclipse];

export const getModule = id => MODULES.find(m => m.id === id) ?? MODULES[0];
