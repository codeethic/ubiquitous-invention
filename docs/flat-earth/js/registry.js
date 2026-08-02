import horizon from './phenomena/horizon.js';

/** Ordered list. Adding a phenomenon is one import plus one array entry. */
export const MODULES = [horizon];

export const getModule = id => MODULES.find(m => m.id === id) ?? MODULES[0];
