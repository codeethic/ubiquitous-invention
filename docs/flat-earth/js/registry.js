import horizon from './phenomena/horizon.js';
import eratosthenes from './phenomena/eratosthenes.js';
import midnightSun from './phenomena/midnight-sun.js';
import sunSize from './phenomena/sun-size.js';
import lunarEclipse from './phenomena/lunar-eclipse.js';
import southernStars from './phenomena/southern-stars.js';
import flightRoutes from './phenomena/flight-routes.js';
import timeZones from './phenomena/time-zones.js';

/** Ordered list. Adding a phenomenon is one import plus one array entry. */
export const MODULES = [horizon, eratosthenes, midnightSun, sunSize, lunarEclipse, southernStars, flightRoutes, timeZones];

export const getModule = id => MODULES.find(m => m.id === id) ?? MODULES[0];
