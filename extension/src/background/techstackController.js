import browser from "webextension-polyfill";
import TechStackEngine from "./techstack/techstackEngine.js";

class TechStackBackgroundController {
  constructor() {
    this.engine = new TechStackEngine();
    this.initListener();
  }

  initListener() {
    console.log("[TechStack Background] Controller inizializzato");

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "techstack_startOneTimeScan": {
          this.engine
            .runOneTimeStackScan(message.tabId, (data) => {
              this.sendMessageToReact({ type: "techstack_scanComplete", data });
            })
            .catch((error) => {
              this.sendMessageToReact({
                type: "techstack_scanError",
                message:
                  error?.message ||
                  "Impossibile eseguire la scansione TechStack su questa pagina.",
              });
            });
          break;
        }

        case "techstack_getScanStatus": {
          const s = this.engine.getRuntimeStatus();
          sendResponse({ active: s.runtimeActive, ...s });
          return true;
        }


        default:
          console.warn("[TechStack Background] Unknown type:", message.type);
      }
    });
  }

  sendMessageToReact(msg) {
    browser.runtime.sendMessage(msg).catch((err) => {
      console.error("[TechStack Background] Failed to send message to React:", err);
    });
  }
}

export default TechStackBackgroundController;
