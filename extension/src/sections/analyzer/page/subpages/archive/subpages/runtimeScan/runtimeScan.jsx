import './runtimeScan.css';
import {
  Backdrop,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  Zoom,
} from '@mui/material';
import Collapsible from '../../../../../../../components/collapsible/collapsible';
import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'notistack';
import analyzerReactController from '../../../../../analyzerController';
import RefreshIcon from '@mui/icons-material/Refresh';
import RuntimeScanResults from '../../../components/runtimeScanResults/runtimeScanResults';
import { formatWhen } from '../../../../../../../libs/formatting';
import DeleteScanDialog from '../../../../../../../components/deleteScanDialog/deleteScanDialog';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

/**
 * **RuntimeScanArchiveAnalyzer**
 *
 * Architectural Role:
 *   Analyzer → Archive → Runtime Scan Archive Viewer
 *
 * Purpose:
 *   Displays **all saved Runtime Scan sessions** (persisted in local storage).
 *   Each saved "run" contains:
 *     - start/stop timestamps
 *     - number of pages visited
 *     - number of scans
 *     - per-page snapshots (head/body/stats)
 *
 * Responsibilities:
 *   • Load all runtime runs from storage
 *   • Refresh when the user clicks "Refresh" or a new runtime scan finishes
 *   • Allow deletion of:
 *       - a single scan (via deleteScan)
 *       - all scans (via deleteAllScans)
 *   • Visualize each run using <RuntimeScanResults />
 *
 * UX Notes:
 *   - Archive loads automatically
 *   - States:
 *       loading   → displays Backdrop + spinner
 *       empty     → shows “No runtime snaps.”
 *       populated → each run collapsible by date/pagesCount
 *
 * Data Flow:
 *   analyzerReactController.getAllRuntimeResults() → loads archive
 *   analyzerReactController.onMessage → auto-refresh on runtime completion
 */
