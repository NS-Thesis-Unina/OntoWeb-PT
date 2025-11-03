import browser from "webextension-polyfill";
import InterceptorEngine from "./interceptor/interceptorEngine.js";

class InterceptorBackgroundController {
  constructor() {
    this.engine = new InterceptorEngine();
    this.initListener();
  }

  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        // Starts the interceptor and streams progress to the UI.
        case "interceptor_start": {
          this.engine.start({
            onUpdate: (totals) => {
              this.sendToReact({ type: "interceptor_update", totals });
            },
            onComplete: (payload) => {
              this.sendToReact({ type: "interceptor_complete", ...payload });
            }
          });
          break;
        }

        // Stops the interceptor and emits completion payload.
        case "interceptor_stop": {
          this.engine.stop().then((payload) => {
            this.sendToReact({ type: "interceptor_complete", ...payload });
          });
          break;
        }

        // Returns current capture status.
        case "interceptor_getStatus": {
          const s = this.engine.getStatus();
          sendResponse(s);
          return true;
        }

        // Returns the storage key of the latest run.
        case "interceptor_getLastKey": {
          this.engine.getLastResults().then(res => {
            sendResponse({ key: res?.key || null });
          });
          return true;
        }

        // Returns a meta-only listing of saved runs.
        case "interceptor_listRuns": {
          this.engine.getAllResultsMeta().then(items => sendResponse({ runs: items }));
          return true;
        }

        // Ingests a capture event from the content-script relay.
        case "interceptor_capture": {
          this.engine.ingestCapture(message.payload, sender);
          break;
        }

        default:
          break;
      }
    });
  }

  // Fan-out helper for UI messages; logs but never throws.
  sendToReact(msg) {
    browser.runtime.sendMessage(msg).catch(err => {
      console.error("[Interceptor/Background] sendMessage error:", err);
    });
  }
}

export default InterceptorBackgroundController;
