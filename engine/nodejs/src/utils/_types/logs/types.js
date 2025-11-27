/**
 * Supported log levels.
 *
 * Order of severity (highest → lowest):
 * - 'error'
 * - 'warn'
 * - 'info'
 * - 'debug'
 *
 * @typedef {'error' | 'warn' | 'info' | 'debug'} LogLevel
 */

/**
 * Output format for log lines.
 *
 * - 'pretty' → human-readable, colored-ish output for development.
 * - 'json'   → structured JSON payload for production/log aggregation.
 *
 * @typedef {'pretty' | 'json'} LogFormat
 */

/**
 * Internal structure used to coalesce repeated messages.
 *
 * - `count`   → how many times the same message has been seen
 * - `timeout` → timer used to flush the aggregated "(repeated xN)" log
 *
 * @typedef {{ count: number, timeout: NodeJS.Timeout }} CoalesceState
 */

/**
 * Namespaced logger API.
 *
 * Each method logs at the corresponding level, e.g.:
 *   logger.error('something bad happened');
 *
 * @typedef {Object} Logger
 * @property {(...args: unknown[]) => void} error
 * @property {(...args: unknown[]) => void} warn
 * @property {(...args: unknown[]) => void} info
 * @property {(...args: unknown[]) => void} debug
 */

module.exports = {};
