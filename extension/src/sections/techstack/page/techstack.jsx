import './techstack.css';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PageNavigation from '../../../components/pageNavigation/pageNavigation';
import Button from '@mui/material/Button';
import { selectedSubSection } from '../../../libs/navigation';
import LayersIcon from '@mui/icons-material/Layers';
import { useEffect, useState } from 'react';

/**
 * **TechStack Page (Top-Level Section)**
 *
 * This component provides the main layout and navigation for the
 * "Technology Stack" section of the extension popup.
 *
 * Architectural Responsibilities:
 * - Renders the shared page container for all TechStack subpages
 *   (Scan, Analyze, Archive).
 * - Displays a horizontal navigation bar (via PageNavigation) with
 *   three section tabs:
 *      • Scan      → /techstack
 *      • Analyze   → /techstack/analyze
 *      • Archive   → /techstack/archive
 *
 * - Tracks the current router pathname and maps it to a human-readable
 *   subsection label ("Scan", "Analyze", "Archive").
 *
 * Interaction With Router:
 * - On navigation (pathname change), updates local subsection
 *   state to reflect the active sub-route.
 * - Uses the router's `<Outlet />` to render the correct nested page.
 *
 * Notes:
 * - This component serves only as a container + navigation shell.
 * - Actual scanning, analysis logic, and archive management are
 *   implemented in the nested subpages rendered by <Outlet />.
 */
function TechStack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Tracks which subsection is currently active ("Scan", "Analyze", "Archive")
  const [subsection, setSubsection] = useState('');

  /**
   * Whenever the pathname changes, determine which subsection
   * label should be displayed at the top of the page.
   */
  useEffect(() => {
    switch (pathname) {
      case '/techstack/archive': {
        setSubsection('Archive');
        break;
      }
      case '/techstack/analyze': {
        setSubsection('Analyze');
        break;
      }
      default:
        setSubsection('Scan');
    }
  }, [pathname]);

  return (
    <div className="techstack-div">
      {/* ------------------------------------------------------------
          Page Header + Top Navigation (Scan / Analyze / Archive)
         ------------------------------------------------------------ */}
      <PageNavigation title={'Technology Stack'} icon={<LayersIcon />} subsection={subsection}>
        {/* Scan button (default subsection) */}
        <Button
          disabled={selectedSubSection(pathname, 'techstack', '')}
          onClick={() => navigate('/techstack')}
        >
          Scan
        </Button>

        {/* Analyze button */}
        <Button
          disabled={selectedSubSection(pathname, 'techstack', 'analyze')}
          onClick={() => navigate('/techstack/analyze')}
        >
          Analyze
        </Button>

        {/* Archive button */}
        <Button
          disabled={selectedSubSection(pathname, 'techstack', 'archive')}
          onClick={() => navigate('/techstack/archive')}
        >
          Archive
        </Button>
      </PageNavigation>

      {/* Render the selected subpage (Scan, Analyze, Archive) */}
      <Outlet />
    </div>
  );
}

export default TechStack;
