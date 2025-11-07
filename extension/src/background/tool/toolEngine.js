class ToolEngine {
  constructor() {
    this.serverUrl = "http://localhost";
    this.status = {
      ok: false,
      components: { server: "down", redis: "down", graphdb: "down" },
    };
    this.subscribers = new Set();
    this._pollTimer = null;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  _notifyAll(status) {
    for (const cb of this.subscribers) cb(status);
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
    const t = setTimeout(() => ctrl.abort(), 30000);

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
}

export default ToolEngine;
