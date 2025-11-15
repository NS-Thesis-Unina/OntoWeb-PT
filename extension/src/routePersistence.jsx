import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import browser from "webextension-polyfill";
import analyzerReactController from "./sections/analyzer/analyzerController";
import interceptorReactController from "./sections/interceptor/interceptorController";

export default function RoutePersistence() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;
        if (tabId == null) return;

        // Read current analyzer / interceptor status
        const statusAnalyzer = await analyzerReactController.getScanStatus().catch(() => null);
        const analyzerActive = !!(statusAnalyzer?.runtimeActive || statusAnalyzer?.active);

        const statusInterceptor = await interceptorReactController.getStatus().catch(() => null);
        const interceptorActive = !!statusInterceptor?.active;

        // Load previous route map for all tabs
        const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
        const prevMap = obj && obj.ui_lastRoute_byTab ? obj.ui_lastRoute_byTab : {};
        const map = { ...prevMap };

        const currentPath = location.pathname || "";
        const currentSearch = location.search || "";
        const currentFull = currentPath + currentSearch;

        //Decide what to persist for this tab now ---

        let routeToPersist;

        if (analyzerActive) {
          routeToPersist = "/analyzer/runtime";
        } else if (interceptorActive) {
          routeToPersist = "/interceptor";
        } else {
          routeToPersist = (currentPath || "/home") + currentSearch;
        }

        map[tabId] = routeToPersist;
        await browser.storage.session
          .set({ ui_lastRoute_byTab: map })
          .catch(() => {});

        // Handle initial restore when we land on "/" ---

        if (currentPath === "/" || currentPath === "") {
          let target = "/home";

          if (analyzerActive) {
            target = "/analyzer/runtime";
          } else if (interceptorActive) {
            target = "/interceptor";
          } else {
            const saved = prevMap[tabId];
            if (typeof saved === "string" && saved.trim()) {
              target = saved;
            } else {
              // No previous route -> default to "/home"
              target = "/home";
            }
          }

          // Avoid infinite loops: only navigate if target differs from current
          if (!cancelled && target !== currentFull) {
            navigate(target, { replace: true });
          }
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location, navigate]);

  return null;
}
