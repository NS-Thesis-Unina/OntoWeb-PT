import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import browser from "webextension-polyfill";

export default function RoutePersistence() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;
        if (tabId == null) return;

        const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
        const map = obj?.ui_lastRoute_byTab ?? {};

        map[tabId] = location.pathname + (location.search || "");

        await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});

        if (cancelled) return;
      } catch (e) {
        // ignore
      }
    })();

    return () => { cancelled = true; };
  }, [location]);

  return null;
}
