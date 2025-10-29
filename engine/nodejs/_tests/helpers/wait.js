// @ts-check

/**
 * Wait for a given number of milliseconds.
 * @param {number} ms Milliseconds to wait.
 * @returns {Promise<void>} Promise that resolves after `ms`.
 */
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Repeatedly calls `fn` until it resolves to `true` or the timeout expires.
 *
 * The first attempt is immediate; subsequent attempts are spaced by `intervalMs`.
 *
 * @param {() => Promise<boolean>} fn Asynchronous condition function; must resolve to a boolean.
 * @param {{ intervalMs?: number, timeoutMs?: number, onTick?: (attempt: number) => void }} [opts]
 *  - intervalMs: Polling interval in ms (default: 500).
 *  - timeoutMs: Absolute timeout in ms (default: 20000).
 *  - onTick: Optional callback invoked before each retry with the attempt index (1-based).
 * @returns {Promise<boolean>} True if the condition became true within the timeout, false otherwise.
 */
async function pollUntil(fn, opts = {}) {
  const intervalMs = opts.intervalMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 20000;
  const started = Date.now();
  let attempt = 0;

  // First attempt is immediate
  if (await fn()) return true;

  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    if (opts.onTick) opts.onTick(attempt);
    await wait(intervalMs);
    if (await fn()) return true;
  }
  return false;
}

module.exports = { pollUntil, wait };
