// src/services/toolSocketService.js
import { io } from "socket.io-client";
import httpClient from "./httpClient";

let socket = null;

function getBaseUrl() {
  // URL esplicito per la socket, se lo vuoi configurare
  if (import.meta.env.VITE_SOCKETS_URL) {
    return import.meta.env.VITE_SOCKETS_URL;
  }

  // fallback: stessa origin di httpClient
  if (httpClient.defaults?.baseURL) {
    return httpClient.defaults.baseURL;
  }

  // ultimate fallback: origin della pagina
  return window.location.origin;
}

function getSocket() {
  if (socket) return socket;

  const base = getBaseUrl();
  // http:// -> ws://  |  https:// -> wss://
  const url = base.replace(/^http/, "ws");

  socket = io(url, {
    transports: ["websocket"],
  });

  return socket;
}

/**
 * Chiede al server di iscrivere la socket alla stanza job:<jobId>
 */
export async function subscribeJob(jobId) {
  const s = getSocket();
  s.emit("subscribe-job", String(jobId));
  return { ok: true };
}

/**
 * Chiede al server di disiscrivere la socket dalla stanza job:<jobId>
 */
export async function unsubscribeJob(jobId) {
  const s = getSocket();
  s.emit("unsubscribe-job", String(jobId));
  return { ok: true };
}

/**
 * Ascolta gli eventi BullMQ forwardati dal server:
 *   - 'completed'
 *   - 'failed'
 *
 * Ritorna una funzione di cleanup per deregistrare i listener.
 */
export function onJobEvent(handler) {
  const s = getSocket();

  const handleCompleted = (payload) => {
    handler({ event: "completed", ...payload });
  };

  const handleFailed = (payload) => {
    handler({ event: "failed", ...payload });
  };

  s.on("completed", handleCompleted);
  s.on("failed", handleFailed);

  return () => {
    s.off("completed", handleCompleted);
    s.off("failed", handleFailed);
  };
}
