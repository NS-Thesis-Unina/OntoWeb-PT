import browser from "webextension-polyfill";

const toolReactController = {
  async getHealth() {
    try {
      return await browser.runtime.sendMessage({ type: "tool_getHealth" });
    } catch {
      return { ok: false, components: { server: "down", redis: "down", graphdb: "down" } };
    }
  },

  async startPolling(intervalMs = 15000) {
    try {
      return await browser.runtime.sendMessage({ type: "tool_startPolling", intervalMs });
    } catch {
      return { ok: false };
    }
  },

  async stopPolling() {
    try {
      return await browser.runtime.sendMessage({ type: "tool_stopPolling" });
    } catch {
      return { ok: false };
    }
  },

  async ingestHttp(payload) {
    try {
      const res = await browser.runtime.sendMessage({ type: "tool_ingestHttp", payload });
      return res;
    } catch (err) {
      return { accepted: false, error: String(err?.message || err) };
    }
  },

  /** Submit a techstack snapshot for analysis (server will enqueue a BullMQ job). */
  async analyzeTechstack(payload) {
    try {
      const res = await browser.runtime.sendMessage({ type: "tool_analyzeTechstack", payload });
      return res;
    } catch (err) {
      return { accepted: false, error: String(err?.message || err) };
    }
  },

  /** Submit a one-time analyzer scan (HTML, scripts, forms, iframes) to /analyzer/analyze. */
  async analyzeOneTimeScan(payload) {
    try {
      const res = await browser.runtime.sendMessage({ type: "tool_analyzeAnalyzerOneTimeScan", payload });
      return res;
    } catch (err) {
      return { accepted: false, error: String(err?.message || err) };
    }
  },

  /** Ask background to subscribe this UI to a job's websocket room. */
  async subscribeJob(jobId) {
    try {
      return await browser.runtime.sendMessage({ type: "tool_subscribeJob", jobId: String(jobId) });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },

  /** Unsubscribe from a job room (optional cleanup). */
  async unsubscribeJob(jobId) {
    try {
      return await browser.runtime.sendMessage({ type: "tool_unsubscribeJob", jobId: String(jobId) });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },

  /**
   * UI event wiring.
   * - onToolUpdate(payload): health status updates
   * - onJobEvent(evt): worker job events coming from websocket
   */
  onMessage(handlers = {}) {
    const listener = (message) => {
      if (message.type === "tool_update") {
        handlers.onToolUpdate?.(message.payload);
      } else if (message.type === "tool_job_event") {
        handlers.onJobEvent?.(message.payload);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  },
};

export default toolReactController;
