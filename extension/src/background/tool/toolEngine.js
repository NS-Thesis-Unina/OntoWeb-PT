import { io } from 'socket.io-client';

/**
 * **ToolEngine**
 *
 * Architectural Role:
 *   React UI
 *     → ToolReactController
 *       → background (ToolBackgroundController)
 *         → **ToolEngine** (this file)
 *           → Node.js Tool Server (REST + WebSocket)
 *
 * Responsibilities:
 *   - Perform ALL communication with the external Node.js Tool server
 *   - Handle REST requests:
 *        • /health
 *        • /http-requests/ingest-http
 *        • /techstack/analyze
 *        • /analyzer/analyze
 *        • /{queue}/results/:jobId
 *   - Manage the WebSocket (Socket.io) connection
 *   - Notify health subscribers and job event subscribers
 *   - Manage job room subscriptions (subscribe-job, unsubscribe-job)
 *   - Handle polling timers for health status
 *
 * Notes:
 *   - This is a **background-only engine**, never used directly by React.
 *   - Heavy logic (fetching, socket mgmt) is placed here.
 *   - BackgroundController simply delegates operations.
 */
class ToolEngine {
  constructor() {
    // Base server URL from extension env variables
    this.serverUrl = `http://${import.meta.env.EXTENSION_PUBLIC_SERVER_HOST}` || 'http://localhost';

    // Cached last-known health state
    this.status = {
      ok: false,
      components: { server: 'down', redis: 'down', graphdb: 'down' },
    };

    // Subscribers for:
    //   - health updates
    //   - job-lifecycle events (completed/failed)
    this.subscribers = new Set();
    this.jobSubscribers = new Set();

    // Socket.io client
    this.socket = null;
    this._socketInitStarted = false;

    // Track subscribed jobs for automatic rejoin after reconnect
    this._joinedJobs = new Set();

    // Polling timer ID
    this._pollTimer = null;
  }

  // ============================================================================
  //                            Health Subscription
  // ============================================================================

  /** Register a subscriber for health updates. */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /** Notify all health subscribers. */
  _notifyAll(status) {
    for (const cb of this.subscribers) {
      try {
        cb(status);
      } catch {
        /* ignore subscriber errors */
      }
    }
  }

  // ============================================================================
  //                         Job Event Subscription
  // ============================================================================

  /** Register a subscriber for job events (completed/failed). */
  subscribeJobs(callback) {
    this.jobSubscribers.add(callback);
    return () => this.jobSubscribers.delete(callback);
  }

  /** Notify all job-event subscribers. */
  _notifyJob(evt) {
    for (const cb of this.jobSubscribers) {
      try {
        cb(evt);
      } catch {
        /* ignore */
      }
    }
  }

  // ============================================================================
  //                           Health Check (REST)
  // ============================================================================

  /** Return whatever state we have cached. */
  getCachedStatus() {
    return this.status;
  }

  /**
   * Perform GET /health.
   * Updates cached status and notifies subscribers.
   */
  async checkHealth() {
    try {
      const res = await fetch(`${this.serverUrl}/health`);
      if (!res.ok) throw new Error('Health check failed');

      const data = await res.json();
      this.status = data;
      this._notifyAll(data);
      return data;
    } catch {
      // Server unreachable fallback
      const down = {
        ok: false,
        components: { server: 'down', redis: 'down', graphdb: 'down' },
      };
      this.status = down;
      this._notifyAll(down);
      return down;
    }
  }

  // ============================================================================
  //                             Health Polling
  // ============================================================================

  /**
   * Start polling the /health endpoint periodically.
   */
  startPolling(intervalMs = 15000) {
    if (this._pollTimer) return;

    // Immediately run one check, then schedule interval
    this.checkHealth();
    this._pollTimer = setInterval(() => this.checkHealth(), intervalMs);
  }

  /** Stop polling entirely. */
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // ============================================================================
  //           REST Operations — HTTP ingest / Analyzer / TechStack
  // ============================================================================

