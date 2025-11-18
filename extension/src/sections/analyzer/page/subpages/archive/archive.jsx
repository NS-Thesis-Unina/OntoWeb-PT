import './archive.css';
import { Button } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SubPageNavigation from '../../../../../components/subPageNavigation/subPageNavigation';

/**
 * **ArchiveAnalyzer**
 *
 * Architectural Role:
 *   Analyzer → Archive → Entry Router Component
 *
 * Purpose:
 *   This component acts as the top-level container for the Analyzer’s Archive
 *   subsection. It provides:
 *     - Local navigation between the two archive modes:
 *         • One-Time Scan archive
 *         • Runtime Scan archive
 *     - A layout wrapper (via <SubPageNavigation> and <Outlet>)
 *
 * Behavior:
 *   - The component inspects the current route (pathname) to determine
 *     which subsection is active.
 *   - Buttons in the sub-navigation disable themselves when the user
 *     is already viewing the corresponding archive.
 *   - Navigation is handled using react-router's `navigate()` with
 *     relative paths ("onetime" and "runtime").
 *
 * Rendering Responsibility:
 *   - This component only renders its own navigation and delegates
 *     the actual archive content to the nested <Outlet />.
 */
function ArchiveAnalyzer() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Determine active subsection based on the current URL.
   * A URL ending with "/archive" defaults to the One-Time Scan archive.
   */
  const isOnetime =
    location.pathname.includes('/archive/onetime') || location.pathname.endsWith('/archive');

  const isRuntime = location.pathname.includes('/archive/runtime');

  return (
    <div className="archiveAnalyzer-div">
      {/* -------------------------------------------- */}
      {/* Sub-section navigation bar (One-Time / Runtime) */}
      {/* -------------------------------------------- */}
      <SubPageNavigation>
        <Button disabled={isOnetime} onClick={() => navigate('onetime')}>
          One-Time Scan
        </Button>

        <Button disabled={isRuntime} onClick={() => navigate('runtime')}>
          Runtime Scan
        </Button>
      </SubPageNavigation>

      {/* Outlet for nested archive pages */}
      <Outlet />
    </div>
  );
}

export default ArchiveAnalyzer;
