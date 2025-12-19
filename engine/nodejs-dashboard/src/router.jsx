/**
 * Application Router
 *
 * Defines the full client-side routing map of the app using React Router.
 * The <App /> component serves as the top-level layout (navigation + content),
 * while each route renders a dedicated feature page inside its <Outlet />.
 *
 * Architectural Notes:
 * - All pages live under the root layout at "/".
 * - The "findings" section exposes nested routes for the different sources
 *   of findings (Techstack, Analyzer, HTTP).
 * - URLs are human-readable and reflect the product surface:
 *     /home, /http-requests, /findings, /server-status, /send-pcap, /openapi
 *
 * Navigation:
 * - <Home /> is accessible at both "/" and "/home" for convenience.
 * - <TechstackFindings /> is the default child of "/findings".
 */

import { Routes, Route } from 'react-router-dom';
import Home from './pages/home/home';
import OpenAPI from './pages/openApi/openApi';
import App from './app';
import HttpRequests from './pages/httpRequests/httpRequests';
import HttpFindings from './pages/findings/httpFindings/httpFindings';
import AnalyzerFindings from './pages/findings/analyzerFindings/analyzerFindings';
import TechstackFindings from './pages/findings/techstackFindings/techstackFindings';
import SendPcap from './pages/sendPcap/sendPcap';
import ToolStatus from './pages/toolStatus/toolStatus';

/**
 * Router Component
 *
 * Renders the route tree for the entire UI. Uses a root layout (<App />)
 * and nested routes for feature areas and their sub-pages.
 *
 * @returns {JSX.Element} The application routing structure.
 */
function Router() {
  return (
    <Routes>
      {/* Root layout wrapper (navigation, theme, shell, etc.) */}
      <Route path="/" element={<App />}>
        {/* -------- Home -------- */}
        {/* Default landing route */}
        <Route index element={<Home />} />
        {/* Explicit alias for clarity and deep links */}
        <Route path="home" element={<Home />} />

        {/* -------- HTTP Requests -------- */}
        {/* Live/request history views for HTTP traffic */}
        <Route path="http-requests" element={<HttpRequests />} />

        {/* -------- Findings -------- */}
        {/* Aggregated results from different engines/sources */}
        <Route path="findings">
          {/* Default: Tech stack detection findings*/}
          <Route index element={<TechstackFindings />} />
          {/* Analyzer-specific findings */}
          <Route path="analyzer" element={<AnalyzerFindings />} />
          {/* HTTP Findings overview */}
          <Route path="http" element={<HttpFindings />} />
        </Route>

        {/* -------- Tooling / Utilities -------- */}
        {/* Backend/process health & statuses */}
        <Route path="server-status" element={<ToolStatus />} />
        {/* Upload and dispatch PCAPs for processing */}
        <Route path="send-pcap" element={<SendPcap />} />
        {/* OpenAPI viewer or contract-driven workflows */}
        <Route path="openapi" element={<OpenAPI />} />
      </Route>
    </Routes>
  );
}

export default Router;
