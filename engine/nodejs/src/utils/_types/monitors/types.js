/**
 * High-level health state used by the central health registry.
 *
 * - 'unknown'       → initial / not yet probed
 * - 'up'            → component is reachable and healthy
 * - 'down'          → component is unreachable / failing
 * - 'connecting'    → connection is in progress (e.g. Redis)
 * - 'shutting_down' → component is in the process of stopping
 *
 * @typedef {'unknown'|'up'|'down'|'connecting'|'shutting_down'} HealthState
 */

/**
 * Keys for components tracked by the health registry.
 *
 * @typedef {'server'|'graphdb'|'redis'} HealthComponentsKey
 */

/**
 * Snapshot returned by the health registry.
 *
 * - `ok`         → true only if all critical components are 'up'
 * - `components` → per-component state
 *
 * @typedef {{ ok: boolean, components: Record<HealthComponentsKey, HealthState> }} HealthSnapshot
 */

/**
 * Health state used specifically by the GraphDB monitor.
 *
 * @typedef {'up'|'down'|'unknown'} GraphDBHealthState
 */

/**
 * Function used by the GraphDB monitor to execute a SPARQL query.
 *
 * Typically this will be `runSelect` from the GraphDB client.
 *
 * @callback GraphDBRunSelectFn
 * @param {string} sparql - SPARQL query to execute (e.g. "ASK {}").
 * @returns {Promise<any>} Promise resolving to the SPARQL JSON result.
 */

/**
 * Optional callback invoked on GraphDB state changes.
 *
 * @callback GraphDBStateReporter
 * @param {GraphDBHealthState} state - New GraphDB health state.
 * @returns {void}
 */

/**
 * Handle returned by the GraphDB health probe.
 *
 * - `stop()`     → cancels the periodic probe timer
 * - `getState()` → returns the last observed GraphDB state
 *
 * @typedef {{ stop: () => void, getState: () => GraphDBHealthState }} GraphDBProbeHandle
 */

/**
 * Health state used by the Redis monitor.
 *
 * - 'unknown'    → initial / not yet connected
 * - 'connecting' → connecting or reconnecting
 * - 'up'         → ready/connected
 * - 'down'       → disconnected
 *
 * @typedef {'unknown'|'connecting'|'up'|'down'} RedisMonitorState
 */

/**
 * Connection options passed to ioredis.
 *
 * This matches the generic shape accepted by `new IORedis(...)`.
 * It is intentionally loose to avoid depending on the ioredis types.
 *
 * @typedef {Record<string, any>} RedisConnectionOptions
 */

/**
 * Optional callback invoked on Redis state changes.
 *
 * @callback RedisStateReporter
 * @param {RedisMonitorState} state - New Redis monitor state.
 * @returns {void}
 */

/**
 * Handle returned by the Redis monitor.
 *
 * - `stop()`     → closes the Redis connection
 * - `getState()` → returns the last observed Redis state
 *
 * @typedef {{ stop: () => void, getState: () => RedisMonitorState }} RedisMonitorHandle
 */

module.exports = {};
