import browser from "webextension-polyfill";

class InterceptorReactController {
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
          case "interceptor_update":
            sub.onUpdate?.(message.totals);
            break;
          case "interceptor_complete":
            sub.onComplete?.(message);
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

  // --- Control: start / stop / status ---

  start(config) {
    return browser.runtime.sendMessage({ type: "interceptor_start", config });
  }

  stop() {
    return browser.runtime.sendMessage({ type: "interceptor_stop" });
  }

  getStatus() {
    return browser.runtime.sendMessage({ type: "interceptor_getStatus" });
  }

  // --- Archive helpers ---

  getLastKey() {
    return browser.runtime.sendMessage({ type: "interceptor_getLastKey" });
  }

  listRuns() {
    return browser.runtime.sendMessage({ type: "interceptor_listRuns" });
  }

  // --- Deletion API ---

  /**
   * Delete a single interceptor run by its key (interceptorRun_<timestamp>).
   * Throws if the run does not exist or cannot be deleted.
   */
  async deleteRunById(runKey) {
    const response = await browser.runtime.sendMessage({
      type: "interceptor_deleteRunById",
      runKey,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unable to delete interceptor run.");
    }

    return response.info;
  }

  /**
   * Delete all interceptor runs from local storage (including the last key).
   */
  async clearAllRuns() {
    const response = await browser.runtime.sendMessage({
      type: "interceptor_clearAllRuns",
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unable to clear interceptor runs.");
    }

    return response.info;
  }
}

const interceptorReactController = new InterceptorReactController();
export default interceptorReactController;
