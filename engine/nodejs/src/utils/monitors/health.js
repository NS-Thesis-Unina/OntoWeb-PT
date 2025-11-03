// @ts-check

/**
 * Centralized health registry to aggregate component states.
 * Exposed API:
 *  - setState(key, value): update a component state
 *  - getHealth(): snapshot with { ok, components }
 *
 * ok === true only if server, graphdb and redis are all 'up'.
 */

/** @typedef {'unknown'|'up'|'down'|'connecting'|'shutting_down'} HealthState */

const state = {
  server: /** @type {HealthState} */ ('up'),
  graphdb: /** @type {HealthState} */ ('unknown'),
  redis: /** @type {HealthState} */ ('unknown'),
};

/**
 * Update the health state for a component.
 * @param {'server'|'graphdb'|'redis'} key
 * @param {HealthState} value
 */
function setState(key, value) {
  state[key] = value;
}

/**
 * Return a snapshot of the current health and the aggregated ok flag.
 * @returns {{ ok: boolean, components: Record<'server'|'graphdb'|'redis', HealthState> }}
 */
function getHealth() {
  const snapshot = /** @type {Record<'server'|'graphdb'|'redis', HealthState>} */ ({ ...state });
  const ok = snapshot.server === 'up' && snapshot.graphdb === 'up' && snapshot.redis === 'up';
  return { ok, components: snapshot };
}

module.exports = { setState, getHealth };
