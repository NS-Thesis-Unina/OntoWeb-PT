import browser from "webextension-polyfill";

class AnalyzerReactController {
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
          case "analyzer_scanComplete":
            sub.onScanComplete?.(message.data);
            break;
          case "analyzer_runtimeScanUpdate":
            sub.onRuntimeScanUpdate?.(message.url, message.totals);
            break;
          case "analyzer_runtimeScanComplete":
            sub.onRuntimeScanComplete?.(message);
            break;
          case "analyzer_scanError":
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

  // ---------- One-time scan (commands) ----------
  sendStartOneTimeScan(tabId) {
    browser.runtime.sendMessage({ type: "analyzer_startOneTimeScan", tabId });
  }

  // ---------- Runtime scan (commands) ----------
  sendStartRuntimeScan() {
    browser.runtime.sendMessage({ type: "analyzer_startRuntimeScan" });
  }

  sendStopRuntimeScan() {
    browser.runtime.sendMessage({ type: "analyzer_stopRuntimeScan" });
  }

  async getScanStatus() {
    return browser.runtime.sendMessage({ type: "analyzer_getScanStatus" });
  }

  async getLastRuntimeResults() {
    return browser.runtime.sendMessage({ type: "analyzer_getLastRuntimeResults" });
  }

  // ---------- Archive one-time ----------
  async getLocalScanResults() {
    const response = await browser.runtime.sendMessage({ type: "analyzer_getLocalScanResults" });
    return response?.localResults ?? [];
  }

  // ---------- Archive runtime – all runs ----------
  async getAllRuntimeResults() {
    const response = await browser.runtime.sendMessage({ type: "analyzer_getAllRuntimeResults" });
    return response?.runs ?? [];
  }

  // ---------- Session helpers ----------
  async getSessionLastResult() {
    const { analyzer_lastResult } = await browser.storage.session.get("analyzer_lastResult");
    return analyzer_lastResult ?? null;
  }

  async getSessionLastResultForTab(tabId) {
    const { analyzer_lastByTab } = await browser.storage.session.get("analyzer_lastByTab");
    if (!analyzer_lastByTab || tabId == null) return null;
    return analyzer_lastByTab[tabId] ?? null;
  }

  async getCurrentTabId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }

  async getSessionByTabMap() {
    const { analyzer_lastByTab } = await browser.storage.session.get("analyzer_lastByTab");
    return analyzer_lastByTab ?? {};
  }

  // ---------- Deletion API: one-time scans ----------

  /**
   * Delete a single one-time analyzer scan by its storage key (analyzerResults_<timestamp>).
   * It will remove the local archive entry and clean session references pointing to that timestamp.
   * Throws if the scan cannot be found/removed.
   */
  async deleteOneTimeResultById(resultKey) {
    const response = await browser.runtime.sendMessage({
      type: "analyzer_deleteOneTimeResultById",
      resultKey,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unable to delete analyzer scan.");
    }

    return response.info;
  }

  /**
   * Delete all one-time analyzer scans from local and session storage.
   */
  async clearAllOneTimeResults() {
    const response = await browser.runtime.sendMessage({
      type: "analyzer_clearAllOneTimeResults",
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unable to clear analyzer one-time scans.");
    }

    return response.info;
  }

  // ---------- Deletion API: runtime scans ----------

  /**
   * Delete a single runtime scan by its key (analyzerRuntime_<timestamp>).
   * Updates analyzerRuntime_lastKey if needed, or removes it when no runs remain.
   */
  async deleteRuntimeResultById(runtimeKey) {
    const response = await browser.runtime.sendMessage({
      type: "analyzer_deleteRuntimeResultById",
      runtimeKey,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unable to delete analyzer runtime scan.");
    }

    return response.info;
  }

  /**
   * Delete all runtime scans from local storage (including analyzerRuntime_lastKey).
   */
  async clearAllRuntimeResults() {
    const response = await browser.runtime.sendMessage({
      type: "analyzer_clearAllRuntimeResults",
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unable to clear analyzer runtime scans.");
    }

    return response.info;
  }
}

const analyzerReactController = new AnalyzerReactController();
export default analyzerReactController;
