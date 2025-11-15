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

        case "interceptor_start": {
          const cfg = message?.config || null;
          this.engine.start({
            config: cfg,
            onUpdate: (totals) => {
              this.sendToReact({ type: "interceptor_update", totals });
            },
            onComplete: (payload) => {
              this.sendToReact({ type: "interceptor_complete", ...payload });
            }
          });
          break;
        }

        case "interceptor_stop": {
          this.engine.stop().then((payload) => {
            this.sendToReact({ type: "interceptor_complete", ...payload });
          });
          break;
        }

        case "interceptor_getStatus": {
          const s = this.engine.getStatus();
          sendResponse(s);
          return true;
        }

        case "interceptor_getLastKey": {
          this.engine.getLastResults().then(res => {
            sendResponse({ key: res?.key || null });
          });
          return true;
        }

        case "interceptor_listRuns": {
          this.engine.getAllResultsMeta().then(items => sendResponse({ runs: items }));
          return true;
        }

        case "interceptor_capture": {
          this.engine.ingestCapture(message.payload, sender);
          break;
        }

        // --- Deletion: single run ---
        case "interceptor_deleteRunById": {
          this.engine
            .deleteRunById(message.runKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error:
                  err?.message ||
                  "Unable to delete interceptor run.",
              })
            );
          return true;
        }

        // --- Deletion: all runs ---
        case "interceptor_clearAllRuns": {
          this.engine
            .clearAllRuns()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error:
                  err?.message ||
                  "Unable to clear interceptor runs.",
              })
            );
          return true;
        }

        default:
          break;
      }
    });
  }

  sendToReact(msg) {
    browser.runtime.sendMessage(msg).catch(err => {
      console.error("[Interceptor/Background] sendMessage error:", err);
    });
  }
}

export default InterceptorBackgroundController;
