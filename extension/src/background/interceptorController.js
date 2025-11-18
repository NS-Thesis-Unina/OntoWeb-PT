import browser from 'webextension-polyfill';
import InterceptorEngine from './interceptor/interceptorEngine.js';

/**
 * **InterceptorBackgroundController**
 *
 * Background-side controller responsible for receiving UI commands and routing
 * them to the InterceptorEngine. It also forwards live updates, completion
 * events, and content-script captures back to all open UI views.
 *
 * Architectural Role:
 *   React UI → InterceptorReactController → background (this file) → InterceptorEngine
 *
 * Responsibilities:
 * - Start/stop traffic capture sessions
 * - Provide runtime status of the capture engine
 * - Handle incoming captured entries (fetch/XHR/Page APIs)
 * - Retrieve or delete archived capture sessions
 * - Broadcast interceptor_update and interceptor_complete events
 *
 * This controller contains NO capture logic.
 * All logic is implemented inside InterceptorEngine.
 */
class InterceptorBackgroundController {
  constructor() {
    this.engine = new InterceptorEngine();
    this.initListener();
  }

  /**
   * Register the background listener for commands from React and content scripts.
   */
  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        // ------------------------------------------------------
        // Start capture session
        // ------------------------------------------------------
        case 'interceptor_start': {
          const cfg = message?.config || null;

          this.engine.start({
            config: cfg,

            onUpdate: (totals) => {
              this.sendToReact({ type: 'interceptor_update', totals });
            },

            onComplete: (payload) => {
              this.sendToReact({ type: 'interceptor_complete', ...payload });
            },
          });

          break;
        }

        // ------------------------------------------------------
        // Stop capture session
        // ------------------------------------------------------
        case 'interceptor_stop': {
          this.engine.stop().then((payload) => {
            this.sendToReact({ type: 'interceptor_complete', ...payload });
          });
          break;
        }

        // ------------------------------------------------------
        // Runtime status
        // ------------------------------------------------------
        case 'interceptor_getStatus': {
          const s = this.engine.getStatus();
          sendResponse(s);
          return true;
        }

        // ------------------------------------------------------
        // Last stored capture key
        // ------------------------------------------------------
        case 'interceptor_getLastKey': {
          this.engine.getLastResults().then((res) => {
            sendResponse({ key: res?.key || null });
          });
          return true;
        }

        // ------------------------------------------------------
        // List all stored capture metadata
        // ------------------------------------------------------
        case 'interceptor_listRuns': {
          this.engine.getAllResultsMeta().then((items) => sendResponse({ runs: items }));
          return true;
        }

        // ------------------------------------------------------
        // Incoming capture event from content script
        // ------------------------------------------------------
        case 'interceptor_capture': {
          this.engine.ingestCapture(message.payload, sender);
          break;
        }

        // ------------------------------------------------------
        // Delete single stored capture
        // ------------------------------------------------------
        case 'interceptor_deleteRunById': {
          this.engine
            .deleteRunById(message.runKey)
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to delete interceptor run.',
              })
            );
          return true;
        }

        // ------------------------------------------------------
        // Delete all stored captures
        // ------------------------------------------------------
        case 'interceptor_clearAllRuns': {
          this.engine
            .clearAllRuns()
            .then((info) => sendResponse({ ok: true, info }))
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err?.message || 'Unable to clear interceptor runs.',
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
   * Broadcast runtime or completion events to ALL open UI views.
   */
  sendToReact(msg) {
    browser.runtime.sendMessage(msg).catch((err) => {
      console.error('[Interceptor/Background] sendMessage error:', err);
    });
  }
}

export default InterceptorBackgroundController;
