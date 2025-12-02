import { io } from "socket.io-client";
import httpClient from "./httpClient";

let socket = null;

function getBaseUrl() {
  if (import.meta.env.VITE_SOCKETS_URL) {
    return import.meta.env.VITE_SOCKETS_URL;
  }

  if (httpClient.defaults?.baseURL) {
    return httpClient.defaults.baseURL;
  }

  return window.location.origin;
}

function getSocket() {
  if (socket) return socket;

  const base = getBaseUrl();
  const url = base.replace(/^http/, "ws");

  socket = io(url, {
    transports: ["websocket"],
  });

  return socket;
}

export async function subscribeJob(jobId) {
  const s = getSocket();
  s.emit("subscribe-job", String(jobId));
  return { ok: true };
}

export async function unsubscribeJob(jobId) {
  const s = getSocket();
  s.emit("unsubscribe-job", String(jobId));
  return { ok: true };
}

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
