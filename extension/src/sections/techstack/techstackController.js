import browser from "webextension-polyfill";

class TechStackReactController {
  constructor() {
    this.subscribers = new Set();
    this._initMessageListenerOnce();
  }

  _initMessageListenerOnce() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;

    browser.runtime.onMessage.addListener((message) => {
      for (const sub of this.subscribers) {
        switch (message.type) {
          case "techstack_scanComplete":
            sub.onScanComplete?.(message.data);
            break;
          case "techstack_reloadRequired":
            sub.onReloadRequired?.(message.data);
            break;
          case "techstack_scanError":
            sub.onScanError?.(message.message);
            break;
          default:
            break;
        }
      }
    });
  }

  onMessage(callbacks) {
    this.subscribers.add(callbacks);
    return () => this.subscribers.delete(callbacks);
  }

  sendStartOneTimeStackScan(tabId) {
    browser.runtime.sendMessage({ type: "techstack_startOneTimeScan", tabId });
  }

  async getCurrentTabId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }
}

const techStackReactController = new TechStackReactController();
export default techStackReactController;
