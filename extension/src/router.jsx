import { useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import App from "./app";
import Analyzer from "./sections/analyzer/page/analyzer";
import ArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/archive";
import OneTimeScanAnalyzer from "./sections/analyzer/page/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanAnalyzer from "./sections/analyzer/page/subpages/runtimeScan/runtimeScan";
import OneTimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/runtimeScan/runtimeScan";
import TechStack from "./sections/techstack/page/techstack";
import Home from "./sections/home/home";
import ArchiveTechStack from "./sections/techstack/page/subpages/archive/archive";
import ScanTechStack from "./sections/techstack/page/subpages/scan/scan";
import browser from "webextension-polyfill";
import analyzerReactController from "./sections/analyzer/analyzerController";
import Interceptor from "./sections/interceptor/page/interceptor";
import RuntimeScanInterceptor from "./sections/interceptor/page/subpages/runtimeScan/runtimeScan";
import SendToOntologyInterceptor from "./sections/interceptor/page/subpages/sendToOntology/sendToOntology";
import ArchiveInterceptor from "./sections/interceptor/page/subpages/archive/archive";
import interceptorReactController from "./sections/interceptor/interceptorController";
import AnalyzeAnalyzer from "./sections/analyzer/page/subpages/analyze/analyze";
import AnalyzeTechstack from "./sections/techstack/page/subpages/analyze/analyze";
import SendOneTimeScanAnalyzer from "./sections/analyzer/page/subpages/analyze/subpages/oneTimeScan/oneTimeScan";
import SendRuntimeScanAnalyzer from "./sections/analyzer/page/subpages/analyze/subpages/runtimeScan/runtimeScan";

function RestoreOrHome() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let target = "/home";

      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;

        const statusAnalyzer = await analyzerReactController.getScanStatus().catch(() => null);
        const analyzerActive = !!(statusAnalyzer?.runtimeActive || statusAnalyzer?.active);

        const statusInterceptor = await interceptorReactController.getStatus().catch(() => null);
        const interceptorActive = !!statusInterceptor?.active;

        if (analyzerActive) {
          target = "/analyzer/runtime";
        } else if (interceptorActive) {
          target = "/interceptor";
        } else {
          const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
          const map = obj?.ui_lastRoute_byTab ?? {};
          const saved = tabId != null ? map[tabId] : null;

          if (typeof saved === "string" && saved.trim()) {
            target = saved;
          } else {
            target = "/home";
            if (tabId != null) {
              map[tabId] = target;
              await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});
            }
          }
        }

        if (tabId != null) {
          const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
          const map = obj?.ui_lastRoute_byTab ?? {};
          map[tabId] = target;
          await browser.storage.session.set({ ui_lastRoute_byTab: map }).catch(() => {});
        }
      } catch {
        target = "/home";
      } finally {
        if (!cancelled) {
          navigate(target, { replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return null;
}

function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<RestoreOrHome />} />

        <Route path="home" element={<Home />} />
        <Route path="analyzer" element={<Analyzer />}>
          <Route index element={<OneTimeScanAnalyzer />} />
          <Route path="runtime" element={<RuntimeScanAnalyzer />} />
          <Route path="analyze" element={<AnalyzeAnalyzer />} >
            <Route index element={<SendOneTimeScanAnalyzer />} />
            <Route path="onetime" element={<SendOneTimeScanAnalyzer />} />
            <Route path="runtime" element={<SendRuntimeScanAnalyzer />} />
          </Route>
          <Route path="archive" element={<ArchiveAnalyzer />}>
            <Route index element={<OneTimeScanArchiveAnalyzer />} />
            <Route path="onetime" element={<OneTimeScanArchiveAnalyzer />} />
            <Route path="runtime" element={<RuntimeScanArchiveAnalyzer />} />
          </Route>
        </Route>

        <Route path="techstack" element={<TechStack />} >
          <Route index element={<ScanTechStack />} />
          <Route path="analyze" element={<AnalyzeTechstack />} />
          <Route path="archive" element={<ArchiveTechStack />} />
        </Route>

        <Route path="interceptor" element={<Interceptor /> } >
          <Route index element={ <RuntimeScanInterceptor />} />
          <Route path="send" element={<SendToOntologyInterceptor />} />
          <Route path="archive" element={<ArchiveInterceptor />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default Router;
