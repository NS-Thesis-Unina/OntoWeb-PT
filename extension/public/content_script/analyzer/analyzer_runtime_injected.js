/**
 * Analyzer Content Script — Runtime Scan (Injected)
 *
 * Architectural Role:
 *   Background (AnalyzerEngine)
 *     → content_script/analyzer/analyzer_runtime_injected.js  (this file)
 *       → page DOM
 *
 * Responsibilities:
 *   - Capture the page's current DOM state periodically:
 *       • every navigation
 *       • every tab update
 *       • or whenever engine reinjects this script
 *   - Send a snapshot (HTML, URL, title, timestamp) to background
 *       • background → AnalyzerEngine.startRuntimeScan()
 *   - Perform no parsing and no heavy logic in-page
 *
 * Notes:
 *   - This script runs **many times** during a runtime scan.
 *   - It must remain extremely small and efficient.
 *   - No DOM mutation, no blocking operations.
 */

(function () {
  const apiX = typeof browser !== 'undefined' ? browser : chrome;

  try {
    // -------------------------------------------------------------------------
    // Prepare a full snapshot of the page's current DOM.
    // background/engine will parse and aggregate the data.
    // -------------------------------------------------------------------------
    const payload = {
      html: document.documentElement.outerHTML,
      url: location.href,
      title: document.title,
      timestamp: Date.now(),
    };

    // -------------------------------------------------------------------------
    // Forward to background controller:
    //   • AnalyzerEngine._runtimeActive must be true
    //   • Engine aggregates dataset by URL
    //   • Emits incremental "analyzer_runtimeScanUpdate" events to UI
    // -------------------------------------------------------------------------
    apiX.runtime
      .sendMessage({
        type: 'analyzer_runtimeScanResult',
        data: payload,
      })
      .catch(() => {});
  } catch (err) {
    // Runtime injection must NEVER break the page.
    // Swallow all unexpected errors silently.
  }
})();
