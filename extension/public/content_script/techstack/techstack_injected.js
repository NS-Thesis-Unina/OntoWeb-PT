/**
 * Techstack Content Script (Injected)
 *
 * Content-script injected into the current webpage to collect **client-side evidence**
 * needed for the TechStackEngine analysis.
 *
 * Architectural role:
 *   TechStackEngine (background)
 *     → injects this script into the page
 *       → this script extracts DOM/META/HTML/scripts data
 *         → responds to background messages with collected information
 *
 * Responsibilities:
 *   - Extract META tags
 *   - Extract external scripts and inline scripts
 *   - Extract full HTML (truncated for size)
 *   - Provide URL of the current document
 *   - Provide optional DOM/JS findings (if needed in future)
 *   - Dump localStorage and sessionStorage on request
 *
 * Notes:
 *   - This script runs **in the context of the webpage**, not in the extension sandbox.
 *   - Access to the DOM is unrestricted.
 *   - Communication back to background happens via runtime messaging.
 */

(() => {
  // Prevent double injection on the same page (common in SPAs or reloads)
  if (window.__OWPT_TS_INJECTED__) return;
  window.__OWPT_TS_INJECTED__ = true;

  // Polyfill: Chrome uses `chrome`, Firefox uses `browser`
  const apiX = typeof browser !== 'undefined' ? browser : chrome;

  // ---------------------------------------------------------------------------
  //                         Data Extraction Helpers
  // ---------------------------------------------------------------------------

  /**
   * Collect META, scripts, HTML, URL, and placeholder findings.
   *
   * This function intentionally limits extracted data size:
   *   - HTML capped at 300k characters
   *   - Max 12 inline scripts
   *   - Max 30k chars per inline script
   *
   * This protects performance and prevents oversized messages.
   */
  function collectTechStackData() {
    const MAX_HTML = 300_000;
    const MAX_INLINE_SCRIPTS = 12;
    const MAX_SCRIPT_CHARS = 30_000;

    // --------------------------- META TAGS ---------------------------
    const meta = Array.from(document.querySelectorAll('meta')).map((m) => ({
      name: m.getAttribute('name'),
      property: m.getAttribute('property'),
      content: m.getAttribute('content'),
    }));

    // --------------------------- SCRIPT SRC ---------------------------
    const scriptSrc = Array.from(document.scripts)
      .map((s) => s.src)
      .filter(Boolean);

    // --------------------------- INLINE SCRIPTS ---------------------------
    const scripts = Array.from(document.scripts)
      .filter((s) => !s.src && s.textContent)
      .slice(0, MAX_INLINE_SCRIPTS) // limit amount
      .map((s) => s.textContent.substring(0, MAX_SCRIPT_CHARS)); // truncate

    // --------------------------- FULL HTML ---------------------------
    const html = document.documentElement.outerHTML.substring(0, MAX_HTML);

    // --------------------------- URL ---------------------------
    const url = location.href;

    // --------------------------- Findings (DOM/JS) ---------------------------
    // Not used yet, but left for future detection rules
    const domFindings = [];
    const jsFindings = [];

    return { meta, scriptSrc, scripts, html, url, domFindings, jsFindings };
  }

  // ---------------------------------------------------------------------------
  //                       Message Listener (Background → Page)
  // ---------------------------------------------------------------------------

  /**
   * Listens for requests sent by the TechStackEngine via:
   *   browser.tabs.sendMessage(tabId, { action: "..." })
   *
   * Supported actions:
   *   - analyzeStack         → return META/HTML/scripts/URL
   *   - dumpLocalStorage     → return localStorage contents
   *   - dumpSessionStorage   → return sessionStorage contents
   */
  apiX.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // --------------------------- ANALYZE STACK ---------------------------
    if (message.action === 'analyzeStack') {
      try {
        const payload = collectTechStackData();
        sendResponse({ ok: true, info: payload });
      } catch (err) {
        console.error('[TechStack Injected] Error:', err);
        sendResponse({ ok: false, error: String(err) });
      }
      return true; // async response allowed
    }

    // --------------------------- LOCAL STORAGE DUMP ---------------------------
    if (message.action === 'dumpLocalStorage') {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        items.push({ key, value: localStorage.getItem(key) });
      }
      sendResponse(items);
      return true;
    }

    // --------------------------- SESSION STORAGE DUMP ---------------------------
    if (message.action === 'dumpSessionStorage') {
      const items = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        items.push({ key, value: sessionStorage.getItem(key) });
      }
      sendResponse(items);
      return true;
    }

    return false; // Unhandled message
  });
})();
