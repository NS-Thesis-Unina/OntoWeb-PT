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

  start(config) {
    return browser.runtime.sendMessage({ type: "interceptor_start", config });
  }

  stop() {
    return browser.runtime.sendMessage({ type: "interceptor_stop" });
  }

  getStatus() {
    return browser.runtime.sendMessage({ type: "interceptor_getStatus" });
  }

  getLastKey() {
    return browser.runtime.sendMessage({ type: "interceptor_getLastKey" });
  }

  listRuns() {
    return browser.runtime.sendMessage({ type: "interceptor_listRuns" });
  }
}

const interceptorReactController = new InterceptorReactController();
export default interceptorReactController;
