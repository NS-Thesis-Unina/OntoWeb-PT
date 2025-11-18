/**
 * background.js
 *
 * Architectural Role:
 *   Browser Extension → Service Worker (Background Script)
 *
 * Purpose:
 *   Centralized initialization point for all background controllers:
 *      • AnalyzerBackgroundController
 *      • TechStackBackgroundController
 *      • InterceptorBackgroundController
 *      • ToolBackgroundController
 *
 *   Also maintains extension-wide session state by cleaning per-tab UI
 *   metadata when tabs are closed.
 *
 * Behavior Summary:
 *   • Listens for browser.tab removal events
 *   • Prunes stale entries from session storage (ui_lastRoute_byTab)
 *   • Instantiates all background controllers, each attaching its own
 *     listeners, message handlers and runtime logic.
 */

import browser from 'webextension-polyfill';
import AnalyzerBackgroundController from './src/background/analyzerController.js';
import TechStackBackgroundController from './src/background/techstackController.js';
import InterceptorBackgroundController from './src/background/interceptorController.js';
import ToolBackgroundController from './src/background/toolController.js';

/* ========================================================================== */
/* Cleanup: remove last UI route for closed tabs                               */
/* ========================================================================== */
/**
 * When a tab is closed, any UI metadata associated with that tab
 * (e.g., last visited route inside the popup UI) becomes stale.
 *
 * We track this in: browser.storage.session → ui_lastRoute_byTab = { [tabId]: route }
 *
 * This listener ensures that leftover routes are removed to prevent:
 *   - inconsistent navigation state
 *   - stale UI restore attempts when reopening the popup
 *   - unnecessary storage growth
 */
browser.tabs.onRemoved.addListener(async (tabId) => {
  try {
    // Retrieve mapping: { ui_lastRoute_byTab: { "123": "/analyze/runtime", ... } }
    const obj = await browser.storage.session.get('ui_lastRoute_byTab').catch(() => ({}));

    const map = obj?.ui_lastRoute_byTab ?? {};
    const key = String(tabId);

    // If this tab has a tracked route, remove it
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      delete map[key];

      // Persist the cleaned map
      await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});

      console.debug('[background] cleaned ui_lastRoute_byTab for tab', key);
    }
  } catch (e) {
    console.warn('[background] failed to prune ui_lastRoute_byTab', e);
  }
});

/* ========================================================================== */
/* Controller Initialization                                                   */
/* ========================================================================== */
/**
 * Each controller registers its own listeners:
 *   - runtime.onMessage
 *   - webRequest listeners
 *   - storage updates
 *   - interval timers
 *   - WebSocket clients
 *   - background logic for scans / tools / interceptor streams
 *
 * Instantiating them here ensures:
 *   • the background worker remains alive when needed
 *   • listeners are active exactly once
 *   • global coordination among subsystems
 */

new AnalyzerBackgroundController(); // Ontology analyzer scan orchestration
new TechStackBackgroundController(); // Technology fingerprinting + framework detection
new InterceptorBackgroundController(); // HTTP/S interception + event streaming
new ToolBackgroundController(); // Backend tool availability, health, job relay
