import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

function DeleteScanDialog({open, setOpen, deleteFn, allScans = false}){

  const onClickCancel = () => {
    setOpen(false);
  }

  const onClickDelete = () => {
    deleteFn();
    setOpen(false);
  }

  return(
    <Dialog open={open} onClose={onClickCancel}>
      <DialogTitle>
        Confirm Delete {allScans && "All"} Scan
      </DialogTitle>
      <DialogContent>
        <Typography>
        {!allScans ? 
          "Are you sure you want to delete this scan? This action cannot be undone."
          :
          "Are you sure you want to delete all scans? This action cannot be undone."
        }
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClickCancel}>
          Cancel
        </Button>
        <Button color="error" onClick={onClickDelete}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )

}

export default DeleteScanDialog;