/**
 * Analyzer Content Script — One-Time Scan (Injected)
 *
 * Architectural Role:
 *   Background (AnalyzerEngine)
 *     → content_script/analyzer/analyzer_onetime_injected.js  (this file)
 *       → page DOM
 *
 * Responsibilities:
 *   - Extract the page's full HTML snapshot (`document.documentElement.outerHTML`)
 *   - Send the raw HTML to the background controller
 *       • background → AnalyzerEngine.runOneTimeScan()
 *   - Produce no UI effects and perform no heavy processing
 *
 * Notes:
 *   - This script runs **in the page context** only once per request.
 *   - It must remain extremely lightweight.
 *   - The background engine is responsible for parsing, storing, and emitting results.
 */

(function () {
  const apiX = typeof browser !== 'undefined' ? browser : chrome;

  (async () => {
    try {
      // -----------------------------------------------------------------------
      // Extract a full HTML snapshot of the page.
      // This is lightweight and does not mutate the DOM.
      // -----------------------------------------------------------------------
      const html = document.documentElement.outerHTML;

      // -----------------------------------------------------------------------
      // Send the captured HTML to the background script.
      // The background will:
      //   • parse HTML using cheerio
      //   • persist results to storage
      //   • update session helpers
      //   • resolve the callback for runOneTimeScan()
      // -----------------------------------------------------------------------
      const response = await apiX.runtime.sendMessage({
        type: 'analyzer_scanResult',
        data: { html },
      });

      console.log('[Analyzer/OneTime] ACK from background:', response);
    } catch (err) {
      console.error('[Analyzer/OneTime] Error sending HTML:', err);
    }
  })();
})();