function RuntimeScanArchiveAnalyzer() {
  /* ------------------------------------------------------------- */
  /* Local state                                                   */
  /* ------------------------------------------------------------- */

  const [loading, setLoading] = useState(true); // Loading indicator for archive retrieval
  const [runs, setRuns] = useState([]); // Array of archived runtime sessions
  const [openDeleteAllScans, setOpenDeleteAllScans] = useState(false); // Dialog visibility for bulk delete

  /* ------------------------------------------------------------- */
  /* Load all archived runtime scans                               */
  /* ------------------------------------------------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await analyzerReactController.getAllRuntimeResults();
      setRuns(Array.isArray(list) ? list : []);
      enqueueSnackbar('Archive loaded from storage successfully!', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(e || 'Error loading snaps from storage.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  /* ------------------------------------------------------------- */
  /* Delete a specific scan by timestamp                           */
  /* ------------------------------------------------------------- */
  const deleteScan = async (timestamp) => {
    try {
      await analyzerReactController.deleteRuntimeResultById(`analyzerRuntime_${timestamp}`);
      load();
      enqueueSnackbar('Scan deleted successfully from storage.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Error deleting scan from storage.', { variant: 'error' });
    }
  };

  /* ------------------------------------------------------------- */
  /* Delete ALL runtime scans                                      */
  /* ------------------------------------------------------------- */
  const deleteAllScans = async () => {
    try {
      await analyzerReactController.clearAllRuntimeResults();
      load();
      enqueueSnackbar('All scans deleted successfully from storage.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Error deleting all scans from storage.', { variant: 'error' });
    }
  };

  /* ------------------------------------------------------------- */
  /* Initial load + auto-refresh when a runtime scan completes     */
  /* ------------------------------------------------------------- */
  useEffect(() => {
    load();

    const off = analyzerReactController.onMessage({
      onRuntimeScanComplete: () => load(),
    });

    return () => off();
  }, [load]);

  /* ------------------------------------------------------------- */
  /* Loading state UI                                              */
  /* ------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="artsanalyzer-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  /* ------------------------------------------------------------- */
  /* Main UI                                                       */
  /* ------------------------------------------------------------- */
  return (
    <div className="artsanalyzer-div">
      {/* ---------------------------------------------------------------- */}
      {/* Description of the archive’s purpose                             */}
      {/* ---------------------------------------------------------------- */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Analyzer’s Runtime Scan Archive</strong> shows a chronological list of
            runtime sessions saved to <em>local storage</em> only. Each entry includes when the run
            started and stopped, the number of total scans, and the count of unique pages captured,
            with quick access to the stored head/body snapshots and DOM stats. Use this archive to
            review past navigation sessions, compare runs, or pick up an analysis without starting a
            new scan.
          </Typography>
        </Zoom>
      </Paper>

      {/* ---------------------------------------------------------------- */}
      {/* Technical explanation of the output                             */}
      {/* ---------------------------------------------------------------- */}
      <Collapsible defaultOpen={false} title="Info Output">
        <p>
          For each visited page, the output includes the sections below and also records when the
          runtime scan was started and when it was stopped.
        </p>

        <strong>Head</strong>
        <ul className="ul">
          <li>
            <strong>title</strong>: page title.
          </li>
          <li>
            <strong>meta</strong>: metadata entries (name/property and content).
          </li>
          <li>
            <strong>links</strong>: relations and targets (stylesheet, preload…).
          </li>
          <li>
            <strong>scripts</strong>: external sources + preview of inline code.
          </li>
        </ul>

        <strong>Body</strong>
        <ul className="ul">
          <li>
            <strong>forms</strong>
          </li>
          <li>
            <strong>iframes</strong>
          </li>
          <li>
            <strong>links</strong>
          </li>
          <li>
            <strong>images</strong>
          </li>
          <li>
            <strong>videos / audios</strong>
          </li>
          <li>
            <strong>headings h1–h6</strong>
          </li>
          <li>
            <strong>lists (ul/ol)</strong>
          </li>
        </ul>

        <strong>Stats</strong>
        <ul className="ul">
          <li>
            <strong>totalElements</strong>
          </li>
          <li>
            <strong>depth</strong>
          </li>
          <li>
            <strong>tagCount</strong>
          </li>
        </ul>
      </Collapsible>

      {/* ---------------------------------------------------------------- */}
      {/* Archive controls (Refresh / Delete All)                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="title">
        <Typography variant="h6">Archive Data</Typography>

        <div className="aots-options">
          {/* Delete ALL scans */}
          <Tooltip title={'Delete All Scan'}>
            <IconButton
              variant="contained"
              size="small"
              onClick={() => setOpenDeleteAllScans(true)}
            >
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>

          {/* Dialog for deleting all scans */}
          <DeleteScanDialog
            open={openDeleteAllScans}
            setOpen={setOpenDeleteAllScans}
            deleteFn={deleteAllScans}
            allScans={true}
          />

          {/* Refresh button */}
          <Tooltip title={'Refresh'}>
            <IconButton variant="contained" size="small" onClick={load}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Divider className="divider" />

      {/* ---------------------------------------------------------------- */}
      {/* Archive content list                                             */}
      {/* ---------------------------------------------------------------- */}
      {runs.length > 0 ? (
        runs.map((snap, index) => (
          <Collapsible
            defaultOpen={false}
            key={index}
            title={`Date: ${formatWhen(snap.run.startedAt)} | Pages Count: ${snap.run.pagesCount}`}
          >
            <RuntimeScanResults
              results={snap}
              titleDisabled
              deleteDisable={false}
              deleteScan={() => deleteScan(snap?.run?.stoppedAt)}
            />
          </Collapsible>
        ))
      ) : (
        <Typography>No runtime snaps.</Typography>
      )}
    </div>
  );
}

export default RuntimeScanArchiveAnalyzer;
