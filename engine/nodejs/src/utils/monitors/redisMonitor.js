// @ts-check

// redisMonitor.js
const IORedis = require('ioredis').default;
const { makeLogger } = require('../logs/logger');

/**
 * Start a lightweight Redis connection just for health logging.
 * Logs only state transitions and meaningful events.
 *
 * @param {object} connectionOpts - same shape you pass to BullMQ/ioredis
 * @param {string} ns - logger namespace (e.g. "redis:api" | "redis:worker")
 * @returns {() => void} stop function
 */
function startRedisMonitor(connectionOpts, ns = 'redis:monitor') {
  const log = makeLogger(ns);
  // Cloniamo l'oggetto per evitare side-effects se qualcuno lo muta.
  const opts = { ...connectionOpts };

  const redis = new IORedis(opts);
  let wasReady = false;
  let reconnectAttempts = 0;

  redis.on('connect', () => {
    // 'connect' precede 'ready' (socket aperto ma non per forza pronto a comandare)
    log.debug('Connecting to Redis socket...');
  });

  redis.on('ready', () => {
    const first = !wasReady;
    wasReady = true;
    reconnectAttempts = 0;
    log.info(first ? 'Redis READY (connected)' : 'Redis RECONNECTED (ready)');
  });

  // ioredis emette 'reconnecting' con un singolo argomento: delay (ms) fino al prossimo tentativo
  redis.on('reconnecting', (delayMs) => {
    reconnectAttempts += 1;
    log.warn(`Reconnecting... attempt=${reconnectAttempts} delay=${Number(delayMs) || 0}ms`);
  });

  // 'end' = connessione chiusa; dopo questo partiranno i 'reconnecting'
  redis.on('end', () => {
    if (wasReady) log.warn('Redis DISCONNECTED');
    wasReady = false;
  });

  redis.on('error', (err) => {
    const msg = String(err?.message || err);
    // Rispetta QUIET_REDIS_ERRORS=1 per silenziare errori ultra-frequenti
    if (process.env.QUIET_REDIS_ERRORS === '1' && /ECONNREFUSED|getaddrinfo|ETIMEDOUT/i.test(msg)) return;
    log.warn('Redis error', msg);
  });

  // Opzionale: quando il server è in LOADING o simili
  redis.on('wait', () => {
    log.debug('Waiting for Redis to be ready...');
  });

  return () => redis.disconnect();
}

module.exports = startRedisMonitor;
