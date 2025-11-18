import './analyzer.css';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PageNavigation from '../../../components/pageNavigation/pageNavigation';
import { selectedSubSection } from '../../../libs/navigation';
import { Button } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { useEffect, useState } from 'react';

/**
 * **Component: Analyzer**
 *
 * Architectural Role:
 *   Root-level wrapper for all Analyzer-related features.
 *
 *   Analyzer → (One-Time Scan | Runtime Scan | Analyze | Archive)
 *   This component provides:
 *     - The persistent top navigation bar for the Analyzer section.
 *     - Route switching via <Outlet />.
 *     - Automatic subsection detection based on the current URL.
 *
 * Responsibilities:
 *   - Determine the active subsection by observing the router pathname.
 *   - Render the Analyzer page navigation (buttons + icon + title).
 *   - Enable or disable navigation buttons based on the active route.
 *   - Host nested sub-routes rendered through <Outlet />.
 *
 * UX Considerations:
 *   - Each subsection has its own logic and UI, but all share this parent
 *     structure for consistency.
 *   - Button disabled states are computed through `selectedSubSection()` to
 *     ensure consistent navigation behavior across the app.
 */
function Analyzer() {
  /** Router helpers */
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /** Name of the subsection displayed inside PageNavigation */
  const [subsection, setSubsection] = useState('');

  /**
   * Sync subsection label with current URL.
   * Ensures the navigation header always reflects the selected Analyzer feature.
   */
  useEffect(() => {
    if (pathname === '/analyzer/runtime') {
      setSubsection('Runtime Scan');
    } else if (pathname.startsWith('/analyzer/archive')) {
      setSubsection('Archive');
    } else if (pathname.startsWith('/analyzer/analyze')) {
      setSubsection('Analyze');
    } else {
      // Default for the base route /analyzer
      setSubsection('One-Time Scan');
    }
  }, [pathname]);

  return (
    <div className="analyzer-div">
      {/* Top navigation bar for Analyzer subsections */}
      <PageNavigation title={'Analyzer'} icon={<AnalyticsIcon />} subsection={subsection}>
        {/* Navigation buttons for the 4 Analyzer modules */}
        <Button
          disabled={selectedSubSection(pathname, 'analyzer', '')}
          onClick={() => navigate('/analyzer')}
        >
          One-Time Scan
        </Button>

        <Button
          disabled={selectedSubSection(pathname, 'analyzer', 'runtime')}
          onClick={() => navigate('/analyzer/runtime')}
        >
          Runtime Scan
        </Button>

        <Button
          disabled={selectedSubSection(pathname, 'analyzer', 'analyze')}
          onClick={() => navigate('/analyzer/analyze')}
        >
          Analyze
        </Button>

        <Button
          disabled={selectedSubSection(pathname, 'analyzer', 'archive')}
          onClick={() => navigate('/analyzer/archive')}
        >
          Archive
        </Button>
      </PageNavigation>

      {/* Nested routes rendered here */}
      <Outlet />
    </div>
  );
}

export default Analyzer;
