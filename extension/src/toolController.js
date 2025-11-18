import browser from 'webextension-polyfill';

/**
 * **ToolReactController**
 *
 * High-level controller used by React components to interact with the
 * Tool subsystem (external NodeJS Tool server).
 *
 * Architectural Role:
 *   React UI → ToolReactController
 *     → background (ToolBackgroundController)
 *       → ToolEngine → NodeJS (REST + websocket)
 *
 * Responsibilities:
 * - Trigger tool operations:
 *      • health checks
 *      • HTTP ingestion
 *      • techstack analysis
 *      • analyzer one-time scans
 * - Manage job subscriptions (subscribe/unsubscribe)
 * - Fetch job results using REST fallback
 * - Receive broadcasted background events:
 *      • tool_update        (health updates)
 *      • tool_job_event     (job lifecycle events)
 *
 * This controller contains NO heavy logic.
 * It only sends/receives messages to/from the background script.
 */
const toolReactController = {
  // ------------------------------------------------------------
  //  Health Operations
  // ------------------------------------------------------------

  /** Request health status of the external Node Tool server. */
  async getHealth() {
    try {
      return await browser.runtime.sendMessage({ type: 'tool_getHealth' });
    } catch {
      return {
        ok: false,
        components: { server: 'down', redis: 'down', graphdb: 'down' },
      };
    }
  },

  /** Begin periodic health polling inside the background controller. */
  async startPolling(intervalMs = 15000) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_startPolling',
        intervalMs,
      });
    } catch {
      return { ok: false };
    }
  },

  /** Stop background health polling. */
  async stopPolling() {
    try {
      return await browser.runtime.sendMessage({ type: 'tool_stopPolling' });
    } catch {
      return { ok: false };
    }
  },

  // ------------------------------------------------------------
  //  HTTP ingestion & Analysis Operations
  // ------------------------------------------------------------

  /** Send an HTTP request to Tool server (used by Interceptor flows). */
  async ingestHttp(payload) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_ingestHttp',
        payload,
      });
    } catch (err) {
      return { accepted: false, error: String(err?.message || err) };
    }
  },

  /** Submit a TechStack analysis job. */
  async analyzeTechstack(payload) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_analyzeTechstack',
        payload,
      });
    } catch (err) {
      return { accepted: false, error: String(err?.message || err) };
    }
  },

  /** Submit an Analyzer one-time scan job. */
  async analyzeOneTimeScan(payload) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_analyzeAnalyzerOneTimeScan',
        payload,
      });
    } catch (err) {
      return { accepted: false, error: String(err?.message || err) };
    }
  },

  // ------------------------------------------------------------
  //  Job Subscriptions (WebSocket Rooms)
  // ------------------------------------------------------------

  async subscribeJob(jobId) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_subscribeJob',
        jobId: String(jobId),
      });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },

  async unsubscribeJob(jobId) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_unsubscribeJob',
        jobId: String(jobId),
      });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },

  // ------------------------------------------------------------
  //  Hybrid Job Status (REST fallback)
  // ------------------------------------------------------------

  async getJobResult(queue, jobId) {
    try {
      return await browser.runtime.sendMessage({
        type: 'tool_getJobResult',
        queue,
        jobId: String(jobId),
      });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },

  // ------------------------------------------------------------
  //  Subscriptions to Background Events
  // ------------------------------------------------------------

  /**
   * Register UI callbacks to handle:
   *   - onToolUpdate(payload)
   *   - onJobEvent(payload)
   */
  onMessage(handlers = {}) {
    const listener = (message) => {
      if (message.type === 'tool_update') {
        handlers.onToolUpdate?.(message.payload);
      } else if (message.type === 'tool_job_event') {
        handlers.onJobEvent?.(message.payload);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  },
};

export default toolReactController;
