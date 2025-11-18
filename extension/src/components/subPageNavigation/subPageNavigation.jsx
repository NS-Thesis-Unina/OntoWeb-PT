import './subPageNavigation.css';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { Slide } from '@mui/material';

/**
 * **SubPageNavigation**
 *
 * A compact navigation header used specifically for sub-pages within a section
 * (e.g. switching between One-Time Scan / Runtime Scan / Archive views).
 *
 * Features:
 * - Animated entry using MUI’s <Slide /> transition.
 * - Provides a row of buttons or actions passed via `children`.
 * - Uses a minimal MUI <Paper /> container to visually group navigation items.
 *
 * This component complements <PageNavigation /> and is typically positioned
 * directly below it, providing secondary navigation for nested pages.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Sub-navigation buttons or controls.
 */
function SubPageNavigation({ children }) {
  return (
    <Slide in={true} timeout={300} direction="down">
      <Paper className="subPageNavigation-div">
        {/* Navigation buttons with vertical dividers */}
        <Stack
          className="buttons"
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

export default SubPageNavigation;
