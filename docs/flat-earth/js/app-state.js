/**
 * Minimal observable state store. The single channel between UI and simulation.
 * No DOM, no Three.js — testable in Node.
 */
export function createState(initial = {}) {
  let value = { ...initial };
  const listeners = new Set();

  const notify = () => {
    // Frozen because every subscriber in a cycle receives the SAME object.
    // Unfrozen, a subscriber that annotates what it was handed silently
    // corrupts what later subscribers see. ES modules are strict mode, so a
    // stray write now throws at the offending line instead.
    const snapshot = Object.freeze({ ...value });
    for (const fn of listeners) fn(snapshot);
  };

  return {
    get: () => ({ ...value }),

    set(patch) {
      let changed = false;
      for (const [k, v] of Object.entries(patch)) {
        if (!Object.is(value[k], v)) { changed = true; break; }
      }
      if (!changed) return;
      value = { ...value, ...patch };
      notify();
    },

    reset(next = {}) {
      value = { ...next };
      notify();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
