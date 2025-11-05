import browser from "webextension-polyfill";

const toolReactController = {
  async getHealth() {
    try {
      return await browser.runtime.sendMessage({ type: "tool_getHealth" });
    } catch {
      return { ok: false, components: { server: "down", redis: "down", graphdb: "down" } };
    }
  },

  async getCachedHealth() {
    try {
      return await browser.runtime.sendMessage({ type: "tool_getCachedHealth" });
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
