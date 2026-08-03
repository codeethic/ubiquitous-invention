/**
 * One bounded JSON fetch, used by every data load in the app.
 *
 * WHY THIS EXISTS. A fetch that REJECTS is easy — every caller already handles
 * it. A fetch that STALLS is the dangerous one: a captive portal, or a proxy
 * that accepts the connection and never answers, produces a promise that never
 * settles at all. `await` on it is indistinguishable from a hang, and both
 * places this app awaits data sit in front of something the user is waiting
 * for — `boot()`'s path to `setLoading(false)`, and `activate()`'s
 * `await module.load()` before a phenomenon can render. This project has
 * already shipped one bug of exactly that shape.
 *
 * WHY IT IS SHARED. This is the third caller. Three near-identical copies of
 * an abort dance is how the fourth one silently ships without a timeout, or
 * how one of the three drifts to a different duration for no reason anybody
 * can later reconstruct.
 *
 * WHY IT LIVES IN js/lib/ AND IMPORTS NOTHING. Two of its three callers are
 * files in js/phenomena/, which are bound by the frozen module contract in
 * README.md. Anything they import, they inherit — so this module deliberately
 * pulls in no Three.js, no DOM beyond `fetch`/`AbortController`/`setTimeout`,
 * and nothing from js/physics/ (which is off limits) or js/lib/textures.js
 * (which would drag Three.js and a 2D canvas into two phenomena that need
 * neither). Importing nothing also means it runs under `node --test`, which is
 * how the timeout below is actually tested rather than merely asserted in a
 * comment.
 */

/**
 * Default stall budget, milliseconds.
 *
 * Long enough that a slow-but-live connection finishes — these are small local
 * JSON files, so anything past a few seconds is a stall rather than slowness.
 * Short enough that a user staring at a loading overlay or a half-switched
 * phenomenon gets a real answer instead of an indefinite wait.
 */
export const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch and parse JSON, or throw a descriptive Error within `timeoutMs`.
 *
 * `label` names the resource in every error message; pass the bare filename so
 * the text reads as it did before this helper existed ("cities.json returned
 * HTTP 404"), not as a URL.
 *
 * Never resolves with partial data and never hangs. Callers get exactly one of
 * three outcomes: parsed JSON, or an Error, or nothing yet — and the third is
 * bounded by `timeoutMs`.
 *
 * @param {string} url
 * @param {{ label?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<unknown>}
 */
export async function fetchJson(url, { label = url, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${label} returned HTTP ${res.status}`);
    // Inside the timeout as well, and that is the point: a response whose
    // HEADERS arrive and whose BODY then stalls mid-stream hangs here just as
    // effectively as one that never answered. Aborting the signal rejects this
    // read too, which it would not if the timer were cleared after the
    // headers.
    return await res.json();
  } catch (err) {
    // Translated, not re-thrown raw. An AbortError says "someone called
    // abort()", which tells a user nothing; the whole value of the timeout is
    // that the failure explains itself in the error card the harness builds
    // from this message.
    if (err?.name === 'AbortError') {
      throw new Error(`${label} did not respond within ${timeoutMs} ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
