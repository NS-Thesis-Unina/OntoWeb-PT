import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import browser from "webextension-polyfill";
import analyzerReactController from "./sections/analyzer/analyzerController";
import interceptorReactController from "./sections/interceptor/interceptorController";

export default function RoutePersistence() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;
        if (tabId == null) return;

        const statusAnalyzer = await analyzerReactController.getScanStatus().catch(() => null);
        const analyzerActive = !!(statusAnalyzer?.runtimeActive || statusAnalyzer?.active);

        const statusInterceptor = await interceptorReactController.getStatus().catch(() => null);
        const interceptorActive = !!statusInterceptor?.active;

        const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
        const map = obj?.ui_lastRoute_byTab ?? {};

        if (analyzerActive) {
          map[tabId] = "/analyzer/runtime";
        } else if (interceptorActive) {
          map[tabId] = "/interceptor";
        } else {
          map[tabId] = (location.pathname || "/home") + (location.search || "");
        }

        await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});

        if (cancelled) return;
      } catch {
        // ignore
      }
    })();

    return () => { cancelled = true; };
  }, [location]);

  return null;
}
