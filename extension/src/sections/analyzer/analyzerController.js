import browser from 'webextension-polyfill';

/**
 * **AnalyzerReactController**
 *
 * High-level controller used by React components to operate the
 * Analyzer subsystem (both One-Time Scan and Runtime Scan).
 *
 * Architectural Role:
 *   React UI → AnalyzerReactController
 *     → background (AnalyzerBackgroundController)
 *       → AnalyzerEngine (HTML analysis + runtime monitoring)
 *
 * Responsibilities:
 * - Trigger Analyzer one-time scans
 * - Start/stop Runtime Scan sessions
 * - Receive background → UI events:
 *      • analyzer_scanComplete
 *      • analyzer_runtimeScanUpdate
 *      • analyzer_runtimeScanComplete
 *      • analyzer_scanError
 * - Query runtime/one-time status
 * - Access archive (local + session)
 * - Delete individual or all stored results
 *
 * This controller contains NO heavy analysis logic.
 * Only message-passing and lightweight routing for React components.
 */
class AnalyzerReactController {
  constructor() {
    this.subscribers = new Set();
    this._initMessageListenerOnce();
  }

  /**
   * Install background → UI message listener only once.
   *
   * Background emits:
   *   - analyzer_scanComplete
   *   - analyzer_runtimeScanUpdate
   *   - analyzer_runtimeScanComplete
   *   - analyzer_scanError
   */
  _initMessageListenerOnce() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;

    browser.runtime.onMessage.addListener((message) => {
      for (const sub of this.subscribers) {
        switch (message.type) {
          case 'analyzer_scanComplete':
            sub.onScanComplete?.(message.data);
            break;

          case 'analyzer_runtimeScanUpdate':
            sub.onRuntimeScanUpdate?.(message.url, message.totals);
            break;

          case 'analyzer_runtimeScanComplete':
            sub.onRuntimeScanComplete?.(message);
            break;

          case 'analyzer_scanError':
            sub.onScanError?.(message.message);
            break;

          default:
            break;
        }
      }
    });
  }

  /**
   * Subscribe to background Analyzer events.
   *
   * Supported callbacks:
   *   - onScanComplete(data)
   *   - onScanError(errorMessage)
   *   - onRuntimeScanUpdate(url, totals)
   *   - onRuntimeScanComplete(payload)
   */
  onMessage(callbacks) {
    this.subscribers.add(callbacks);
    return () => this.subscribers.delete(callbacks);
  }

  // ---------------------------------------------------------------------------
  //  One-Time Scan Commands
  // ---------------------------------------------------------------------------

  /** Trigger a one-time Analyzer scan for a given tab. */
  sendStartOneTimeScan(tabId) {
    browser.runtime.sendMessage({
      type: 'analyzer_startOneTimeScan',
      tabId,
    });
  }

  // ---------------------------------------------------------------------------
  //  Runtime Scan Commands
  // ---------------------------------------------------------------------------

  /** Begin a runtime scan session (background starts network listeners). */
  sendStartRuntimeScan() {
    browser.runtime.sendMessage({ type: 'analyzer_startRuntimeScan' });
  }

  /** Stop runtime scan session. Background persists results and emits completion event. */
  sendStopRuntimeScan() {
    browser.runtime.sendMessage({ type: 'analyzer_stopRuntimeScan' });
  }

  /** Retrieve live runtime-scan status (active, totals, url, startedAt, etc.). */
  async getScanStatus() {
    return browser.runtime.sendMessage({ type: 'analyzer_getScanStatus' });
  }

  /** Get last known runtime scan results (background saved). */
  async getLastRuntimeResults() {
    return browser.runtime.sendMessage({
      type: 'analyzer_getLastRuntimeResults',
    });
  }

  // ---------------------------------------------------------------------------
  //  Local Archive — One-Time Scan Results
  // ---------------------------------------------------------------------------

  /** Retrieve local archive of all one-time Analyzer scans. */
  async getLocalScanResults() {
    const response = await browser.runtime.sendMessage({
      type: 'analyzer_getLocalScanResults',
    });
    return response?.localResults ?? [];
  }

  // ---------------------------------------------------------------------------
  //  Local Archive — Runtime Scan Results
  // ---------------------------------------------------------------------------

  /** Retrieve metadata for all runtime scan runs. */
  async getAllRuntimeResults() {
    const response = await browser.runtime.sendMessage({
      type: 'analyzer_getAllRuntimeResults',
    });
    return response?.runs ?? [];
  }

  // ---------------------------------------------------------------------------
  //  Session Helpers
  // ---------------------------------------------------------------------------

  /** Retrieve last global one-time scan result from session storage. */
  async getSessionLastResult() {
    const { analyzer_lastResult } = await browser.storage.session.get('analyzer_lastResult');
    return analyzer_lastResult ?? null;
  }

  /** Retrieve last one-time scan for a specific tab from session storage. */
  async getSessionLastResultForTab(tabId) {
    const { analyzer_lastByTab } = await browser.storage.session.get('analyzer_lastByTab');
    if (!analyzer_lastByTab || tabId == null) return null;
    return analyzer_lastByTab[tabId] ?? null;
  }

  /** Utility: get the active tab ID (used for UI-triggered scans). */
  async getCurrentTabId() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.id ?? null;
  }

  /** Retrieve full per-tab history map from session storage. */
  async getSessionByTabMap() {
    const { analyzer_lastByTab } = await browser.storage.session.get('analyzer_lastByTab');
    return analyzer_lastByTab ?? {};
  }

  // ---------------------------------------------------------------------------
  //  Deletion API — One-Time Scan
  // ---------------------------------------------------------------------------

  /**
   * Delete a single one-time Analyzer scan (analyzerResults_<timestamp>).
   * Automatically updates session references pointing to this timestamp.
   */
  async deleteOneTimeResultById(resultKey) {
    const response = await browser.runtime.sendMessage({
      type: 'analyzer_deleteOneTimeResultById',
      resultKey,
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to delete analyzer scan.');
    }

    return response.info;
  }

  /**
   * Delete ALL one-time Analyzer scans (local archive + session storage).
   */
  async clearAllOneTimeResults() {
    const response = await browser.runtime.sendMessage({
      type: 'analyzer_clearAllOneTimeResults',
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to clear analyzer one-time scans.');
    }

    return response.info;
  }

  // ---------------------------------------------------------------------------
  //  Deletion API — Runtime Scan
  // ---------------------------------------------------------------------------

  /**
   * Delete a single runtime scan (analyzerRuntime_<timestamp>).
   * Background updates analyzerRuntime_lastKey accordingly.
   */
  async deleteRuntimeResultById(runtimeKey) {
    const response = await browser.runtime.sendMessage({
      type: 'analyzer_deleteRuntimeResultById',
      runtimeKey,
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to delete analyzer runtime scan.');
    }

    return response.info;
  }

  /**
   * Delete ALL runtime scan entries from archive (including last-key pointer).
   */
  async clearAllRuntimeResults() {
    const response = await browser.runtime.sendMessage({
      type: 'analyzer_clearAllRuntimeResults',
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to clear analyzer runtime scans.');
    }

    return response.info;
  }
}

const analyzerReactController = new AnalyzerReactController();
export default analyzerReactController;
