import browser from 'webextension-polyfill';
import ToolEngine from './tool/toolEngine.js';

/**
 * **ToolBackgroundController**
 *
 * Background-side controller responsible for receiving commands from the
 * React UI and delegating operations to the ToolEngine. It also forwards
 * health updates and job events (via socket.io) back to all open UI views.
 *
 * Architectural Role:
 *   React UI → ToolReactController → background (this file) → ToolEngine → NodeJS/Socket.io
 *
 * Responsibilities:
 * - Expose tool health information
 * - Start/stop periodic health polling
 * - Ingest HTTP requests (proxy to Node tool)
 * - Trigger techstack/analyzer operations on external tool API
 * - Subscribe/unsubscribe to job streams (socket.io rooms)
 * - Fetch job results via REST (hybrid fallback)
 * - Broadcast health and job events to all frontend views
 *
 * This controller contains no business logic.
 * All real logic lives inside ToolEngine.
 */
class ToolBackgroundController {
  constructor() {
    this.engine = new ToolEngine();

    /** Forward health updates to all UIs. */
    this._unsub = this.engine.subscribe((status) => {
      browser.runtime.sendMessage({ type: 'tool_update', payload: status }).catch(() => {});
    });

    /** Forward job events from socket.io to all UIs. */
    this._unsubJobs = this.engine.subscribeJobs((evt) => {
      browser.runtime.sendMessage({ type: 'tool_job_event', payload: evt }).catch(() => {});
    });

    this.initListener();
  }

  /**
   * Attach the background listener used to receive commands from React.
   * Each message is mapped directly to a ToolEngine operation.
   */
  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        // ------------------------------------------------------
        // Health status & polling
        // ------------------------------------------------------
        case 'tool_getHealth': {
          this.engine
            .checkHealth()
            .then((data) => sendResponse(data))
            .catch(() => sendResponse(this.engine.getCachedStatus?.() ?? this.engine.status));
          return true;
        }

        case 'tool_startPolling': {
          this.engine.startPolling(Number(message.intervalMs) || 15000);
          sendResponse({ ok: true });
          return true;
        }

        case 'tool_stopPolling': {
          this.engine.stopPolling();
          sendResponse({ ok: true });
          return true;
        }

        // ------------------------------------------------------
        // HTTP ingestion
        // ------------------------------------------------------
        case 'tool_ingestHttp': {
          this.engine
            .ingestHttp(message.payload)
            .then((data) => sendResponse(data))
            .catch((err) =>
              sendResponse({
                accepted: false,
                error: String(err?.message || err),
              })
            );
          return true;
        }

        // ------------------------------------------------------
        // Techstack analysis
        // ------------------------------------------------------
        case 'tool_analyzeTechstack': {
          this.engine
            .analyzeTechstack(message.payload)
            .then((data) => sendResponse(data))
            .catch((err) =>
              sendResponse({
                accepted: false,
                error: String(err?.message || err),
              })
            );
          return true;
        }

        // ------------------------------------------------------
        // Analyzer one-time scan
        // ------------------------------------------------------
        case 'tool_analyzeAnalyzerOneTimeScan': {
          this.engine
            .analyzeOneTimeScan(message.payload)
            .then((data) => sendResponse(data))
            .catch((err) =>
              sendResponse({
                accepted: false,
                error: String(err?.message || err),
              })
            );
          return true;
        }

        // ------------------------------------------------------
        // Job room subscription (socket.io)
        // ------------------------------------------------------
        case 'tool_subscribeJob': {
          const jobId = String(message.jobId || '');
          if (!jobId) {
            sendResponse({ ok: false, error: 'Missing jobId' });
            return true;
          }

          this.engine
            .ensureSocketConnected()
            .then(() => this.engine.subscribeJob(jobId))
            .then(() => sendResponse({ ok: true, jobId }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: String(err?.message || err),
              })
            );
          return true;
        }

        case 'tool_unsubscribeJob': {
          const jobId = String(message.jobId || '');
          if (!jobId) {
            sendResponse({ ok: false, error: 'Missing jobId' });
            return true;
          }

          this.engine
            .unsubscribeJob(jobId)
            .then(() => sendResponse({ ok: true, jobId }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: String(err?.message || err),
              })
            );
          return true;
        }

        // ------------------------------------------------------
        // Hybrid REST fallback job result lookup
        // ------------------------------------------------------
        case 'tool_getJobResult': {
          const queue = message.queue;
          const jobId = String(message.jobId || '');

          if (!queue || !jobId) {
            sendResponse({ ok: false, error: 'Missing queue or jobId' });
            return true;
          }

          this.engine
            .fetchJobResult(queue, jobId)
            .then((data) => sendResponse({ ok: true, queue, jobId, data }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: String(err?.message || err),
              })
            );
          return true;
        }

        default:
          break;
      }
    });
  }
}

export default ToolBackgroundController;
