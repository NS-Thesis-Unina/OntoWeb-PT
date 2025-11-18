import browser from 'webextension-polyfill';

/**
 * **InterceptorReactController**
 *
 * High-level controller used by React components to operate the
 * Interceptor traffic-capture subsystem.
 *
 * Architectural Role:
 *   React UI → InterceptorReactController
 *     → background (InterceptorBackgroundController)
 *       → InterceptorEngine (network capture + persistence)
 *
 * Responsibilities:
 * - Start/stop interceptor capture session
 * - Receive live updates:
 *      • interceptor_update   (totals, bytes, counters)
 *      • interceptor_complete (session finalization)
 * - Query runtime status
 * - Retrieve or delete stored runs
 * - Clear archive completely
 *
 * This controller contains NO capture logic.
 * All capture/processing happens inside InterceptorEngine.
 */
class InterceptorReactController {
  constructor() {
    this.subscribers = new Set();
    this._initMessageListenerOnce();
  }

  /**
   * Register background → UI event listener.
   * Background emits:
   *   - interceptor_update
   *   - interceptor_complete
   */
  _initMessageListenerOnce() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;

    browser.runtime.onMessage.addListener((message) => {
      for (const sub of this.subscribers) {
        switch (message.type) {
          case 'interceptor_update':
            sub.onUpdate?.(message.totals);
            break;

          case 'interceptor_complete':
            sub.onComplete?.(message);
            break;
        }
      }
    });
  }

  /**
   * Subscribe to interceptor events.
   *
   * Supported callbacks:
   *   - onUpdate(totals)
   *   - onComplete(payload)
   */
  onMessage(callbacks) {
    this.subscribers.add(callbacks);
    return () => this.subscribers.delete(callbacks);
  }

  // ------------------------------------------------------------
  //  Capture Control
  // ------------------------------------------------------------

  /** Start capture session with the given config. */
  start(config) {
    return browser.runtime.sendMessage({
      type: 'interceptor_start',
      config,
    });
  }

  /** Stop capture session (background will persist data + emit complete event). */
  stop() {
    return browser.runtime.sendMessage({ type: 'interceptor_stop' });
  }

  /** Get runtime status (active, totals, etc.). */
  getStatus() {
    return browser.runtime.sendMessage({ type: 'interceptor_getStatus' });
  }

  // ------------------------------------------------------------
  //  Archive Helpers
  // ------------------------------------------------------------

  /** Get last stored run key. */
  getLastKey() {
    return browser.runtime.sendMessage({ type: 'interceptor_getLastKey' });
  }

  /** Retrieve metadata for all archived runs. */
  listRuns() {
    return browser.runtime.sendMessage({ type: 'interceptor_listRuns' });
  }

  // ------------------------------------------------------------
  //  Deletion API
  // ------------------------------------------------------------

  async deleteRunById(runKey) {
    const res = await browser.runtime.sendMessage({
      type: 'interceptor_deleteRunById',
      runKey,
    });

    if (!res?.ok) {
      throw new Error(res?.error || 'Unable to delete interceptor run.');
    }

    return res.info;
  }

  async clearAllRuns() {
    const res = await browser.runtime.sendMessage({
      type: 'interceptor_clearAllRuns',
    });

    if (!res?.ok) {
      throw new Error(res?.error || 'Unable to clear interceptor runs.');
    }

    return res.info;
  }
}

const interceptorReactController = new InterceptorReactController();
export default interceptorReactController;
