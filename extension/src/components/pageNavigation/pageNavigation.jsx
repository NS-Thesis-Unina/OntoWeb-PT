import './pageNavigation.css';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { Slide } from '@mui/material';

/**
 * **PageNavigation**
 *
 * This component renders the main page-level navigation header used across
 * top-level sections of the UI (Analyzer, TechStack, Interceptor, etc.).
 *
 * Features:
 * - Animated appearance using MUI’s <Slide /> transition.
 * - Displays:
 *   • a section icon,
 *   • a main title,
 *   • an optional subsection label,
 *   • an actions/options area rendered via `children`.
 * - Used as a reusable banner/navigation block that provides contextual
 *   page identity and top-level actions (scan controls, filtering, etc.).
 *
 * Layout Notes:
 * - The header is wrapped in MUI <Paper /> for clean separation from content.
 * - Vertical divider appears only when `subsection` is provided.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Action buttons or controls displayed in the header.
 * @param {string} props.title - Main section title.
 * @param {React.ReactNode} props.icon - Visual icon for the section.
 * @param {string} [props.subsection] - Optional subsection label.
 */
function PageNavigation({ children, title, icon, subsection }) {
  return (
    <Slide in={true} timeout={200} direction="down">
      <Paper className="pageNavigation-div">
        {/* Section Icon */}
        <div className="icon">{icon}</div>

        {/* Main Title */}
        <div className="title">
          <Typography fontWeight="bold" variant="h5">
            {title}
          </Typography>
        </div>

        {/* Optional Subsection Divider */}
        {subsection && <Divider orientation="vertical" className="divider" />}

        {/* Optional Subsection Title */}
        <div className="subsection">
          <Typography fontWeight="bold" variant="h6">
            {subsection}
          </Typography>
        </div>

        {/* Right-side Options / Controls */}
        <Stack
          className="options"
          direction="row"
          spacing={0}
          divider={<Divider orientation="vertical" flexItem />}
        >
          {children}
        </Stack>
      </Paper>
    </Slide>
  );
}

export default PageNavigation;
