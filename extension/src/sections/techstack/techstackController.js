import browser from 'webextension-polyfill';

/**
 * **TechStackReactController**
 *
 * High-level controller used by React components to manage TechStack scans.
 *
 * Architectural Role:
 *   React UI → TechStackReactController
 *     → background (TechStackBackgroundController)
 *       → TechStackEngine (capture, analysis, persistence)
 *
 * Responsibilities:
 * - Trigger one-time TechStack scans
 * - Receive scanComplete / scanError events from background
 * - Retrieve stored results:
 *      • session (per-tab)
 *      • session (global)
 *      • local archive
 * - Delete individual or all saved results
 *
 * This controller contains NO analysis logic.
 * All heavy work is inside TechStackEngine.
 */
class TechStackReactController {
  constructor() {
    this.subscribers = new Set();
    this._initMessageListenerOnce();
  }

  /**
   * Register global background → UI message listener.
   * Background emits:
   *   - techstack_scanComplete
   *   - techstack_scanError
   *   - techstack_reloadRequired
   */
  _initMessageListenerOnce() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;

    browser.runtime.onMessage.addListener((message) => {
      for (const sub of this.subscribers) {
        switch (message.type) {
          case 'techstack_scanComplete':
            sub.onScanComplete?.(message.data);
            break;

          case 'techstack_scanError':
            sub.onScanError?.(message.message);
            break;

          case 'techstack_reloadRequired':
            sub.onReloadRequired?.(message.data);
            break;
        }
      }
    });
  }

  /**
   * Subscribe UI handlers.
   *
   * Supported callbacks:
   *   - onScanComplete(data)
   *   - onScanError(message)
   *   - onReloadRequired(data)
   */
  onMessage(callbacks) {
    this.subscribers.add(callbacks);
    return () => this.subscribers.delete(callbacks);
  }

  // ------------------------------------------------------------
  //  Scan Operations
  // ------------------------------------------------------------

  /** Start a one-time TechStack scan on a given tab. */
  sendStartOneTimeStackScan(tabId) {
    browser.runtime.sendMessage({
      type: 'techstack_startOneTimeScan',
      tabId,
    });
  }

  /** Utility helper to get the active tab ID. */
  async getCurrentTabId() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.id ?? null;
  }

  // ------------------------------------------------------------
  //  Persistence Helpers
  // ------------------------------------------------------------

  async getSessionLastResultForTab(tabId) {
    try {
      const obj = await browser.storage.session.get('techstack_lastByTab');
      return obj?.techstack_lastByTab?.[tabId] ?? null;
    } catch {
      return null;
    }
  }

  async getSessionLastResult() {
    try {
      const obj = await browser.storage.session.get('techstack_lastResult');
      return obj?.techstack_lastResult ?? null;
    } catch {
      return null;
    }
  }

  async getLocalResults() {
    try {
      const res = await browser.runtime.sendMessage({
        type: 'techstack_getLocalResults',
      });
      return res?.localResults ?? [];
    } catch {
      return [];
    }
  }

  /** Waterfall loader: session_by_tab → session → local → none */
  async loadLastAvailable(tabId) {
    if (tabId != null) {
      const t = await this.getSessionLastResultForTab(tabId);
      if (t) return { source: 'session_by_tab', data: t };
    }

    const s = await this.getSessionLastResult();
    if (s) return { source: 'session', data: s };

    const local = await this.getLocalResults();
    if (local.length > 0) {
      try {
        const sorted = local
          .slice()
          .sort((a, b) => Number(b.key.split('_')[1]) - Number(a.key.split('_')[1]));
        return { source: 'local', data: sorted[0].results };
      } catch {
        return { source: 'local', data: local[0].results };
      }
    }

    return { source: 'none', data: null };
  }

  // ------------------------------------------------------------
  //  Deletion API
  // ------------------------------------------------------------

  async deleteResultById(resultKey) {
    const res = await browser.runtime.sendMessage({
      type: 'techstack_deleteResultById',
      resultKey,
    });

    if (!res?.ok) {
      throw new Error(res?.error || 'Unable to delete tech stack result.');
    }

    return res.info;
  }

  async clearAllResults() {
    const res = await browser.runtime.sendMessage({
      type: 'techstack_clearAllResults',
    });

    if (!res?.ok) {
      throw new Error(res?.error || 'Unable to clear tech stack results.');
    }

    return res.info;
  }
}

const techStackReactController = new TechStackReactController();
export default techStackReactController;
