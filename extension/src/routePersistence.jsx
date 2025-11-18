import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import browser from 'webextension-polyfill';
import analyzerReactController from './sections/analyzer/analyzerController';
import interceptorReactController from './sections/interceptor/interceptorController';

/**
 * **RoutePersistence Component**
 *
 * This component is responsible for persisting and restoring the last visited
 * UI route per browser tab in the extension popup.
 *
 * Architectural Responsibilities:
 * - Tracks the current React Router location for the active browser tab.
 * - Persists the "last meaningful route" in `browser.storage.session`,
 *   keyed by tab ID (`ui_lastRoute_byTab`).
 * - On initial load (`"/"`), restores:
 *    - the analyzer runtime page if an analyzer scan is active,
 *    - the interceptor page if the interceptor is active,
 *    - otherwise, the previously saved route for that tab,
 *    - and if nothing is stored, defaults to `/home`.
 *
 * Interaction with Controllers:
 * - Uses `analyzerReactController` and `interceptorReactController` to detect
 *   whether a runtime scan / interception session is currently active.
 *   If so, it forces navigation to those "live" views instead of a stale route.
 *
 * This component does not render any UI. It exists purely for side effects and
 * should be mounted at the top level (inside App).
 *
 * Hooks into route changes and the current tab state to:
 * - persist the last relevant route per tab,
 * - restore a meaningful route when the popup is opened on "/".
 *
 * @returns {null} This component does not render any JSX.
 */
export default function RoutePersistence() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Identify the current active browser tab (within the current window)
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        const tabId = tab?.id ?? null;
        if (tabId == null) return;

        // Read current Analyzer status from the React controller
        const statusAnalyzer = await analyzerReactController.getScanStatus().catch(() => null);

        const analyzerActive = !!(statusAnalyzer?.runtimeActive || statusAnalyzer?.active);

        // Read current Interceptor status from the React controller
        const statusInterceptor = await interceptorReactController.getStatus().catch(() => null);

        const interceptorActive = !!statusInterceptor?.active;

        // Load the existing "last route per tab" map from session storage
        const obj = await browser.storage.session.get('ui_lastRoute_byTab').catch(() => ({}));

        const prevMap = obj && obj.ui_lastRoute_byTab ? obj.ui_lastRoute_byTab : {};
        const map = { ...prevMap };

        const currentPath = location.pathname || '';
        const currentSearch = location.search || '';
        const currentFull = currentPath + currentSearch;

        // Decide what route to persist for this tab right now
        // Priority:
        //  1. Active analyzer runtime -> "/analyzer/runtime"
        //  2. Active interceptor -> "/interceptor"
        //  3. Otherwise, the current route (or "/home" as fallback)
        let routeToPersist;

        if (analyzerActive) {
          routeToPersist = '/analyzer/runtime';
        } else if (interceptorActive) {
          routeToPersist = '/interceptor';
        } else {
          routeToPersist = (currentPath || '/home') + currentSearch;
        }

        // Update the map and persist it in session storage
        map[tabId] = routeToPersist;
        await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});

        // Handle initial restore when the popup lands on the root route ("/")
        if (currentPath === '/' || currentPath === '') {
          let target = '/home';

          if (analyzerActive) {
            // If scanner is currently running, always go to analyzer runtime view
            target = '/analyzer/runtime';
          } else if (interceptorActive) {
            // If interceptor is active, prefer live interceptor view
            target = '/interceptor';
          } else {
            // Otherwise, use the previously persisted route for this tab if available
            const saved = prevMap[tabId];
            if (typeof saved === 'string' && saved.trim()) {
              target = saved;
            } else {
              // No previous route -> default to "/home"
              target = '/home';
            }
          }

          // Avoid infinite navigation loops:
          // only navigate if target differs from the current path+search
          if (!cancelled && target !== currentFull) {
            navigate(target, { replace: true });
          }
        }
      } catch {
        // Swallow errors: route persistence must never break the UI rendering.
      }
    })();

    // Cleanup flag to prevent navigation after unmount
    return () => {
      cancelled = true;
    };
  }, [location, navigate]);

  // This component renders nothing; it only performs side effects.
  return null;
}
