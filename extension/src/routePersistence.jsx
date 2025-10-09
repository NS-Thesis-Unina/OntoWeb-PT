import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import browser from "webextension-polyfill";
import analyzerReactController from "./sections/analyzer/analyzerController";

export default function RoutePersistence() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;
        if (tabId == null) return;

        const status = await analyzerReactController.getScanStatus().catch(() => null);
        const isActive = !!(status?.runtimeActive || status?.active);

        const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
        const map = obj?.ui_lastRoute_byTab ?? {};

        if (isActive) {
          map[tabId] = "/analyzer/runtime";
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
