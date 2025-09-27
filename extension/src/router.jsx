import React, { useEffect } from "react";
import { Route, Routes, Navigate, useNavigate } from "react-router-dom";
import App from "./app";
import Analyzer from "./sections/analyzer/page/analyzer";
import ArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/archive";
import OneTimeScanAnalyzer from "./sections/analyzer/page/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanAnalyzer from "./sections/analyzer/page/subpages/runtimeScan/runtimeScan";
import OneTimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/runtimeScan/runtimeScan";

// TechStack
import TechStack from "./sections/techstack/page/techstack";
import Home from "./sections/home/home";
import ArchiveTechStack from "./sections/techstack/page/subpages/archive/archive";
import ScanTechStack from "./sections/techstack/page/subpages/scan/scan";

import browser from "webextension-polyfill";

/**
 * RestoreOrHome component:
 * - legge il tab corrente
 * - cerca in session storage la route salvata per quel tab
 * - se la trova naviga verso quella route, altrimenti naviga a "home"
 *
 * Ritorna null perché la navigazione avverrà subito via useEffect.
 */
function RestoreOrHome() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ottieni tab attivo nella finestra corrente
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;

        // leggi mappa sessione
        const obj = await browser.storage.session.get("ui_lastRoute_byTab").catch(() => ({}));
        const map = obj?.ui_lastRoute_byTab ?? {};

        const route = tabId != null ? map[tabId] : null;

        if (cancelled) return;
        if (route) {
          // route salvata: naviga direttamente
          navigate(route, { replace: true });
        } else {
          // fallback a home
          navigate("/home", { replace: true });
        }
      } catch (e) {
        // in caso di errore fallback a home
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
        {/* index ora prova a ripristinare la route salvata, altrimenti home */}
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
