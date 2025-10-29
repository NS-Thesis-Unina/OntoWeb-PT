// @ts-check

// Socket.IO client helpers (CommonJS)
const { io } = require('socket.io-client');

/**
 * Base URL for Socket.IO connection (behind Nginx).
 * Overridable via env TEST_API_BASE.
 * @type {string}
 */
const SOCKET_BASE = process.env.TEST_API_BASE || 'http://localhost';

/**
 * Create a Socket.IO connection to the API base.
 * WebSocket-only transport and short reconnection windows are used to fail fast in tests.
 * @returns {import('socket.io-client').Socket} Connected Socket instance (async connect).
 */
function connectSocket() {
  const socket = io(SOCKET_BASE, {
    transports: ['websocket'],
    timeout: 10000,
    reconnectionAttempts: 3
  });
  return socket;
}

/**
 * Subscribe to job updates for a specific `jobId`, matching server's contract:
 *   socket.on('subscribe-job', (jobId) => socket.join(`job:${jobId}`))
 *
 * The helper listens to: 'progress', 'completed', 'failed'.
 *
 * @param {import('socket.io-client').Socket} socket Connected socket.
 * @param {string|number} jobId Target job id.
 * @param {number} [timeoutMs=60000] Max wait for completion or failure.
 * @returns {{
 *   events: Array<{ name: string, payload: any, ts: number }>,
 *   waitForDone: Promise<{ ok: boolean, payload: any }>,
 *   cleanup: () => void
 * }}
 */
function subscribeToJob(socket, jobId, timeoutMs = 60000) {
  // Subscribe with the exact event name and data shape used by the server
  try {
    socket.emit('subscribe-job', jobId);
  } catch (_) {
    // ignore
  }

  /** @type {Array<'progress'|'completed'|'failed'>} */
  const names = ['progress', 'completed', 'failed'];

  /** @type {Array<{ name: string, payload: any, ts: number }>} */
  const events = [];

  /** @type {{ ok: boolean, payload: any } | null} */
  let done = null;

  /**
   * @param {boolean} ok
   * @param {any} payload
   */
  const finalize = (ok, payload) => {
    if (done) return;
    done = { ok, payload };
  };

  /**
   * @param {string} name
   */
  const onAny = (name) => (payload) => {
    const ts = Date.now();
    const matches = payload && String(payload.jobId) === String(jobId);
    if (matches || name === 'completed' || name === 'failed') {
      events.push({ name, payload, ts });
    }
    if (name === 'completed') finalize(true, payload);
    if (name === 'failed') finalize(false, payload);
  };

  const listeners = names.map((n) => {
    const h = onAny(n);
    socket.on(n, h);
    return { n, h };
  });

  const waitForDone = new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error('timeout waiting for job status events'));
    }, timeoutMs);

    const check = setInterval(() => {
      if (done) {
        clearTimeout(t);
        clearInterval(check);
        resolve(done);
      }
    }, 100);
  });

  const cleanup = () => {
    listeners.forEach(({ n, h }) => socket.off(n, h));
  };

  return { events, waitForDone, cleanup };
}

module.exports = { connectSocket, subscribeToJob, SOCKET_BASE };
