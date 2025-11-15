import { Divider, Grid, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import "./runtimeScanResults.css";
import OneTimeScanResults from "../oneTimeScanResults/oneTimeScanResults";
import Collapsible from "../../../../../../components/collapsible/collapsible";
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteScanDialog from "../../../../../../components/deleteScanDialog/deleteScanDialog";
import { useState } from "react";

function RuntimeScanResults({results, titleDisabled = false, deleteDisable = true, deleteScan}){

  const [openDeleteScan, setOpenDeleteScan] = useState(false);

  return(
    <Paper className="rt-scanresults">
      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Runtime Scan Results
          </Typography>
        )}
        <div className="rt-options">
          {!deleteDisable && (
            <Tooltip title={"Delete Scan"} >
              <IconButton variant="contained" size="small" onClick={() => setOpenDeleteScan(true)}>
                <DeleteIcon />
              </IconButton>
          </Tooltip>
          )}
        </div>
        <DeleteScanDialog open={openDeleteScan} setOpen={setOpenDeleteScan} deleteFn={deleteScan} />
      </div>
      
      {!titleDisabled && (<Divider orientation="horizontal" />)}
      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}>
            <strong>Started at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Stopped at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Page count</strong>
          </Grid>
          <Grid size={3}>
            <strong>Total scans</strong>
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {new Date(results.run.startedAt).toLocaleString()}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {new Date(results.run.stoppedAt).toLocaleString()}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.pagesCount}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.totalScans}
          </Grid>
        </Grid>
      </Paper>
      {
        Object.entries(results.run.dataset).map(([url, scans]) => (
            <Collapsible key={url} defaultOpen={false} title={url}>
            {Array.isArray(scans) && scans.map((scan, index) => (
              <Collapsible key={index} title={`Navigate ${index+1}`} defaultOpen={false}>
                <OneTimeScanResults titleDisabled results={scan} />
              </Collapsible>
            ))}
            </Collapsible>
        )
      )}
    </Paper>
  )
}

export default RuntimeScanResults;
