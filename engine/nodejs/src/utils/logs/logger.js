// @ts-check

/**
 * Minimal logger with:
 * - levels (error, warn, info, debug)
 * - namespaces (e.g., "api", "worker", "bull", "redis", "graphdb")
 * - pretty output in dev, JSON in prod
 * - rate-limit/coalescing of repeated messages within a time window
 * - log listeners for realtime streaming (e.g. via WebSocket)
 */

/** @typedef {import('../_types/logs/types').LogLevel} LogLevel */
/** @typedef {import('../_types/logs/types').LogFormat} LogFormat */
/** @typedef {import('../_types/logs/types').CoalesceState} CoalesceState */
/** @typedef {import('../_types/logs/types').Logger} Logger */

/**
 * Ordered list of supported log levels.
 *
 * The array ordering is significant:
 * index 0 is the most severe level (`error`), the last one the least severe (`debug`).
 *
 * It is used both as the canonical list of levels and for the `isLevel` type guard.
 *
 * @type {readonly LogLevel[]}
 */
const LEVELS = /** @type {const} */ (['error', 'warn', 'info', 'debug']);

/**
 * Numeric rank for each log level (lower means more important).
 *
 * This is used to decide whether a message should be emitted,
 * based on the currently configured `LOG_LEVEL`.
 *
 * @type {Record<LogLevel, number>}
 */
const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * Effective output format, resolved from environment variables.
 *
 * - `LOG_FORMAT=json` → JSON logs
 * - otherwise:
 *   - `NODE_ENV=production` → JSON
 *   - any other env → pretty (human-readable)
 *
 * @type {LogFormat}
 */
const LOG_FORMAT =
  (
    process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty')
  ).toLowerCase() === 'json'
    ? 'json'
    : 'pretty';

/**
 * Raw log level as provided by the environment (string).
 *
 * Normalized to lowercase; validation happens in `normalizeLevel`.
 *
 * @type {string}
 */
const LOG_LEVEL_RAW = String(process.env.LOG_LEVEL || 'info').toLowerCase();

/**
 * Type guard: check whether a string is a valid `LogLevel`.
 *
 * This is used to turn arbitrary env strings into a typed `LogLevel`
 * while keeping a narrow union type for consumers.
 *
 * @param {string} x - Untrusted string input (e.g. from env).
 * @returns {x is LogLevel} `true` if `x` is one of the supported levels.
 */
function isLevel(x) {
  // @ts-ignore - includes works against the readonly literal tuple
  return LEVELS.includes(/** @type {any} */ x);
}

/**
 * Normalize an env-provided level string to a valid `LogLevel`.
 *
 * If the provided value is not recognized, it falls back to `'info'`.
 *
 * @param {string} raw - Raw level string (e.g. from `LOG_LEVEL` env).
 * @returns {LogLevel} A valid log level literal.
 */
function normalizeLevel(raw) {
  const x = String(raw || '').toLowerCase();
  return /** @type {LogLevel} */ (isLevel(x) ? x : 'info');
}

/**
 * Final effective log level, after normalization and validation.
 *
 * This is the threshold used by the logger to decide whether
 * a message should be emitted or ignored.
 *
 * @type {LogLevel}
 */
const LOG_LEVEL = normalizeLevel(LOG_LEVEL_RAW);

/**
 * Numeric threshold for printing logs.
 *
 * Any log with `LEVEL_RANK[level] > enabledRank` will be discarded.
 *
 * @type {number}
 */
const enabledRank = LEVEL_RANK[LOG_LEVEL];

/**
 * Cache for coalescing repeated messages.
 *
 * The map key encodes:
 * - namespace
 * - level
 * - normalized textual payload
 *
 * Each entry tracks how many times an identical message occurred within
 * the coalescing window, and holds a timeout to emit the final summary.
 *
 * @type {Map<string, CoalesceState>}
 */
const lastMsg = new Map();

/**
 * Coalescing window in milliseconds.
 *
 * Repeated messages with the same (ns, level, payload) that occur within
 * this window will be collapsed into a single log plus a concluding
 * `(repeated xN)` message.
 */
const WINDOW_MS = Number(process.env.LOG_COALESCE_WINDOW_MS || 3000);

/* ========================================================================= */
/* Realtime log listeners                                                 */
/* ========================================================================= */

/**
 * Canonical log entry shape as seen by realtime listeners.
 *
 * This is the same structure that is serialized in JSON mode, and it is
 * emitted *after* coalescing has been applied.
 *
 * @typedef {{ ts: string, level: LogLevel, ns: string, msg: any }} LogEntry
 */

/**
 * Set of active log listeners.
 *
 * Each listener is called with the final `LogEntry` payload for every
 * emitted log message (after coalescing), allowing e.g. WebSocket
 * streaming of logs to a dashboard.
 *
 * @type {Set<(entry: LogEntry) => void>}
 */
const logListeners = new Set();

