// @ts-check

const IORedis = require('ioredis').default;
const { makeLogger } = require('../logs/logger');

/** @typedef {import('../_types/monitors/types').RedisMonitorState} RedisMonitorState */
/** @typedef {import('../_types/monitors/types').RedisConnectionOptions} RedisConnectionOptions */
/** @typedef {import('../_types/monitors/types').RedisStateReporter} RedisStateReporter */
/** @typedef {import('../_types/monitors/types').RedisMonitorHandle} RedisMonitorHandle */

/**
 * Start a lightweight Redis connection just for health logging and state transitions.
 *
 * This monitor:
 * - Creates an internal ioredis client (separate from BullMQ / main client).
 * - Tracks connection state: 'unknown' → 'connecting' → 'up' / 'down'.
 * - Logs lifecycle events (connect, ready, reconnecting, end, error, wait).
 * - Optionally reports state changes to a callback (for centralized health handling).
 *
 * The created connection is meant purely for monitoring and can be stopped via
 * the returned `stop()` method, which calls `redis.disconnect()`.
 *
 * @param {RedisConnectionOptions} connectionOpts - Options passed to `new IORedis(...)` (same shape as your BullMQ/ioredis config).
 * @param {string} [ns='redis:monitor'] - Logger namespace.
 * @param {RedisStateReporter} [report] - Optional state reporter invoked on transitions.
 * @returns {RedisMonitorHandle} Handle with `stop()` and `getState()` helpers.
 */
function startRedisMonitor(connectionOpts, ns = 'redis:monitor', report) {
  const log = makeLogger(ns);
  // Shallow clone to avoid outside mutations
  const opts = { ...connectionOpts };

  const redis = new IORedis(opts);
  let wasReady = false;
  let reconnectAttempts = 0;
  /** @type {RedisMonitorState} */
  let state = 'unknown';

  redis.on('connect', () => {
    // 'connect' precedes 'ready' (socket opened but not necessarily ready)
    log.debug('Connecting to Redis socket...');
    state = 'connecting';
    if (typeof report === 'function') report(state);
  });

  redis.on('ready', () => {
    const first = !wasReady;
    wasReady = true;
    reconnectAttempts = 0;
    log.info(first ? 'Redis READY (connected)' : 'Redis RECONNECTED (ready)');
    state = 'up';
    if (typeof report === 'function') report(state);
  });

  // ioredis emits 'reconnecting' with a single argument: delay (ms) until the next attempt
  redis.on('reconnecting', (delayMs) => {
    reconnectAttempts += 1;
    log.warn(`Reconnecting... attempt=${reconnectAttempts} delay=${Number(delayMs) || 0}ms`);
    state = 'connecting';
    if (typeof report === 'function') report(state);
  });

  // 'end' = connection closed; after this, 'reconnecting' will be emitted (unless fully stopped)
  redis.on('end', () => {
    if (wasReady) log.warn('Redis DISCONNECTED');
    wasReady = false;
    state = 'down';
    if (typeof report === 'function') report(state);
  });

  redis.on('error', (err) => {
    const msg = String(err?.message || err);
    // Respect QUIET_REDIS_ERRORS=1 to silence extremely frequent network errors
    if (process.env.QUIET_REDIS_ERRORS === '1' && /ECONNREFUSED|getaddrinfo|ETIMEDOUT/i.test(msg)) return;
    log.warn('Redis error', msg);
  });

  // Optional: when the server is in LOADING or similar transitional states
  redis.on('wait', () => {
    log.debug('Waiting for Redis to be ready...');
  });

  return {
    stop: () => redis.disconnect(),
    getState: () => state,
  };
}

module.exports = startRedisMonitor;
