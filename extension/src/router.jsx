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

function RestoreOrHome() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // obtain active tab in current window
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;

        // read session map
        const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
        const map = obj?.ui_lastRoute_byTab ?? {};

        const route = tabId != null ? map[tabId] : null;

        if (cancelled) return;
        if (route) {
          // saved route: navigate to
          navigate(route, { replace: true });
        } else {
          // fallback to home
          navigate("/home", { replace: true });
        }
      } catch (e) {
        // in case of error fallback to home
        try { navigate("/home", { replace: true }); } catch {}
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
          <Route path="archive" element={<ArchiveAnalyzer />}>
            <Route index element={<OneTimeScanArchiveAnalyzer />} />
            <Route path="onetime" element={<OneTimeScanArchiveAnalyzer />} />
            <Route path="runtime" element={<RuntimeScanArchiveAnalyzer />} />
          </Route>
        </Route>

        <Route path="techstack" element={<TechStack />} >
          <Route index element={<ScanTechStack />} />
          <Route path="archive" element={<ArchiveTechStack />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default Router;
