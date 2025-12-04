// @ts-check

/**
 * Centralized health registry to aggregate component states.
 * Exposed API:
 *  - setState(key, value): update a component state
 *  - getHealth(): snapshot with { ok, components }
 *
 * ok === true only if server, graphdb and redis are all 'up'.
 */

/** @typedef {import('../_types/monitors/types').HealthState} HealthState */
/** @typedef {import('../_types/monitors/types').HealthComponentsKey} HealthComponentsKey */
/** @typedef {import('../_types/monitors/types').HealthSnapshot} HealthSnapshot */

/**
 * Internal in-memory health state.
 *
 * - `server`  → HTTP server / API layer
 * - `graphdb` → GraphDB connectivity
 * - `redis`   → Redis connectivity
 *
 * @type {Record<HealthComponentsKey, HealthState>}
 */
const state = {
  server: /** @type {HealthState} */ ('up'),
  graphdb: /** @type {HealthState} */ ('unknown'),
  redis: /** @type {HealthState} */ ('unknown'),
};

/**
 * Update the health state for a component.
 *
 * @param {HealthComponentsKey} key - Component identifier ('server', 'graphdb', 'redis').
 * @param {HealthState} value - New health state for that component.
 */
function setState(key, value) {
  state[key] = value;
}

/**
 * Return a snapshot of the current health and the aggregated `ok` flag.
 *
 * - `ok === true` only if all tracked components are exactly 'up'.
 *
 * @returns {HealthSnapshot} Snapshot with `ok` and per-component states.
 */
function getHealth() {
  /** @type {Record<HealthComponentsKey, HealthState>} */
  const snapshot = { ...state };
  const ok = snapshot.server === 'up' && snapshot.graphdb === 'up' && snapshot.redis === 'up';
  return { ok, components: snapshot };
}

module.exports = { setState, getHealth };
