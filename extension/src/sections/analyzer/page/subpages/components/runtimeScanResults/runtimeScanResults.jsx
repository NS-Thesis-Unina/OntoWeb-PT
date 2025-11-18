import './runtimeScanResults.css';
import { Divider, Grid, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import OneTimeScanResults from '../oneTimeScanResults/oneTimeScanResults';
import Collapsible from '../../../../../../components/collapsible/collapsible';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteScanDialog from '../../../../../../components/deleteScanDialog/deleteScanDialog';
import { useState } from 'react';

/**
 * **RuntimeScanResults**
 *
 * Architectural Role:
 *   Analyzer → Runtime Scan → Results Viewer
 *
 * Purpose:
 *   Renders the results from an Analyzer Runtime Scan. A runtime scan captures
 *   multiple DOM snapshots over time as the user navigates pages. This
 *   component presents:
 *
 *     - High-level metadata (startedAt, stoppedAt, totals)
 *     - Per–page URL grouping
 *     - Per–navigation One-Time Scan results (each snapshot)
 *
 * Responsibilities:
 *   - Group and render structured runtime scan results
 *   - Delegate snapshot visualization to <OneTimeScanResults />
 *   - Provide optional deletion of the scan (Archive context)
 *
 * Props:
 *   - results         : { key, run } object returned by the controller
 *   - titleDisabled   : hide main section title (used inside nested displays)
 *   - deleteDisable   : disable/hide delete button
 *   - deleteScan      : callback invoked when the user confirms deletion
 *
 * Interactions:
 *   - DeleteScanDialog: orchestrates user confirmation for scan removal
 *   - Collapsible: UI grouping and folding for each URL and scan sequence
 *   - OneTimeScanResults: render each individual page snapshot
 */
function RuntimeScanResults({ results, titleDisabled = false, deleteDisable = true, deleteScan }) {
  /** Dialog state for scan deletion confirmation */
  const [openDeleteScan, setOpenDeleteScan] = useState(false);

  return (
    <Paper className="rt-scanresults">
      {/* Title + optional delete action */}
      <div className="title">
        {!titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">Runtime Scan Results</Typography>
        )}

        <div className="rt-options">
          {!deleteDisable && (
            <Tooltip title={'Delete Scan'}>
              <IconButton variant="contained" size="small" onClick={() => setOpenDeleteScan(true)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </div>

        {/* Deletion confirmation modal */}
        <DeleteScanDialog open={openDeleteScan} setOpen={setOpenDeleteScan} deleteFn={deleteScan} />
      </div>

      {/* Divider under title (only if title is shown) */}
      {!titleDisabled && <Divider orientation="horizontal" />}

      {/* High-level metadata block */}
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

      {/* Dataset grouped by URL
          results.run.dataset = {
            "https://example.com/": [ scan1, scan2, scan3, ... ],
            "https://other.com/":  [ scan1, ... ],
          }
      */}
      {Object.entries(results.run.dataset).map(([url, scans]) => (
        <Collapsible key={url} defaultOpen={false} title={url}>
          {Array.isArray(scans) &&
            scans.map((scan, index) => (
              <Collapsible key={index} title={`Navigate ${index + 1}`} defaultOpen={false}>
                {/* Each navigation snapshot is a full One-Time Scan result */}
                <OneTimeScanResults titleDisabled results={scan} />
              </Collapsible>
            ))}
        </Collapsible>
      ))}
    </Paper>
  );
}

export default RuntimeScanResults;
