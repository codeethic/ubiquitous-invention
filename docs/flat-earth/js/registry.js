import horizon from './phenomena/horizon.js';
import eratosthenes from './phenomena/eratosthenes.js';

/** Ordered list. Adding a phenomenon is one import plus one array entry. */
export const MODULES = [horizon, eratosthenes];

export const getModule = id => MODULES.find(m => m.id === id) ?? MODULES[0];
