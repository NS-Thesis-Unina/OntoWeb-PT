import browser from 'webextension-polyfill';
import AnalyzerEngine from './analyzer/analyzerEngine.js';

/**
 * **AnalyzerBackgroundController**
 *
 * Background-side controller responsible for receiving UI commands
 * and routing them to the AnalyzerEngine. It also forwards one-time
 * scan results, runtime-scan updates, and completion events back to
 * all open React UI views.
 *
 * Architectural Role:
 *   React UI → AnalyzerReactController → background (this file) → AnalyzerEngine
 *
 * Responsibilities:
 * - Start/stop Analyzer *one-time* scans
 * - Start/stop Analyzer *runtime* scans
 * - Provide runtime status of the analyzer engine
 * - Retrieve or delete archived results (one-time & runtime)
 * - Return last-known runtime scan (if present)
 * - Broadcast:
 *      • analyzer_scanComplete
 *      • analyzer_scanError
 *      • analyzer_runtimeScanUpdate
 *      • analyzer_runtimeScanComplete
 *
 * This controller contains NO analysis logic.
 * All real scanning/processing is implemented inside AnalyzerEngine.
 */
class AnalyzerBackgroundController {
  constructor() {
    this.engine = new AnalyzerEngine();
    this.initListener();
  }

  /**
   * Register the central background listener handling all incoming commands
   * from React UI (one-time scans, runtime scans, archive actions, status checks).
   */
  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        // ------------------------------------------------------
        //  ONE-TIME SCAN: start analysis of the selected tab
        // ------------------------------------------------------
        case 'analyzer_startOneTimeScan': {
          this.engine
            .runOneTimeScan(message.tabId, (data) => {
              this.sendMessageToReact({ type: 'analyzer_scanComplete', data });
            })
            .catch((error) => {
              this.sendMessageToReact({
                type: 'analyzer_scanError',
                message: error?.message || 'Unable to perform the scan on this page.',
              });
            });
          break;
        }

        // ------------------------------------------------------
        //  RUNTIME SCAN: start continuous network-based analysis
        // ------------------------------------------------------
        case 'analyzer_startRuntimeScan': {
          this.engine.startRuntimeScan({
            onUpdate: (url, totals) => {
              this.sendMessageToReact({
                type: 'analyzer_runtimeScanUpdate',
                url,
                totals,
              });
            },

            onComplete: (payload) => {
              this.sendMessageToReact({
                type: 'analyzer_runtimeScanComplete',
                ...payload,
              });
            },
          });
          break;
        }

        // ------------------------------------------------------
        //  RUNTIME SCAN: stop session and finalize results
        // ------------------------------------------------------
        case 'analyzer_stopRuntimeScan': {
          this.engine.stopRuntimeScan().then((payload) => {
            this.sendMessageToReact({
              type: 'analyzer_runtimeScanComplete',
              ...payload,
            });
          });
          break;
        }

        // ------------------------------------------------------
        //  STATUS: return runtime scan active + metadata
        // ------------------------------------------------------
        case 'analyzer_getScanStatus': {
          const s = this.engine.getRuntimeStatus();
          sendResponse({ active: s.runtimeActive, ...s });
          return true;
        }

        // ------------------------------------------------------
        //  ARCHIVE (ONE-TIME): list local stored scan results
        // ------------------------------------------------------
        case 'analyzer_getLocalScanResults': {
          this.engine
            .getLocalScanResults()
            .then((localResults) => sendResponse({ localResults }))
            .catch(() => sendResponse({ localResults: [] }));
          return true;
        }

        // ------------------------------------------------------
        //  RUNTIME: return last saved runtime scan (if exists)
        // ------------------------------------------------------
        case 'analyzer_getLastRuntimeResults': {
          this.engine
            .getLastRuntimeResults()
            .then((res) => sendResponse(res))
            .catch(() => sendResponse({ key: null, run: null }));
          return true;
        }

        // ------------------------------------------------------
        //  RUNTIME: list all stored runtime sessions
        // ------------------------------------------------------
        case 'analyzer_getAllRuntimeResults': {
          this.engine
            .getAllRuntimeResults()
            .then((runs) => sendResponse({ runs }))
            .catch(() => sendResponse({ runs: [] }));
          return true;
        }

        // ------------------------------------------------------
        //  ARCHIVE (ONE-TIME): delete single result by key
        // ------------------------------------------------------
        case 'analyzer_deleteOneTimeResultById': {
          this.engine
            .deleteOneTimeResultById(message.resultKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to delete analyzer scan.',
              })
            );
          return true;
        }

        // ------------------------------------------------------
        //  ARCHIVE (ONE-TIME): clear all results
        // ------------------------------------------------------
        case 'analyzer_clearAllOneTimeResults': {
          this.engine
            .clearAllOneTimeResults()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to clear analyzer one-time scans.',
              })
            );
          return true;
        }

        // ------------------------------------------------------
        //  ARCHIVE (RUNTIME): delete one runtime scan by key
        // ------------------------------------------------------
        case 'analyzer_deleteRuntimeResultById': {
          this.engine
            .deleteRuntimeResultById(message.runtimeKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to delete analyzer runtime scan.',
              })
            );
          return true;
        }

        // ------------------------------------------------------
        //  ARCHIVE (RUNTIME): clear all stored runtime scans
        // ------------------------------------------------------
        case 'analyzer_clearAllRuntimeResults': {
          this.engine
            .clearAllRuntimeResults()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to clear analyzer runtime scans.',
              })
            );
          return true;
        }

        default:
          // Unknown command → ignored intentionally
          break;
      }
    });
  }

  /**
   * Broadcast a message to ALL UI views (popup, panel, pages).
   * Used for:
   *   - analyzer_scanComplete
   *   - analyzer_scanError
   *   - analyzer_runtimeScanUpdate
   *   - analyzer_runtimeScanComplete
   */
  sendMessageToReact(msg) {
    browser.runtime.sendMessage(msg).catch((err) => {
      console.error('[Analyzer/Background] Failed to send message to React:', err);
    });
  }
}

export default AnalyzerBackgroundController;
