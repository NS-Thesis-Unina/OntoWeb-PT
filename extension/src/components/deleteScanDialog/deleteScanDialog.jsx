import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

/**
 * **DeleteScanDialog**
 *
 * Reusable confirmation dialog used across the UI (Analyzer, TechStack, etc.)
 * when deleting either:
 * - a single scan, or
 * - all scans (bulk delete mode).
 *
 * Behavioral Notes:
 * - The deletion logic is external (`deleteFn`) to keep this component generic.
 * - The dialog closes automatically after the action.
 *
 * @param {Object} props
 * @param {boolean} props.open - Controls dialog visibility.
 * @param {(v: boolean) => void} props.setOpen - Setter to toggle dialog state.
 * @param {Function} props.deleteFn - Callback executed on delete confirmation.
 * @param {boolean} [props.allScans=false] - If true, performs a bulk delete.
 */
function DeleteScanDialog({ open, setOpen, deleteFn, allScans = false }) {
  const onClickCancel = () => {
    setOpen(false);
  };

  const onClickDelete = () => {
    deleteFn();
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={onClickCancel}>
      <DialogTitle>Confirm Delete {allScans && 'All'} Scan</DialogTitle>

      <DialogContent>
        <Typography>
          {!allScans
            ? 'Are you sure you want to delete this scan? This action cannot be undone.'
            : 'Are you sure you want to delete all scans? This action cannot be undone.'}
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClickCancel}>Cancel</Button>
        <Button color="error" onClick={onClickDelete}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteScanDialog;