  /**
   * POST /http-requests/ingest-http
   * Used by Interceptor to push HTTP payloads to the tool server.
   */
  async ingestHttp(payload) {
    if (payload == null) throw new Error('Missing payload');

    const ctrl = new AbortController();
    const timeout = Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000);
    const timeoutId = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(`${this.serverUrl}/http-requests/ingest-http`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`ingest-http failed (${res.status})`);

      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * POST /techstack/analyze
   */
  async analyzeTechstack(payload) {
    if (payload == null) throw new Error('Missing payload');

    const ctrl = new AbortController();
    const timeout = Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000);
    const timeoutId = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(`${this.serverUrl}/techstack/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`techstack/analyze failed (${res.status})`);

      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * POST /analyzer/analyze
   * For HTML+JS one-time scan of Analyzer tool.
   */
  async analyzeOneTimeScan(payload) {
    if (payload == null) throw new Error('Missing payload');

    const ctrl = new AbortController();
    const timeout = Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000);
    const timeoutId = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(`${this.serverUrl}/analyzer/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`analyzer/analyze failed (${res.status})`);

      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================================================
  //                          REST Fallback Job Lookup
  // ============================================================================

  /**
   * GET /{queue}/results/:jobId
   * REST fallback in case WS events were missed.
   */
  async fetchJobResult(queue, jobId) {
    const q = String(queue).toLowerCase();
    const id = encodeURIComponent(String(jobId));
    if (!id) throw new Error('Missing jobId');

    // Determine correct endpoint path
    let path;
    switch (q) {
      case 'http':
        path = '/http-requests/results';
        break;
      case 'analyzer':
        path = '/analyzer/results';
        break;
      case 'techstack':
        path = '/techstack/results';
        break;
      default:
        throw new Error(`Unsupported queue: ${queue}`);
    }

    const ctrl = new AbortController();
    const timeout = Number(import.meta.env.EXTENSION_PUBLIC_REQUESTS_ABORT_MS || 30000);
    const timeoutId = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(`${this.serverUrl}${path}/${id}`, {
        method: 'GET',
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`job results failed (${res.status})`);

      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================================================
  //                     Socket.io (WebSocket) Handling
  // ============================================================================

  /**
   * Ensure socket.io has been initialized and is connected.
   * Lazy initialization: created only when needed.
   */
  async ensureSocketConnected() {
    if (this.socket?.connected) return;

    if (!this._socketInitStarted) {
      this._socketInitStarted = true;
      this._connectSocket();
    }

    // Wait for connection or time out safely
    await new Promise((resolve) => {
      if (this.socket?.connected) return resolve();

      const onConnect = () => {
        this.socket.off('connect', onConnect);
        resolve();
      };

      try {
        this.socket.on('connect', onConnect);
      } catch {}

      const timeout = Number(
        import.meta.env.EXTENSION_PUBLIC_ENSURE_SOCKET_CONNECTED_TIMEOUT || 1500
      );
      setTimeout(resolve, timeout);
    });
  }

  /**
   * Initialize socket.io client and event listeners.
   */
  _connectSocket() {
    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      withCredentials: false,
      timeout: Number(import.meta.env.EXTENSION_PUBLIC_CONNECT_SOCKET_TIMEOUT || 5000),
    });

    // On connect: rejoin all subscribed job rooms
    this.socket.on('connect', () => {
      try {
        console.info('[tool] socket connected', this.socket.id);
      } catch {}

      for (const jobId of this._joinedJobs) {
        try {
          this.socket.emit('subscribe-job', jobId);
        } catch {}
      }
    });

    this.socket.on('disconnect', (reason) => {
      try {
        console.info('[tool] socket disconnected:', reason);
      } catch {}
    });

    this.socket.on('connect_error', (err) => {
      try {
        console.warn('[tool] socket connect_error:', err?.message);
      } catch {}
    });

    // Forward job completion events
    this.socket.on('completed', (payload) => {
      this._notifyJob({ event: 'completed', ...payload });
    });

    // Forward job failure events
    this.socket.on('failed', (payload) => {
      this._notifyJob({ event: 'failed', ...payload });
    });
  }

  // ============================================================================
  //                           Job Room Management
  // ============================================================================

  /**
   * Subscribe this engine to jobId events via socket.io room.
   */
  async subscribeJob(jobId) {
    const id = String(jobId);
    if (!id) throw new Error('Missing jobId');

    await this.ensureSocketConnected();
    this._joinedJobs.add(id);

    try {
      this.socket.emit('subscribe-job', id);
    } catch (err) {
      throw err;
    }
  }

  /**
   * Unsubscribe from job room.
   */
  async unsubscribeJob(jobId) {
    const id = String(jobId);
    if (!id) throw new Error('Missing jobId');

    this._joinedJobs.delete(id);

    try {
      this.socket.emit('unsubscribe-job', id);
    } catch {
      /* ignore socket failures */
    }
  }
}

export default ToolEngine;
