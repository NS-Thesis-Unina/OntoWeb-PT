/**
 * Socket Service
 *
 * Manages a single Socket.IO connection for job lifecycle events.
 * Selects the socket base URL from:
 *  1) VITE_SOCKETS_URL (explicit override)
 *  2) httpClient.defaults.baseURL (HTTP client base)
 *  3) window.location.origin (current origin)
 *
 * Exposed API:
 * - subscribeJob(jobId): join a server-side room/stream for a job.
 * - unsubscribeJob(jobId): leave the room/stream.
 * - onJobEvent(handler): listen for job "completed" / "failed" notifications.
 *   Returns an unsubscribe function to remove listeners.
 */

import { io } from 'socket.io-client';
import httpClient from './httpClient';

let socket = null;

/**
 * Resolve the base URL for sockets, honoring env overrides.
 * @returns {string} An HTTP(S) origin to be converted to WS(S).
 */
function getBaseUrl() {
  if (import.meta.env.VITE_SOCKETS_URL) {
    return import.meta.env.VITE_SOCKETS_URL;
  }

  if (httpClient.defaults?.baseURL) {
    return httpClient.defaults.baseURL;
  }

  return window.location.origin;
}

/**
 * Lazily create and cache a Socket.IO client instance.
 * Forces the "websocket" transport for predictability in strict environments.
 * @returns {import('socket.io-client').Socket}
 */
function getSocket() {
  if (socket) return socket;

  const base = getBaseUrl();
  // Convert http(s) -> ws(s) to build the socket endpoint.
  const url = base.replace(/^http/, 'ws');

  socket = io(url, {
    transports: ['websocket'],
  });

  return socket;
}

/**
 * Subscribe to a specific job's server-side stream/room.
 *
 * @param {string|number} jobId - Identifier of the job to follow.
 * @returns {Promise<{ok: boolean}>} Simple OK acknowledgement.
 */
export async function subscribeJob(jobId) {
  const s = getSocket();
  s.emit('subscribe-job', String(jobId));
  return { ok: true };
}

/**
 * Unsubscribe from a job's stream/room.
 *
 * @param {string|number} jobId - Identifier of the job to stop following.
 * @returns {Promise<{ok: boolean}>} Simple OK acknowledgement.
 */
export async function unsubscribeJob(jobId) {
  const s = getSocket();
  s.emit('unsubscribe-job', String(jobId));
  return { ok: true };
}

/**
 * Listen for job lifecycle events.
 * The provided handler is invoked with a normalized payload:
 *   { event: 'completed' | 'failed', ...serverPayload }
 *
 * @param {(payload: {event: 'completed'|'failed', [key: string]: any}) => void} handler
 * @returns {() => void} Call to remove the listeners.
 */
export function onJobEvent(handler) {
  const s = getSocket();

  const handleCompleted = (payload) => {
    handler({ event: 'completed', ...payload });
  };

  const handleFailed = (payload) => {
    handler({ event: 'failed', ...payload });
  };

  s.on('completed', handleCompleted);
  s.on('failed', handleFailed);

  // Cleanup callback: detach both listeners
  return () => {
    s.off('completed', handleCompleted);
    s.off('failed', handleFailed);
  };
}
