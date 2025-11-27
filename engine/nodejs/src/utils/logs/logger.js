// @ts-check

/**
 * Minimal logger with:
 * - levels (error, warn, info, debug)
 * - namespaces (e.g., "api", "worker", "bull", "redis", "graphdb")
 * - pretty output in dev, JSON in prod
 * - rate-limit/coalescing of repeated messages within a time window
 */

/** @typedef {import('../_types/logs/types').LogLevel} LogLevel */
/** @typedef {import('../_types/logs/types').LogFormat} LogFormat */
/** @typedef {import('../_types/logs/types').CoalesceState} CoalesceState */
/** @typedef {import('../_types/logs/types').Logger} Logger */

/** @type {readonly LogLevel[]} */
const LEVELS = /** @type {const} */ (['error', 'warn', 'info', 'debug']);

/** Rank per level (lower is more important). */
/** @type {Record<LogLevel, number>} */
const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };

/** Resolve output format from env with sensible defaults. */
/** @type {LogFormat} */
const LOG_FORMAT =
  ((process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty')).toLowerCase() === 'json')
    ? 'json'
    : 'pretty';

/** Raw level from env (string). */
/** @type {string} */
const LOG_LEVEL_RAW = String(process.env.LOG_LEVEL || 'info').toLowerCase();

/**
 * Type guard: string → LogLevel.
 *
 * @param {string} x
 * @returns {x is LogLevel}
 */
function isLevel(x) {
  // @ts-ignore - includes works against the readonly literal tuple
  return LEVELS.includes /** @type {any} */ (x);
}

/**
 * Normalize env-provided level to a valid LogLevel literal.
 * Falls back to 'info' when invalid.
 *
 * @param {string} raw
 * @returns {LogLevel}
 */
function normalizeLevel(raw) {
  const x = String(raw || '').toLowerCase();
  return /** @type {LogLevel} */ (isLevel(x) ? x : 'info');
}

/** Final effective log level. */
/** @type {LogLevel} */
const LOG_LEVEL = normalizeLevel(LOG_LEVEL_RAW);

/** Numeric threshold for printing. */
/** @type {number} */
const enabledRank = LEVEL_RANK[LOG_LEVEL];

/** Cache used to coalesce repeated messages. */
/** @type {Map<string, CoalesceState>} */
const lastMsg = new Map();

/** Coalescing window in milliseconds. */
const WINDOW_MS = Number(process.env.LOG_COALESCE_WINDOW_MS || 3000);

/**
 * Low-level emitter (pretty or json).
 *
 * @param {string} ns
 * @param {LogLevel} level
 * @param {string} timeIso
 * @param {unknown[]} args
 */
function emit(ns, level, timeIso, args) {
  if (LOG_FORMAT === 'json') {
    /** @type {any} */
    const payload = {
      ts: timeIso,
      level,
      ns,
      msg:
        args.length === 1
          ? (args[0] instanceof Error ? { err: args[0].message, stack: args[0].stack } : args[0])
          : args.map((a) => (a instanceof Error ? { err: a.message, stack: a.stack } : a)),
    };
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(
      JSON.stringify(payload)
    );
  } else {
    const tag = level.toUpperCase().padEnd(5);
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(
      `[${timeIso}] ${tag} ${ns} —`,
      ...args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
    );
  }
}

/**
 * High-level log with coalescing of repeated messages within WINDOW_MS.
 *
 * @param {string} ns
 * @param {LogLevel} level
 * @param {...unknown} args
 */
function log(ns, level, ...args) {
  if (LEVEL_RANK[level] > enabledRank) return;

  const time = new Date().toISOString();

  // Coalescing key: ns + level + stringified payload
  const text = args
    .map((a) =>
      a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)
    )
    .join(' | ');
  const key = `${ns}|${level}|${text}`;
  const prev = lastMsg.get(key);

  if (!prev) {
    emit(ns, level, time, args);
    const timeout = setTimeout(() => {
      const cur = lastMsg.get(key);
      if (cur && cur.count > 1) {
        emit(ns, level, new Date().toISOString(), [`(repeated x${cur.count - 1})`]);
      }
      lastMsg.delete(key);
    }, WINDOW_MS);
    lastMsg.set(key, { count: 1, timeout });
  } else {
    prev.count++;
  }
}

/**
 * Create a namespaced logger.
 *
 * @param {string} ns - Namespace (e.g. "api", "worker", "graphdb").
 * @returns {Logger} Namespaced logger with `error`, `warn`, `info`, `debug` methods.
 */
const makeLogger = (ns) => ({
  error: (...a) => log(ns, 'error', ...a),
  warn:  (...a) => log(ns, 'warn',  ...a),
  info:  (...a) => log(ns, 'info',  ...a),
  debug: (...a) => log(ns, 'debug', ...a),
});

module.exports = { makeLogger };
