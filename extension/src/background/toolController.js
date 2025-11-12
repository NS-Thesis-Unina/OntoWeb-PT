import browser from "webextension-polyfill";
import ToolEngine from "./tool/toolEngine.js";

class ToolBackgroundController {
  constructor() {
    this.engine = new ToolEngine();

    // Forward health updates to all views
    this._unsub = this.engine.subscribe((status) => {
      browser.runtime.sendMessage({ type: "tool_update", payload: status }).catch(() => {});
    });

    // Forward job events (from socket) to all views
    this._unsubJobs = this.engine.subscribeJobs((evt) => {
      browser.runtime.sendMessage({ type: "tool_job_event", payload: evt }).catch(() => {});
    });

    this.initListener();
  }

  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "tool_getHealth": {
          this.engine.checkHealth()
            .then((data) => sendResponse(data))
            .catch(() => sendResponse(this.engine.getCachedStatus?.() ?? this.engine.status));
          return true; // async
        }
        case "tool_startPolling": {
          const ms = Number(message.intervalMs) || 15000;
          this.engine.startPolling(ms);
          sendResponse({ ok: true });
          return true;
        }
        case "tool_stopPolling": {
          this.engine.stopPolling();
          sendResponse({ ok: true });
          return true;
        }

        case "tool_ingestHttp": {
          this.engine.ingestHttp(message.payload)
            .then((data) => sendResponse(data))
            .catch((err) => sendResponse({ accepted: false, error: String(err?.message || err) }));
          return true; // async
        }

        /** Route for techstack analysis API */
        case "tool_analyzeTechstack": {
          this.engine.analyzeTechstack(message.payload)
            .then((data) => sendResponse(data))
            .catch((err) => sendResponse({ accepted: false, error: String(err?.message || err) }));
          return true; // async
        }

        /** Socket-driven job subscriptions from the UI */
        case "tool_subscribeJob": {
          const jobId = String(message.jobId || "");
          if (!jobId) {
            sendResponse({ ok: false, error: "Missing jobId" });
            return true;
          }
          // Ensure sockets are connected, then subscribe to the room
          this.engine.ensureSocketConnected()
            .then(() => this.engine.subscribeJob(jobId))
            .then(() => sendResponse({ ok: true, jobId }))
            .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
          return true; // async
        }
        case "tool_unsubscribeJob": {
          const jobId = String(message.jobId || "");
          if (!jobId) {
            sendResponse({ ok: false, error: "Missing jobId" });
            return true;
          }
          this.engine.unsubscribeJob(jobId)
            .then(() => sendResponse({ ok: true, jobId }))
            .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
          return true; // async
        }

        default:
          break;
      }
    });
  }
}

export default ToolBackgroundController;
