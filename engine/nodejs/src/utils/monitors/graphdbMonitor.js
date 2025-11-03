// @ts-check

const { makeLogger } = require('../logs/logger');

/**
 * Periodically pings GraphDB via runSelect("ASK {}") and logs state transitions.
 * It optionally reports state changes to a callback (for health aggregation).
 *
 * @param {(sparql: string) => Promise<any>} runSelect - function to run SPARQL SELECT/ASK
 * @param {string} [ns='graphdb:probe'] - logger namespace
 * @param {number} [intervalMs=Number(process.env.GRAPHDB_HEALTH_INTERVAL_MS || 5000)] - probe interval in ms
 * @param {(state: 'up'|'down'|'unknown') => void} [report] - optional state reporter
 * @returns {{ stop: () => void, getState: () => 'up'|'down'|'unknown' }}
 */
function startGraphDBHealthProbe(
  runSelect,
  ns = 'graphdb:probe',
  intervalMs = Number(process.env.GRAPHDB_HEALTH_INTERVAL_MS || 5000),
  report
) {
  const log = makeLogger(ns);
  /** @type {'up'|'down'|'unknown'} */
  let state = 'unknown';

  async function probe() {
    try {
      await runSelect('ASK {}');
      if (state !== 'up') {
        state = 'up';
        log.info('GraphDB is UP (reachable again)');
        if (typeof report === 'function') report(state);
      }
    } catch (err) {
      const msg = String(err?.message || err);
      if (state !== 'down') {
        state = 'down';
        log.warn('GraphDB is DOWN (unreachable)', msg);
        if (typeof report === 'function') report(state);
      }
    }
  }

  // initial kick + interval
  void probe();
  const timer = setInterval(probe, intervalMs);

  return {
    stop: () => clearInterval(timer),
    getState: () => state,
  };
}

module.exports = startGraphDBHealthProbe;
