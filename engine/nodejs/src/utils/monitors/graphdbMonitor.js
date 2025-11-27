// @ts-check

const { makeLogger } = require('../logs/logger');

/** @typedef {import('../_types/monitors/types').GraphDBHealthState} GraphDBHealthState */
/** @typedef {import('../_types/monitors/types').GraphDBRunSelectFn} GraphDBRunSelectFn */
/** @typedef {import('../_types/monitors/types').GraphDBStateReporter} GraphDBStateReporter */
/** @typedef {import('../_types/monitors/types').GraphDBProbeHandle} GraphDBProbeHandle */

/**
 * Start a periodic GraphDB health probe based on `ASK {}`.
 *
 * Behavior:
 * - Periodically executes `runSelect("ASK {}")`.
 * - Tracks internal state: 'unknown' → 'up' or 'down'.
 * - Logs transitions (DOWN → UP, UP → DOWN).
 * - Optionally reports state changes to a callback (e.g. for central health aggregation).
 *
 * @param {GraphDBRunSelectFn} runSelect - Function used to run SPARQL SELECT/ASK against GraphDB.
 * @param {string} [ns='graphdb:probe'] - Logger namespace.
 * @param {number} [intervalMs=Number(process.env.GRAPHDB_HEALTH_INTERVAL_MS || 5000)] - Probe interval in milliseconds.
 * @param {GraphDBStateReporter} [report] - Optional state reporter invoked on transitions.
 * @returns {GraphDBProbeHandle} Handle with `stop()` and `getState()` helpers.
 */
function startGraphDBHealthProbe(
  runSelect,
  ns = 'graphdb:probe',
  intervalMs = Number(process.env.GRAPHDB_HEALTH_INTERVAL_MS || 5000),
  report
) {
  const log = makeLogger(ns);
  /** @type {GraphDBHealthState} */
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

  // Initial kick + periodic interval
  void probe();
  const timer = setInterval(probe, intervalMs);

  return {
    stop: () => clearInterval(timer),
    getState: () => state,
  };
}

module.exports = startGraphDBHealthProbe;
