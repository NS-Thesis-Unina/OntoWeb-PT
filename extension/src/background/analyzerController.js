import browser from "webextension-polyfill";
import AnalyzerEngine from "./analyzer/analyzerEngine.js";

class AnalyzerBackgroundController {
  constructor() {
    this.engine = new AnalyzerEngine();
    this.initListener();
  }

  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        /* ---------- ONE-TIME START ---------- */
        case "analyzer_startOneTimeScan": {
          this.engine
            .runOneTimeScan(message.tabId, (data) => {
              this.sendMessageToReact({ type: "analyzer_scanComplete", data });
            })
            .catch((error) => {
              this.sendMessageToReact({
                type: "analyzer_scanError",
                message:
                  error?.message ||
                  "Unable to perform the scan on this page.",
              });
            });
          break;
        }

        /* ---------- RUNTIME START ---------- */
        case "analyzer_startRuntimeScan": {
          this.engine.startRuntimeScan({
            onUpdate: (url, totals) => {
              this.sendMessageToReact({ type: "analyzer_runtimeScanUpdate", url, totals });
            },
            onComplete: (payload) => {
              this.sendMessageToReact({ type: "analyzer_runtimeScanComplete", ...payload });
            }
          });
          break;
        }

        /* ---------- RUNTIME STOP ---------- */
        case "analyzer_stopRuntimeScan": {
          this.engine.stopRuntimeScan().then((payload) => {
            this.sendMessageToReact({ type: "analyzer_runtimeScanComplete", ...payload });
          });
          break;
        }

        /* ---------- STATUS ---------- */
        case "analyzer_getScanStatus": {
          const s = this.engine.getRuntimeStatus();
          sendResponse({ active: s.runtimeActive, ...s });
          return true;
        }

        /* ---------- ARCHIVE ONE-TIME ---------- */
        case "analyzer_getLocalScanResults": {
          this.engine
            .getLocalScanResults()
            .then((localResults) => sendResponse({ localResults }))
            .catch(() => sendResponse({ localResults: [] }));
          return true;
        }

        /* ---------- LAST RUNTIME SAVED ---------- */
        case "analyzer_getLastRuntimeResults": {
          this.engine
            .getLastRuntimeResults()
            .then((res) => sendResponse(res))
            .catch(() => sendResponse({ key: null, run: null }));
          return true;
        }

        /* ---------- ALL RUNTIME RUNS ---------- */
        case "analyzer_getAllRuntimeResults": {
          this.engine
            .getAllRuntimeResults()
            .then((runs) => sendResponse({ runs }))
          .catch(() => sendResponse({ runs: [] }));
          return true;
        }

        /* ---------- DELETE ONE-TIME BY ID ---------- */
        case "analyzer_deleteOneTimeResultById": {
          this.engine
            .deleteOneTimeResultById(message.resultKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error:
                  err?.message ||
                  "Unable to delete analyzer scan.",
              })
            );
          return true;
        }

        /* ---------- CLEAR ALL ONE-TIME RESULTS ---------- */
        case "analyzer_clearAllOneTimeResults": {
          this.engine
            .clearAllOneTimeResults()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error:
                  err?.message ||
                  "Unable to clear analyzer one-time scans.",
              })
            );
          return true;
        }

        /* ---------- DELETE RUNTIME BY ID ---------- */
        case "analyzer_deleteRuntimeResultById": {
          this.engine
            .deleteRuntimeResultById(message.runtimeKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error:
                  err?.message ||
                  "Unable to delete analyzer runtime scan.",
              })
            );
          return true;
        }

        /* ---------- CLEAR ALL RUNTIME RESULTS ---------- */
        case "analyzer_clearAllRuntimeResults": {
          this.engine
            .clearAllRuntimeResults()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error:
                  err?.message ||
                  "Unable to clear analyzer runtime scans.",
              })
            );
          return true;
        }

        default:
        // console.warn("[AnalyzerBackground] Unknown type:", message.type);
      }
    });
  }

  sendMessageToReact(msg) {
    browser.runtime.sendMessage(msg).catch(err => {
      console.error("[Analyzer/Background] Failed to send message to React:", err);
    });
  }
}

export default AnalyzerBackgroundController;
