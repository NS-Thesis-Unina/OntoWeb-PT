import { io } from "socket.io-client";

class ToolEngine {
  constructor() {
    this.serverUrl = `http://${import.meta.env.EXTENSION_PUBLIC_SERVER_HOST}` || "http://localhost";
    this.status = {
      ok: false,
      components: { server: "down", redis: "down", graphdb: "down" },
    };
    this.subscribers = new Set();
    this.jobSubscribers = new Set();
    this.socket = null;
    this._socketInitStarted = false;
    this._joinedJobs = new Set();

    this._pollTimer = null;
  }

  // ----------------- Health subscribers -----------------
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  _notifyAll(status) {
    for (const cb of this.subscribers) cb(status);
  }

  // ----------------- Job event subscribers -----------------
  subscribeJobs(callback) {
    this.jobSubscribers.add(callback);
    return () => this.jobSubscribers.delete(callback);
  }
  _notifyJob(evt) {
    for (const cb of this.jobSubscribers) {
      try { cb(evt); } catch { /* ignore */ }
    }
  }

  getCachedStatus() {
    return this.status;
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.serverUrl}/health`, { method: "GET" });
      if (!res.ok) throw new Error("Health check failed");
      const data = await res.json();

      this.status = data;
      this._notifyAll(data);
      return data;
    } catch (err) {
      const down = {
        ok: false,
        components: { server: "down", redis: "down", graphdb: "down" },
      };
      this.status = down;
      this._notifyAll(down);
      return down;
    }
  }

  startPolling(intervalMs = 15000) {
    if (this._pollTimer) return;
    this.checkHealth();
    this._pollTimer = setInterval(() => this.checkHealth(), intervalMs);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async ingestHttp(payload) {
    if (payload == null) throw new Error("Missing payload");

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000));

    try {
      const res = await fetch(`${this.serverUrl}/http-requests/ingest-http`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`ingest-http failed (${res.status}) ${text}`);
      }

      const data = await res.json();
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  /** Post a techstack snapshot to /techstack/analyze (enqueue a BullMQ job). */
  async analyzeTechstack(payload) {
    if (payload == null) throw new Error("Missing payload");

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000));

    try {
      const res = await fetch(`${this.serverUrl}/techstack/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`techstack/analyze failed (${res.status}) ${text}`);
      }

      const data = await res.json();
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  /** Post a one-time analyzer scan to /analyzer/analyze (enqueue a BullMQ job). */
  async analyzeOneTimeScan(payload) {
    if (payload == null) throw new Error("Missing payload");

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000));

    try {
      const res = await fetch(`${this.serverUrl}/analyzer/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`analyzer/analyze failed (${res.status}) ${text}`);
      }

      const data = await res.json();
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Ensure a socket connection exists (lazy connect).
   * Safe to call multiple times.
   */
  async ensureSocketConnected() {
    if (this.socket && this.socket.connected) return;
    if (!this._socketInitStarted) {
      this._socketInitStarted = true;
      this._connectSocket();
    }

    // Wait until connected or timeout (best-effort)
    await new Promise((resolve) => {
      const done = () => resolve();
      if (this.socket?.connected) return done();
      const onConnect = () => { this.socket?.off("connect", onConnect); done(); };
      try { this.socket?.on("connect", onConnect); } catch { /* ignore */ }
      setTimeout(done, Number(import.meta.env.EXTENSION_PUBLIC_ENSURE_SOCKET_CONNECTED_TIMEOUT || 1500)); // do not block forever
    });
  }

  /**
   * Internal connect routine: sets up event listeners and reconnection handling.
  */
  _connectSocket() {
    this.socket = io(this.serverUrl, {
      transports: ["websocket"],
      withCredentials: false,
      timeout: Number(import.meta.env.EXTENSION_PUBLIC_CONNECT_SOCKET_TIMEOUT || 5000),
    });

    this.socket.on("connect", () => {
      try { console.info("[tool] socket connected", this.socket.id); } catch {}
      for (const jobId of this._joinedJobs) {
        try { this.socket.emit("subscribe-job", jobId); } catch {}
      }
    });

    this.socket.on("disconnect", (reason) => {
      try { console.info("[tool] socket disconnected:", reason); } catch {}
    });

    this.socket.on("connect_error", (err) => {
      try { console.warn("[tool] socket connect_error:", err?.message || err); } catch {}
    });

    // Forward any job event to UI subscribers.
    // Server is expected to emit payloads like:
    //   { event: 'completed'|'failed', queue: 'http'|'sparql'|'techstack'|'analyzer', jobId, ... }
    this.socket.on("completed", (payload) => {
      const evt = { event: "completed", ...payload };
      this._notifyJob(evt);
    });
    this.socket.on("failed", (payload) => {
      const evt = { event: "failed", ...payload };
      this._notifyJob(evt);
    });
  }

  /**
   * Join a job room to receive 'completed'/'failed' events.
   * @param {string} jobId
   */
  async subscribeJob(jobId) {
    const id = String(jobId || "");
    if (!id) throw new Error("Missing jobId");
    await this.ensureSocketConnected();
    this._joinedJobs.add(id);
    try {
      this.socket?.emit("subscribe-job", id);
    } catch (e) {
      // If emit fails for any reason, keep the id so we can try again on next connect
      throw e;
    }
  }

  /**
   * Leave a previously joined job room.
   * @param {string} jobId
   */
  async unsubscribeJob(jobId) {
    const id = String(jobId || "");
    if (!id) throw new Error("Missing jobId");
    this._joinedJobs.delete(id);
    try {
      this.socket?.emit("unsubscribe-job", id);
    } catch { /* ignore */ }
  }
}

export default ToolEngine;
