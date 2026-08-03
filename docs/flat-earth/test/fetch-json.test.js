/**
 * fetchJson's timeout, tested rather than asserted in a comment.
 *
 * This is the one piece of the app's network handling that CAN be tested
 * headlessly — js/lib/fetch-json.js deliberately imports nothing, so `fetch`
 * is reachable as a global and can be stubbed. The failure it guards against
 * (a connection that neither resolves nor rejects) is impossible to reproduce
 * by hand and easy to reproduce here, which is exactly the wrong way round to
 * leave it uncovered.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, FETCH_TIMEOUT_MS } from '../js/lib/fetch-json.js';

// The two stall tests carry an explicit per-test timeout. Removing the guard
// they cover turns them from failing into HANGING, and a hung CI job is a much
// worse bug report than a failed assertion.
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** A response that never settles until its signal aborts — the stall case. */
const stallingFetch = () => (url, { signal } = {}) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason));
});

const jsonFetch = (body, { ok = true, status = 200 } = {}) => async () => ({
  ok, status, json: async () => body,
});

test('resolves the parsed body on success', async () => {
  globalThis.fetch = jsonFetch({ rings: [1, 2] });
  assert.deepEqual(await fetchJson('./data/x.json'), { rings: [1, 2] });
});

test('passes an AbortSignal so the request is cancellable at all', async () => {
  // Without a signal reaching fetch, the timer below fires into the void and
  // the timeout is decorative. Assert the wiring, not just the outcome.
  let seen = null;
  globalThis.fetch = async (url, opts) => {
    seen = opts?.signal;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await fetchJson('./data/x.json');
  assert.ok(seen, 'no signal was passed to fetch');
  assert.equal(seen.aborted, false, 'signal was already aborted before the call');
});

test('a STALLED connection fails with a descriptive Error, not a hang', { timeout: 5000 }, async () => {
  // The whole point. A fetch that never settles must not produce an await that
  // never returns: `activate()` awaits load(), and boot() awaits the coastline
  // read, so an unbounded stall wedges the app behind a half-finished switch
  // or a loading overlay with nothing on screen to explain it.
  globalThis.fetch = stallingFetch();
  await assert.rejects(
    fetchJson('./data/cities.json', { label: 'cities.json', timeoutMs: 25 }),
    err => {
      // Translated, not the raw AbortError: "This operation was aborted" tells
      // a user nothing, and this message is what the harness puts on the card.
      assert.notEqual(err.name, 'AbortError', 'raw AbortError leaked to the caller');
      assert.match(err.message, /^cities\.json did not respond within 25 ms$/);
      return true;
    });
});

test('a stalled BODY is covered too, not just stalled headers', { timeout: 5000 }, async () => {
  // Clearing the timer once the response object arrives is the obvious wrong
  // implementation: res.json() reads the stream, and a body that stops
  // mid-transfer hangs exactly as hard as headers that never arrive.
  globalThis.fetch = async (url, { signal } = {}) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }),
  });
  await assert.rejects(
    fetchJson('./data/cities.json', { label: 'cities.json', timeoutMs: 25 }),
    /cities\.json did not respond within 25 ms/);
});

test('an HTTP error keeps the wording the callers used before the helper', async () => {
  // These strings reach the user through the harness's error card. The helper
  // was extracted from three call sites; it must not silently reword them.
  globalThis.fetch = jsonFetch(null, { ok: false, status: 404 });
  await assert.rejects(
    fetchJson('./data/cities.json', { label: 'cities.json' }),
    /^Error: cities\.json returned HTTP 404$/);
});

test('a malformed body propagates its own error unchanged', async () => {
  // Not a timeout and not an HTTP status: a SyntaxError from the parser is the
  // caller's problem to describe, and rewriting it as a timeout would be a lie.
  globalThis.fetch = async () => ({
    ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON'); },
  });
  await assert.rejects(fetchJson('./data/x.json'), /bad JSON/);
});

test('the shared default is a real number of seconds, not a placeholder', () => {
  assert.equal(typeof FETCH_TIMEOUT_MS, 'number');
  assert.ok(FETCH_TIMEOUT_MS >= 1000 && FETCH_TIMEOUT_MS <= 15000,
    `implausible default timeout: ${FETCH_TIMEOUT_MS} ms`);
});

test('a success leaves no pending timer holding the process open', async () => {
  // If clearTimeout were dropped, every successful fetch would leave a live
  // 5 s timer. In a browser that is a leak per module switch; here it is
  // observable, because node exits when nothing is left to do.
  globalThis.fetch = jsonFetch({ ok: 1 });
  const before = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
  await fetchJson('./data/x.json');
  const after = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
  assert.ok(after <= before, `timer left pending: ${before} -> ${after}`);
});
