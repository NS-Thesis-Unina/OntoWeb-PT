import browser from "webextension-polyfill";
import AnalyzerBackgroundController from "./src/background/analyzerController.js";
import TechStackBackgroundController from "./src/background/techstackController.js";
import InterceptorBackgroundController from "./src/background/interceptorController.js";

browser.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
    const map = obj?.ui_lastRoute_byTab ?? {};
    const key = String(tabId);
    if (map && Object.prototype.hasOwnProperty.call(map, key)) {
      delete map[key];
      await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});
      console.debug("[background] cleaned ui_lastRoute_byTab for tab", key);
    }
  } catch (e) {
    console.warn("[background] failed to prune ui_lastRoute_byTab", e);
  }
});

new AnalyzerBackgroundController();
new TechStackBackgroundController();
new InterceptorBackgroundController();