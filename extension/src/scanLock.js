/**
 * UI Scan Lock
 *
 * This module implements a lightweight, in-memory-per-session lock mechanism
 * on top of `browser.storage.session` to coordinate long-running scan workflows
 * across different UI sections (Analyzer, TechStack, Interceptor).
 *
 * Architectural Responsibilities:
 * - Ensure that only one "owner" (feature/module) at a time holds the scan lock.
 * - Provide a TTL-based expiration mechanism to automatically clear stale locks.
 * - Expose a subscription API (`subscribeLockChanges`) so UI components can
 *   react to lock changes in real time (e.g. enabling/disabling buttons, showing
 *   “scan in progress” states).
 *
 * Owners (logical lock holders):
 * - TECHSTACK_ONETIME: one-time TechStack scan.
 * - ANALYZER_ONETIME: one-time Analyzer scan.
 * - ANALYZER_RUNTIME: runtime Analyzer scan (continuous).
 * - INTERCEPTOR_RUNTIME: runtime Interceptor capture (continuous).
 */

/**
 * @typedef {Object} ScanLock
 * @property {string} owner   - Identifier of the current lock owner.
 * @property {string} [label] - Human-readable label for debugging / UI display.
 * @property {number} startedAt - Timestamp (ms) when the lock was acquired.
 * @property {number} ttlMs     - Time-to-live in milliseconds.
 */

import browser from 'webextension-polyfill';

const KEY = 'ui_scan_lock';
const DEFAULT_TTL_MS = 1000 * 60 * 120; // 120 minutes

/**
 * Logical owners that can acquire the scan lock.
 * The string values are persisted in session storage.
 */
const OWNERS = {
  TECHSTACK_ONETIME: 'techstack_onetime',
  ANALYZER_ONETIME: 'analyzer_onetime',
  ANALYZER_RUNTIME: 'analyzer_runtime',
  INTERCEPTOR_RUNTIME: 'interceptor_runtime',
};
export { OWNERS };

/**
 * Returns current timestamp in milliseconds.
 * Wrapped in a function to simplify testing/mocking if needed.
 */
function now() {
  return Date.now();
}

/**
 * Low-level helper to read the raw lock object from session storage.
 *
 * @returns {Promise<ScanLock|null>}
 * @private
 */
async function _readRaw() {
  try {
    const obj = await browser.storage.session.get(KEY);
    return obj?.[KEY] ?? null;
  } catch {
    return null;
  }
}

/**
 * Low-level helper to write the raw lock object to session storage.
 *
 * @param {ScanLock} lock
 * @returns {Promise<void>}
 * @private
 */
async function _writeRaw(lock) {
  try {
    await browser.storage.session.set({ [KEY]: lock });
  } catch {
    // Storage failures are non-fatal for UI logic.
  }
}

/**
 * Low-level helper to clear the raw lock from session storage.
 *
 * @returns {Promise<void>}
 * @private
 */
async function _clearRaw() {
  try {
    await browser.storage.session.remove(KEY);
  } catch {
    // Storage failures are non-fatal for UI logic.
  }
}

/**
 * Determines whether a given lock has expired based on TTL.
 *
 * @param {ScanLock|null} lock
 * @returns {boolean} true if the lock should be considered expired.
 * @private
 */
function _isExpired(lock) {
  if (!lock) return true;

  const ttl = Number(lock.ttlMs ?? DEFAULT_TTL_MS);
  const started = Number(lock.startedAt ?? 0);

  // If started or ttl are not valid, treat as non-expired to avoid
  // accidentally dropping locks due to malformed data.
  if (!started || !ttl) return false;

  return now() - started > ttl;
}

/**
 * Returns the current valid lock, or null if no lock exists or it has expired.
 *
 * If the lock is expired, this function will also clear it from storage.
 *
 * @returns {Promise<ScanLock|null>}
 */
export async function getLock() {
  const lock = await _readRaw();
  if (!lock) return null;

  if (_isExpired(lock)) {
    await _clearRaw();
    return null;
  }

  return lock;
}

/**
 * Attempts to acquire the scan lock for the given owner.
 *
 * Behavior:
 * - If another owner currently holds the lock, acquisition fails.
 * - If no lock is present, a new lock is created with the given owner/label/ttl.
 * - If the same owner already holds the lock, this is treated as a successful
 *   re-acquisition and the existing lock is returned.
 *
 * @param {string} owner - The owner attempting to acquire the lock.
 * @param {string} label - Human-readable label for debugging or UI display.
 * @param {number} [ttlMs=DEFAULT_TTL_MS] - Optional TTL override in ms.
 * @returns {Promise<{ ok: boolean, lock?: ScanLock, reason?: string }>}
 */
export async function acquireLock(owner, label, ttlMs = DEFAULT_TTL_MS) {
  const current = await getLock();

  // Lock is held by another owner -> acquisition fails.
  if (current && current.owner !== owner) {
    return { ok: false, lock: current, reason: 'locked' };
  }

  // No existing lock -> create a new one.
  if (!current) {
    const next = { owner, label, startedAt: now(), ttlMs };
    await _writeRaw(next);
    return { ok: true, lock: next };
  }

  // Same owner already holds the lock -> treat as success.
  return { ok: true, lock: current };
}

/**
 * Releases the scan lock if and only if the given owner currently holds it.
 *
 * @param {string} owner - The owner attempting to release the lock.
 * @returns {Promise<{ ok: boolean, reason?: string, lock?: ScanLock }>}
 */
export async function releaseLock(owner) {
  const current = await getLock();
  if (!current) return { ok: true };

  if (current.owner !== owner) {
    return { ok: false, reason: 'not_owner', lock: current };
  }

  await _clearRaw();
  return { ok: true };
}

/**
 * Subscribes to changes of the scan lock in session storage.
 *
 * The callback is invoked whenever the value under KEY (`ui_scan_lock`)
 * changes in `browser.storage.session`.
 *
 * @param {(newLock: ScanLock|null, oldLock: ScanLock|null) => void} callback
 * @returns {() => void} Unsubscribe function to remove the listener.
 */
export function subscribeLockChanges(callback) {
  const handler = (changes, areaName) => {
    if (areaName !== 'session') return;

    if (Object.prototype.hasOwnProperty.call(changes, KEY)) {
      const newVal = changes[KEY]?.newValue ?? null;
      const oldVal = changes[KEY]?.oldValue ?? null;
      callback(newVal, oldVal);
    }
  };

  try {
    browser.storage.onChanged.addListener(handler);
  } catch {
    // Ignore: if the listener cannot be attached, no subscription happens.
  }

  return () => {
    try {
      browser.storage.onChanged.removeListener(handler);
    } catch {
      // Ignore: best-effort cleanup.
    }
  };
}
