import './drawerWrapper.css';
import { Backdrop, CircularProgress, Divider, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * **Component: DrawerWrapper**
 *
 * Purpose:
 *   Generic right-anchored drawer with a sticky header, a title, and a close button.
 *   Used across the app to display detail views (e.g., request/finding details).
 *
 * Behavior:
 *   - Shows a loading spinner when `loading` is true; otherwise renders `children`.
 *   - Clicking the close icon or the backdrop will invoke `setOpen(false)`.
 *
 * Props:
 *   @param {boolean} open      Control whether the drawer is visible.
 *   @param {Function} setOpen  Setter called to close the drawer (setOpen(false)).
 *   @param {boolean} loading   When true, hides content and shows a centered spinner.
 *   @param {string}  title     Header title text.
 */
function DrawerWrapper({ children, open, setOpen, loading, title }) {
  return (
    <Drawer open={open} anchor="right" className="drawerwrapper" onClose={() => setOpen(false)}>
      <div className="content">
        {/* Header with title and a close action */}
        <div className="title-div">
          <Typography variant="h6" className="title">
            {title}
          </Typography>
          <div className="actions">
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>

        <Divider style={{ width: '100%' }} />

        {/* Content area: either render children or a loading indicator */}
        {!loading && children}
        {loading && (
          <div className="loading">
            <CircularProgress />
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default DrawerWrapper;
