import browser from "webextension-polyfill";

class TechStackReactController {
  constructor() {
    this.subscribers = new Set();
    this._initMessageListenerOnce();
  }

  _initMessageListenerOnce() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;

    browser.runtime.onMessage.addListener((message) => {
      for (const sub of this.subscribers) {
        switch (message.type) {
          case "techstack_scanComplete":
            sub.onScanComplete?.(message.data);
            break;
          case "techstack_reloadRequired":
            sub.onReloadRequired?.(message.data);
            break;
          case "techstack_scanError":
            sub.onScanError?.(message.message);
            break;
          default:
            break;
        }
      }
    });
  }

  onMessage(callbacks) {
    this.subscribers.add(callbacks);
    return () => this.subscribers.delete(callbacks);
  }

  sendStartOneTimeStackScan(tabId) {
    browser.runtime.sendMessage({ type: "techstack_startOneTimeScan", tabId });
  }

  async getCurrentTabId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }

  // --- Persistence API (waterfall helpers) ---

  // session per tab
  async getSessionLastResultForTab(tabId) {
    try {
      if (!browser.storage?.session?.get) return null;
      const obj = await browser.storage.session.get("techstack_lastByTab");
      const map = obj?.techstack_lastByTab ?? {};
      return map[tabId] ?? null;
    } catch {
      return null;
    }
  }

  // session general
  async getSessionLastResult() {
    try {
      if (!browser.storage?.session?.get) return null;
      const obj = await browser.storage.session.get("techstack_lastResult");
      return obj?.techstack_lastResult ?? null;
    } catch {
      return null;
    }
  }

  // local archive results (mirror of analyzer behavior)
  async getLocalResults() {
    try {
      const response = await browser.runtime.sendMessage({ type: "techstack_getLocalResults" });
      return response?.localResults ?? [];
    } catch {
      return [];
    }
  }

  // convenience: waterfall load (tab -> session -> local)
  async loadLastAvailable(tabId) {
    // tab-specific
    if (tabId != null) {
      const tabRes = await this.getSessionLastResultForTab(tabId);
      if (tabRes) return { source: "session_by_tab", data: tabRes };
    }
    // session general
    const sRes = await this.getSessionLastResult();
    if (sRes) return { source: "session", data: sRes };

    // local: return the most recent local result (if any)
    const local = await this.getLocalResults();
    if (Array.isArray(local) && local.length > 0) {
      // local comes as array of { key, results } like analyzer; pick the latest (already sorted? ensure)
      // sort by key timestamp suffix if possible, fall back to first
      try {
        const sorted = local.slice().sort((a, b) => {
          const as = a.key.split("_")[1] || "0";
          const bs = b.key.split("_")[1] || "0";
          return Number(bs) - Number(as);
        });
        return { source: "local", data: sorted[0].results };
      } catch {
        return { source: "local", data: local[0].results };
      }
    }

    return { source: "none", data: null };
  }

  // --- Deletion API (local + session) ---

  /**
   * Delete a specific tech stack scan by its storage key (techstackResults_<timestamp>).
   * If the scan is not found anywhere, this will throw an error.
   */
  async deleteResultById(resultKey) {
    try {
      const response = await browser.runtime.sendMessage({
        type: "techstack_deleteResultById",
        resultKey,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unable to delete tech stack result.");
      }

      return response.info; // { removedLocal, clearedSessionLast, clearedSessionTabs }
    } catch (err) {
      // Bubble up so the UI can show proper feedback
      throw err;
    }
  }

  /**
   * Delete all stored tech stack scans (local archive + session helpers).
   */
  async clearAllResults() {
    try {
      const response = await browser.runtime.sendMessage({
        type: "techstack_clearAllResults",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unable to clear tech stack results.");
      }

      return response.info; // { removedKeys, clearedSessionLast, clearedSessionTabs }
    } catch (err) {
      throw err;
    }
  }
}

const techStackReactController = new TechStackReactController();
export default techStackReactController;
