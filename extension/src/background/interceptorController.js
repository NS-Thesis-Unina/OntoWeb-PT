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
        /* ----- START ----- */
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

        /* ----- STOP ----- */
        case "interceptor_stop": {
          this.engine.stop().then((payload) => {
            this.sendToReact({ type: "interceptor_complete", ...payload });
          });
          break;
        }

        /* ----- STATUS ----- */
        case "interceptor_getStatus": {
          const s = this.engine.getStatus();
          sendResponse(s);
          return true;
        }

        /* ----- STORAGE: LAST RUN ----- */
        case "interceptor_getLastResults": {
          this.engine.getLastResults().then(res => sendResponse(res));
          return true;
        }

        /* ----- STORAGE: ALL RUNS ----- */
        case "interceptor_getAllResults": {
          this.engine.getAllResults().then(runs => sendResponse({ runs }));
          return true;
        }

        /* ----- DATA FROM CONTENT (page-world relay) ----- */
        case "interceptor_capture": {
          this.engine.ingestCapture(message.payload, sender);
          break;
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