/**
 * Register a listener that will be called for every emitted log.
 *
 * The listener receives the same payload that ends up in the console
 * or JSON output, *after* coalescing has taken place.
 *
 * @param {(entry: LogEntry) => void} fn - Callback invoked on each log.
 * @returns {() => void} Unsubscribe function that removes the listener.
 *
 * @example
 * const unsubscribe = onLog((entry) => {
 *   // send entry over WebSocket, push to in-memory buffer, etc.
 * });
 *
 * // Later:
 * unsubscribe();
 */
function onLog(fn) {
  if (typeof fn !== 'function') return () => {};
  logListeners.add(fn);
  return () => logListeners.delete(fn);
}

/**
 * Notify all registered listeners of a newly emitted log entry.
 *
 * Each listener is called in a `try/catch` to avoid a buggy subscriber
 * breaking the logger itself.
 *
 * @param {LogEntry} entry - Log payload to broadcast.
 */
function notifyLogListeners(entry) {
  for (const fn of logListeners) {
    try {
      fn(entry);
    } catch {
      // Do not let a failing listener break the logger.
    }
  }
}

/* ========================================================================= */
/* Low-level emitter                                                         */
/* ========================================================================= */

/**
 * Low-level emitter responsible for formatting and printing a log entry.
 *
 * Responsibilities:
 * - normalize `args` into a `msg` payload (flattening `Error` objects)
 * - build a canonical `LogEntry`
 * - print either JSON or pretty logs to stdout/stderr
 * - broadcast the structured entry to realtime listeners
 *
 * This function does **not** implement coalescing; it is only called
 * by the higher-level `log` function once a message has been accepted.
 *
 * @param {string} ns - Namespace (e.g. `"api"`, `"worker"`, `"graphdb"`).
 * @param {LogLevel} level - Log level for this message.
 * @param {string} timeIso - ISO-8601 timestamp string.
 * @param {unknown[]} args - Raw arguments passed by the caller.
 */
function emit(ns, level, timeIso, args) {
  // Canonical message payload sent both to console and listeners.
  let msg;

  if (args.length === 1) {
    const a = args[0];
    msg = a instanceof Error ? { err: a.message, stack: a.stack } : a;
  } else {
    msg = args.map((a) => (a instanceof Error ? { err: a.message, stack: a.stack } : a));
  }

  /** @type {LogEntry} */
  const payload = {
    ts: timeIso,
    level,
    ns,
    msg,
  };

  if (LOG_FORMAT === 'json') {
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(
      JSON.stringify(payload)
    );
  } else {
    const tag = level.toUpperCase().padEnd(5);
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(
      `[${timeIso}] ${tag} ${ns} —`,
      ...args.map((a) =>
        a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)
      )
    );
  }

  // Also forward the structured log to all listeners (e.g. /logs WebSocket).
  notifyLogListeners(payload);
}

/* ========================================================================= */
/* High-level log with coalescing                                            */
/* ========================================================================= */

/**
 * High-level logging function with level filtering and coalescing.
 *
 * Behaviour:
 * - drops messages below the configured `LOG_LEVEL`
 * - groups repeated messages (same ns, level, stringified args) occurring
 *   within `WINDOW_MS` into:
 *   - the first full log
 *   - a trailing `(repeated xN)` summary after the window elapses
 *
 * This keeps noisy logs (e.g. tight loops, flaky services) readable while
 * still preserving information about repetition.
 *
 * @param {string} ns - Namespace (e.g. `"api"`, `"worker"`, `"redis"`).
 * @param {LogLevel} level - Log level of this entry.
 * @param {...unknown} args - Arbitrary payload to log.
 */
function log(ns, level, ...args) {
  if (LEVEL_RANK[level] > enabledRank) return;

  const time = new Date().toISOString();

  // Coalescing key: ns + level + stringified payload.
  const text = args
    .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' | ');
  const key = `${ns}|${level}|${text}`;
  const prev = lastMsg.get(key);

  if (!prev) {
    // First time we see this combination within the window: emit immediately
    // and start a timer to potentially flush the repetition summary later.
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
    // Message already seen within the coalescing window: just bump the count.
    prev.count++;
  }
}

/**
 * Create a namespaced logger.
 *
 * Returns an object with `error`, `warn`, `info`, and `debug` methods,
 * each of which will:
 * - prepend the given namespace
 * - apply level filtering and coalescing
 * - emit to console and realtime listeners
 *
 * @param {string} ns - Namespace (e.g. `"api"`, `"worker"`, `"graphdb"`).
 * @returns {Logger} Namespaced logger with level-specific methods.
 *
 * @example
 * const log = makeLogger('api');
 *
 * log.info('Server started', { port: 3000 });
 * log.error(new Error('Boom'));
 */
const makeLogger = (ns) => ({
  error: (...a) => log(ns, 'error', ...a),
  warn: (...a) => log(ns, 'warn', ...a),
  info: (...a) => log(ns, 'info', ...a),
  debug: (...a) => log(ns, 'debug', ...a),
});

module.exports = { makeLogger, onLog };
