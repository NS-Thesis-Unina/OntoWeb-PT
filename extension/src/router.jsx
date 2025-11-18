/**
 * Application Router
 *
 * This file defines the full routing structure of the browser extension UI.
 * The UI is a React-based popup that uses nested routes to represent the
 * hierarchical navigation between Analyzer, TechStack, and Interceptor sections.
 *
 * Architectural Notes:
 * - Each main section (Analyzer, TechStack, Interceptor) exposes a React
 *   controller that communicates with a background controller.
 * - Nested routes allow each feature group to contain sub-pages that map to
 *   specific scanning modes, archives, or analysis tasks.
 * - The <App /> component acts as a layout wrapper that renders a top-level
 *   navigation menu and an <Outlet /> for nested views.
 *
 * This router is the entry point for the entire UI navigation flow.
 */

import { Route, Routes } from 'react-router-dom';

import App from './app';

// Analyzer pages
import Analyzer from './sections/analyzer/page/analyzer';
import AnalyzeAnalyzer from './sections/analyzer/page/subpages/analyze/analyze';
import OneTimeScanAnalyzer from './sections/analyzer/page/subpages/oneTimeScan/oneTimeScan';
import RuntimeScanAnalyzer from './sections/analyzer/page/subpages/runtimeScan/runtimeScan';
import SendOneTimeScanAnalyzer from './sections/analyzer/page/subpages/analyze/subpages/oneTimeScan/oneTimeScan';
import SendRuntimeScanAnalyzer from './sections/analyzer/page/subpages/analyze/subpages/runtimeScan/runtimeScan';

// Analyzer archive pages
import ArchiveAnalyzer from './sections/analyzer/page/subpages/archive/archive';
import OneTimeScanArchiveAnalyzer from './sections/analyzer/page/subpages/archive/subpages/oneTimeScan/oneTimeScan';
import RuntimeScanArchiveAnalyzer from './sections/analyzer/page/subpages/archive/subpages/runtimeScan/runtimeScan';

// TechStack pages
import TechStack from './sections/techstack/page/techstack';
import ScanTechStack from './sections/techstack/page/subpages/scan/scan';
import AnalyzeTechstack from './sections/techstack/page/subpages/analyze/analyze';
import ArchiveTechStack from './sections/techstack/page/subpages/archive/archive';

// Interceptor pages
import Interceptor from './sections/interceptor/page/interceptor';
import RuntimeScanInterceptor from './sections/interceptor/page/subpages/runtimeScan/runtimeScan';
import SendToOntologyInterceptor from './sections/interceptor/page/subpages/sendToOntology/sendToOntology';
import ArchiveInterceptor from './sections/interceptor/page/subpages/archive/archive';

// Home page
import Home from './sections/home/home';

/**
 * Router Component
 *
 * Defines all available routes in the application. The structure uses nested
 * routing to mirror the internal organization of the extension UI. Each section
 * contains sub-routes representing operational modes, archives, or actions.
 *
 * @returns {JSX.Element} The routing tree for the entire UI.
 */
function Router() {
  return (
    <Routes>
      {/* Root layout wrapper */}
      <Route path="/" element={<App />}>
        {/* Home */}
        <Route index element={<Home />} />
        <Route path="home" element={<Home />} />

        {/* ------------------ ANALYZER ROUTES ------------------ */}
        <Route path="analyzer" element={<Analyzer />}>
          {/* Default: One-Time Scan */}
          <Route index element={<OneTimeScanAnalyzer />} />

          {/* Runtime scan mode */}
          <Route path="runtime" element={<RuntimeScanAnalyzer />} />

          {/* Analyzer → Send to engine (One-time or Runtime) */}
          <Route path="analyze" element={<AnalyzeAnalyzer />}>
            <Route index element={<SendOneTimeScanAnalyzer />} />
            <Route path="onetime" element={<SendOneTimeScanAnalyzer />} />
            <Route path="runtime" element={<SendRuntimeScanAnalyzer />} />
          </Route>

          {/* Analyzer Archive */}
          <Route path="archive" element={<ArchiveAnalyzer />}>
            <Route index element={<OneTimeScanArchiveAnalyzer />} />
            <Route path="onetime" element={<OneTimeScanArchiveAnalyzer />} />
            <Route path="runtime" element={<RuntimeScanArchiveAnalyzer />} />
          </Route>
        </Route>

        {/* ------------------ TECHSTACK ROUTES ------------------ */}
        <Route path="techstack" element={<TechStack />}>
          {/* Default scan page */}
          <Route index element={<ScanTechStack />} />

          {/* Analyze extracted tech */}
          <Route path="analyze" element={<AnalyzeTechstack />} />

          {/* Archive of previous scans */}
          <Route path="archive" element={<ArchiveTechStack />} />
        </Route>

        {/* ------------------ INTERCEPTOR ROUTES ------------------ */}
        <Route path="interceptor" element={<Interceptor />}>
          {/* Real-time HTTP interception */}
          <Route index element={<RuntimeScanInterceptor />} />

          {/* Send captured requests to Ontology / Analyzer */}
          <Route path="send" element={<SendToOntologyInterceptor />} />

          {/* Archive of intercepted requests */}
          <Route path="archive" element={<ArchiveInterceptor />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default Router;
