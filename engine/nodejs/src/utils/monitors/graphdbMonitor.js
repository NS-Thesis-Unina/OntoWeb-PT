// @ts-check

const { makeLogger } = require('../logs/logger');

/**
 * Periodically pings GraphDB via runSelect("ASK {}") and logs state transitions.
 *
 * @param {(sparql: string) => Promise<any>} runSelect
 * @param {string} ns - logger namespace (e.g. "graphdb:api" | "graphdb:worker")
 * @param {number} intervalMs - probe interval (default 5000)
 * @returns {() => void} stop function
 */
function startGraphDBHealthProbe(runSelect, ns = 'graphdb:probe', intervalMs = Number(process.env.GRAPHDB_HEALTH_INTERVAL_MS || 5000)) {
  const log = makeLogger(ns);
  let state = 'unknown'; // 'up' | 'down' | 'unknown'

  async function probe() {
    try {
      await runSelect('ASK {}');
      if (state !== 'up') {
        log.info('GraphDB is UP (reachable again)');
        state = 'up';
      }
    } catch (err) {
      const msg = String(err?.message || err);
      if (state !== 'down') {
        log.warn('GraphDB is DOWN (unreachable)', msg);
        state = 'down';
      }
    }
  }

  // kick + interval
  probe();
  const timer = setInterval(probe, intervalMs);
  return () => clearInterval(timer);
}

module.exports = startGraphDBHealthProbe;
