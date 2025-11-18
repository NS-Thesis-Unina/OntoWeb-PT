import './interceptor.css';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PageNavigation from '../../../components/pageNavigation/pageNavigation';
import Button from '@mui/material/Button';
import { selectedSubSection } from '../../../libs/navigation';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import { useEffect, useState } from 'react';

/**
 * **Interceptor**
 *
 * Architectural Role:
 *   React UI → Interceptor React Controller → Background (Interceptor Engine)
 *
 * Purpose:
 *   This component provides the main UI navigation structure for the
 *   Interceptor module. It renders a top-level page wrapper containing:
 *     - Navigation buttons (Runtime Scan, Send to Ontology, Archive)
 *     - A dynamic subsection title
 *     - The <Outlet /> where child routes are rendered
 *
 * Responsibilities:
 *   - Detect current route from React Router (via `pathname`)
 *   - Map the route to a subsection label for UI context
 *   - Render a consistent navigation header using <PageNavigation />
 *   - Provide navigation buttons whose disabled state reflects the active route
 *
 * Important Notes:
 *   - This component does not execute any interception logic.
 *   - Actual runtime scanning, archiving, and ontology submission steps
 *     are implemented in child pages routed via <Outlet />.
 *   - This file only manages layout and navigation for the Interceptor domain.
 */
function Interceptor() {
  const navigate = useNavigate();

  // React Router current route
  const { pathname } = useLocation();

  // UI subsection displayed beside the main title
  const [subsection, setSubsection] = useState('');

  /**
   * Detect subsection from route path
   * ---------------------------------------------------------
   * Mapping:
   *   /interceptor              → "Runtime Scan"
   *   /interceptor/send         → "Send to Ontology"
   *   /interceptor/archive      → "Archive"
   *
   * The subsection label is displayed in PageNavigation for clarity.
   */
  useEffect(() => {
    switch (pathname) {
      case '/interceptor/archive': {
        setSubsection('Archive');
        break;
      }
      case '/interceptor/send': {
        setSubsection('Send to Ontology');
        break;
      }
      default:
        setSubsection('Runtime Scan');
    }
  }, [pathname]);

  /**
   * UI Rendering
   * ---------------------------------------------------------
   * - PageNavigation renders a top bar with:
   *     • Title ("Interceptor")
   *     • Icon (PodcastsIcon)
   *     • Current subsection
   *     • Navigation buttons (as children)
   *
   * - <Outlet /> renders the nested child route:
   *     • Runtime Scan (default)
   *     • Send to Ontology
   *     • Archive
   */
  return (
    <div className="interceptor-div">
      <PageNavigation title={'Interceptor'} icon={<PodcastsIcon />} subsection={subsection}>
        {/* Runtime Scan */}
        <Button
          disabled={selectedSubSection(pathname, 'interceptor', '')}
          onClick={() => navigate('/interceptor')}
        >
          Runtime Scan
        </Button>

        {/* Send To Ontology */}
        <Button
          disabled={selectedSubSection(pathname, 'interceptor', 'send')}
          onClick={() => navigate('/interceptor/send')}
        >
          Send to ontology
        </Button>

        {/* Archive */}
        <Button
          disabled={selectedSubSection(pathname, 'interceptor', 'archive')}
          onClick={() => navigate('/interceptor/archive')}
        >
          Archive
        </Button>
      </PageNavigation>

      {/* Child route content */}
      <Outlet />
    </div>
  );
}

export default Interceptor;
