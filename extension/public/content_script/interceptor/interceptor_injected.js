/**
 * Interceptor Content Script (Injected)
 *
 * Architectural Role:
 *   Background (InterceptorEngine)
 *     → content_script/interceptor_injected.js  (this file)
 *       → page (interceptor_page.js)
 *
 * Responsibilities:
 *   - Inject capture flags into the page (window.__owptCaptureFlags)
 *   - Inject the page-level interception script (interceptor_page.js)
 *   - Serve as a bridge between page → extension messaging
 *       • Receives intercepted events from page via window.postMessage
 *       • Forwards them to background via browser.runtime.sendMessage
 *   - Notify the page when flags change or when the bridge is ready
 *
 * Notes:
 *   - This script is injected *into the page context* via executeScript().
 *   - It must be extremely lightweight and safe.
 *   - No heavy logic — only forwarding and initialization.
 */

(function () {
  const apiX = typeof browser !== 'undefined' ? browser : chrome;
  const FLAGS_KEY = 'interceptor_flags';

  // ---------------------------------------------------------------------------
  //               Helpers — Flag Injection + Script Injection
  // ---------------------------------------------------------------------------

  /**
   * Inject the current capture flags into the page global scope.
   * This enables interceptor_page.js to reconfigure itself.
   */
  function injectFlagsScript(flagsObj) {
    try {
      const s = document.createElement('script');
      s.async = false;
      s.textContent = `
        try {
          window.__owptCaptureFlags = ${JSON.stringify(flagsObj || {})};
        } catch(e) {}
      `;
      (document.documentElement || document.head || document.body).appendChild(s);
      s.remove();
    } catch (e) {}
  }

  /**
   * Inject the actual page-level interceptor (interceptor_page.js)
   * directly into the page context.
   */
  function injectPageScript() {
    try {
      const script = document.createElement('script');
      script.src = apiX.runtime?.getURL
        ? apiX.runtime.getURL('content_script/interceptor/interceptor_page.js')
        : '';
      script.async = false;

      (document.documentElement || document.head || document.body).appendChild(script);
      script.onload = () => script.remove();
    } catch (e) {}
  }

  /**
   * Notify page-side controller that flags were applied.
   * The page script listens for this message.
   */
  function notifyFlagsApplied() {
    try {
      window.postMessage({ __owpt: true, type: 'owpt_update_flags' }, '*');
    } catch {}
  }

  // ---------------------------------------------------------------------------
  //               Initialization — Load Flags and Inject Scripts
  // ---------------------------------------------------------------------------

  try {
    // Try reading flags from extension storage
    const get = apiX.storage?.local?.get ? apiX.storage.local.get(FLAGS_KEY) : Promise.resolve({});

    Promise.resolve(get)
      .then((res) => {
        const flags = res?.[FLAGS_KEY] || {};
        injectFlagsScript(flags);
        injectPageScript();
        notifyFlagsApplied();
      })
      .catch(() => {
        // Fallback — no flags available
        injectFlagsScript({});
        injectPageScript();
        notifyFlagsApplied();
      });
  } catch {
    injectFlagsScript({});
    injectPageScript();
    notifyFlagsApplied();
  }

  // ---------------------------------------------------------------------------
  //                Bridge — Forward page → background events
  // ---------------------------------------------------------------------------

  /**
   * The page script posts events of type "owpt_intercept".
   * This listener forwards them to the background controller.
   */
  window.addEventListener(
    'message',
    (event) => {
      if (event?.source !== window) return;
      const msg = event?.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.__owpt === true && msg.type === 'owpt_intercept') {
        try {
          apiX.runtime
            .sendMessage({
              type: 'interceptor_capture',
              payload: msg.payload,
            })
            .catch(() => {});
        } catch (e) {}
      }
    },
    false
  );

  // ---------------------------------------------------------------------------
  //                    Notify Page that Bridge is Ready
  // ---------------------------------------------------------------------------

  try {
    window.postMessage({ __owpt: true, type: 'owpt_bridge_ready' }, '*');
  } catch (e) {}
})();
