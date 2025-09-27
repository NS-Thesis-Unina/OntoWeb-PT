import { Route, Routes, Navigate } from "react-router-dom";
import App from "./app";
import Analyzer from "./sections/analyzer/page/analyzer";
import ArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/archive";
import OneTimeScanAnalyzer from "./sections/analyzer/page/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanAnalyzer from "./sections/analyzer/page/subpages/runtimeScan/runtimeScan";
import OneTimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/runtimeScan/runtimeScan";

// Analyzer
import Analyzer from "./sections/analyzer/page/analyzer";
import ArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/archive";
import OneTimeScanAnalyzer from "./sections/analyzer/page/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanAnalyzer from "./sections/analyzer/page/subpages/runtimeScan/runtimeScan";
import OneTimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/oneTimeScan/oneTimeScan";
import RuntimeScanArchiveAnalyzer from "./sections/analyzer/page/subpages/archive/subpages/runtimeScan/runtimeScan";

// TechStack
import TechStack from "./sections/techstack/page/techstack";
import Home from "./sections/home/home";

function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Navigate to="home" replace />} />
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
        <Route path="techstack" element={<TechStack />} />
      </Route>
    </Routes>
  );
}

export default Router;
