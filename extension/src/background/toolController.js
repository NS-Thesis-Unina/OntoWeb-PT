import browser from "webextension-polyfill";
import ToolEngine from "./tool/toolEngine.js";

class ToolBackgroundController {
  constructor() {
    this.engine = new ToolEngine();
    this._unsub = this.engine.subscribe((status) => {
      browser.runtime.sendMessage({ type: "tool_update", payload: status }).catch(() => {});
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
          return true;
        }
        default:
          break;
      }
    });
  }
}

export default ToolBackgroundController;
