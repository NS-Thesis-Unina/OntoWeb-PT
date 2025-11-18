import browser from 'webextension-polyfill';
import TechStackEngine from './techstack/techstackEngine.js';

/**
 * **TechStackBackgroundController**
 *
 * Background-side controller responsible for receiving requests from the
 * React UI and delegating operations to the TechStackEngine. It also forwards
 * scan results and error messages back to all open UI views.
 *
 * Architectural Role:
 *   React UI → TechStackReactController → background (this file) → TechStackEngine
 *
 * Responsibilities:
 * - Start one-time tech stack scans
 * - Expose scan status / runtime state
 * - Retrieve session/local stored results
 * - Delete specific or all saved analyses
 * - Dispatch scanComplete / scanError notifications to the UI
 *
 * This controller contains no analysis logic.
 * All heavy logic is implemented in TechStackEngine.
 */
class TechStackBackgroundController {
  constructor() {
    this.engine = new TechStackEngine();
    this.initListener();
  }

  /**
   * Attach background listener for commands coming from React.
   */
  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        // ------------------------------------------------------
        // Start a one-time scan
        // ------------------------------------------------------
        case 'techstack_startOneTimeScan': {
          this.engine
            .runOneTimeStackScan(message.tabId, (data) => {
              this.sendMessageToReact({
                type: 'techstack_scanComplete',
                data,
              });
            })
            .catch((error) => {
              this.sendMessageToReact({
                type: 'techstack_scanError',
                message: error?.message || 'Unable to perform the scan on this page.',
              });
            });
          break;
        }

        // ------------------------------------------------------
        // Runtime scan status
        // ------------------------------------------------------
        case 'techstack_getScanStatus': {
          const s = this.engine.getRuntimeStatus?.() || {};
          sendResponse({ active: s.runtimeActive, ...s });
          return true;
        }

        // ------------------------------------------------------
        // Local archive retrieval
        // ------------------------------------------------------
        case 'techstack_getLocalResults': {
          this.engine
            .getLocalStackResults()
            .then((localResults) => sendResponse({ localResults }))
            .catch(() => sendResponse({ localResults: [] }));
          return true;
        }

        // ------------------------------------------------------
        // Session-scoped (by tab)
        // ------------------------------------------------------
        case 'techstack_getSessionLastForTab': {
          this.engine
            .getSessionLastForTab(message.tabId)
            .then((res) => sendResponse({ res }))
            .catch(() => sendResponse({ res: null }));
          return true;
        }

        // ------------------------------------------------------
        // Session-scoped (global)
        // ------------------------------------------------------
        case 'techstack_getSessionLast': {
          this.engine
            .getSessionLast()
            .then((res) => sendResponse({ res }))
            .catch(() => sendResponse({ res: null }));
          return true;
        }

        // ------------------------------------------------------
        // Delete single saved run
        // ------------------------------------------------------
        case 'techstack_deleteResultById': {
          this.engine
            .deleteResultById(message.resultKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to delete tech stack result.',
              })
            );
          return true;
        }

        // ------------------------------------------------------
        // Delete all stored runs
        // ------------------------------------------------------
        case 'techstack_clearAllResults': {
          this.engine
            .clearAllResults()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to clear tech stack results.',
              })
            );
          return true;
        }

        default:
          break;
      }
    });
  }

  /**
   * Broadcast a message to all open React views.
   */
  sendMessageToReact(msg) {
    browser.runtime.sendMessage(msg).catch((err) => {
      console.error('[TechStack/Background] Failed to send message to React:', err);
    });
  }
}

export default TechStackBackgroundController;
