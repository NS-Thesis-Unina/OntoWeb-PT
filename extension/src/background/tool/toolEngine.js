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

  getCachedStatus() {
    return this.status;
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
}

export default ToolEngine;
