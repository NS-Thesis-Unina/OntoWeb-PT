import browser from "webextension-polyfill";

const toolReactController = {
  async getHealth() {
    try {
      console.log("React Tool Send message")
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

  onMessage(handlers = {}) {
    const listener = (message) => {
      if (message.type === "tool_update") {
        handlers.onToolUpdate?.(message.payload);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  },
};

export default toolReactController;
