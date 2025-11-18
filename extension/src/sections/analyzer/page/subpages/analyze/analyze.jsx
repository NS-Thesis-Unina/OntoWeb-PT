import './analyze.css';
import { Button } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SubPageNavigation from '../../../../../components/subPageNavigation/subPageNavigation';

/**
 * **AnalyzeAnalyzer**
 *
 * Architectural Role:
 *   Analyzer → Analyze → Section Router
 *
 * Purpose:
 *   This component acts as the **container and router outlet** for the "Analyze"
 *   feature of the Analyzer module. The Analyze section provides tools for
 *   post-processing already stored scan results (One-Time or Runtime).
 *
 * Responsibilities:
 *   • Detect which sub-route is currently active (onetime / runtime)
 *   • Render the sub-navigation bar for the Analyze section
 *   • Ensure correct button disabling and navigation behavior
 *   • Provide a routing outlet for nested Analyze pages
 *
 * UX Notes:
 *   • Buttons behave like tabs: disabled when already on the corresponding page
 *   • Route `/analyzer/analyze` defaults to "One-Time Scan"
 *
 * Data Flow:
 *   • React Router → useLocation determines active subroute
 *   • Navigation is performed via useNavigate
 *   • `<Outlet />` renders nested components:
 *       - AnalyzeOnetimeAnalyzer
 *       - AnalyzeRuntimeAnalyzer
 */
function AnalyzeAnalyzer() {
  /* -------------------------------------------------------------------------- */
  /* Router utilities                                                           */
  /* -------------------------------------------------------------------------- */
  const navigate = useNavigate();
  const location = useLocation();

  /* -------------------------------------------------------------------------- */
  /* Active subsection detection                                                */
  /* -------------------------------------------------------------------------- */
  const isOnetime =
    location.pathname.includes('/analyze/onetime') || location.pathname.endsWith('/analyze');

  const isRuntime = location.pathname.includes('/analyze/runtime');

  /* -------------------------------------------------------------------------- */
  /* Main UI                                                                    */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="analyzeAnalyzer-div">
      {/* ---------------------------------------------------------------------- */}
      {/* Analyze subsection navigation (One-Time / Runtime)                     */}
      {/* ---------------------------------------------------------------------- */}
      <SubPageNavigation>
        <Button disabled={isOnetime} onClick={() => navigate('onetime')}>
          One-Time Scan
        </Button>

        <Button disabled={isRuntime} onClick={() => navigate('runtime')}>
          Runtime Scan
        </Button>
      </SubPageNavigation>

      {/* ---------------------------------------------------------------------- */}
      {/* Render nested Analyze pages                                            */}
      {/* ---------------------------------------------------------------------- */}
      <Outlet />
    </div>
  );
}

export default AnalyzeAnalyzer;
