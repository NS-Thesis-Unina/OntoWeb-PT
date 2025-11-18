import './oneTimeScan.css';
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
import analyzerReactController from '../../../../../analyzerController';
import Collapsible from '../../../../../../../components/collapsible/collapsible';
import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'notistack';
import OneTimeScanResults from '../../../components/oneTimeScanResults/oneTimeScanResults';
import { formatWhen, getDomainAccurate } from '../../../../../../../libs/formatting';
import RefreshIcon from '@mui/icons-material/Refresh';
import browser from 'webextension-polyfill';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteScanDialog from '../../../../../../../components/deleteScanDialog/deleteScanDialog';

/**
 * **OneTimeScanArchiveAnalyzer**
 *
 * Architectural Role:
 *   Analyzer → Archive → One-Time Scan Archive Viewer
 *
 * Purpose:
 *   Provides a unified interface to inspect **all stored One-Time Scan snapshots**.
 *   The archive aggregates data coming from four distinct sources:
 *
 *     1. Current Tab               → last scan for the currently active tab
 *     2. Other Tabs (session)      → scans executed in other tabs during this session
 *     3. Last Global Session Run   → most recent One-Time Scan saved at session level
 *     4. Local Saved               → long-term persisted scans stored in localStorage
 *
 * Responsibilities:
 *   • Load snapshots from all four storage tiers
 *   • Normalize older snapshot formats (backward compatibility)
 *   • Provide refresh, single-deletion, and full-deletion capabilities
 *   • Render each snapshot using <OneTimeScanResults />
 *
 * UX Notes:
 *   • Loads automatically on mount
 *   • Provides collapsible sections for each category of snapshots
 *   • Shows appropriate empty-states when no data is available
 *
 * Data Flow:
 *   analyzerReactController.getSessionByTabMap()     → per-tab snapshots
 *   analyzerReactController.getSessionLastResult()   → global session snapshot
 *   analyzerReactController.getLocalScanResults()    → long-term storage snapshots
 *   analyzerReactController.onMessage                → auto-refresh on scan completion
 */
function OneTimeScanArchiveAnalyzer() {
  /* -------------------------------------------------------------------------- */
  /* Local State                                                                */
  /* -------------------------------------------------------------------------- */

  const [loading, setLoading] = useState(true); // Loading indicator
  const [currentTabSnap, setCurrentTabSnap] = useState(null); // Scan for active tab
  const [otherTabsSnaps, setOtherTabsSnaps] = useState([]); // Scans for other tabs
  const [sessionSnap, setSessionSnap] = useState(null); // Global session scan
  const [localSnaps, setLocalSnaps] = useState([]); // Local persistent scans

  const [openDeleteAllScans, setOpenDeleteAllScans] = useState(false); // Confirmation dialog

  /**
   * **normalizeSnapshot(snap)**
   *
   * Some historical versions of the extension stored One-Time Scan snapshots in
   * slightly different shapes. To maintain backward compatibility, this function
   * transforms any legacy format into the canonical structure:
   *
   *     { meta: {...}, results: {...} }
   *
   * The function safely handles:
   *   • modern format (already valid)
   *   • legacy "results.meta + results.results"
   *   • partial fallback formats
   */
  function normalizeSnapshot(snap) {
    if (!snap) return null;

    // Snap already in canonical format
    if (snap.meta && snap.results) return snap;

    // Legacy format: snap.results contains both meta and results
    if (snap.results && snap.results.meta && snap.results.results) {
      return { meta: snap.results.meta, results: snap.results.results };
    }

    // Fallback: assume snap.results is a "results" block only
    if (snap.results) {
      return { meta: snap.meta || {}, results: snap.results };
    }

    return null;
  }

  /**
   * **load()**
   *
   * Loads every snapshot source in parallel and updates the UI state.
   *
   * Data sourced from:
   *   • per-tab session map
   *   • active tab id
   *   • global session storage
   *   • local persistent storage
   *
   * Each group is normalized and sorted as necessary.
   */
  const load = useCallback(async () => {
    setLoading(true);

    try {
      /* ------------------------------- Current Tab ------------------------------- */
      const tid = await analyzerReactController.getCurrentTabId();
      const byTab = await analyzerReactController.getSessionByTabMap();
      const openTabs = await browser.tabs.query({});
      const openIds = new Set(openTabs.map((t) => t?.id).filter((id) => id != null));

      const current =
        tid != null && openIds.has(tid) && byTab?.[tid] ? normalizeSnapshot(byTab[tid]) : null;

      setCurrentTabSnap(current);

      /* ------------------------------- Other Tabs -------------------------------- */
      const others = Object.entries(byTab || {})
        .map(([id, value]) => [Number(id), value])
        .filter(([id]) => openIds.has(id) && String(id) !== String(tid))
        .map(([, value]) => normalizeSnapshot(value))
        .filter(Boolean)
        .sort((a, b) => (b?.meta?.timestamp || 0) - (a?.meta?.timestamp || 0));

      setOtherTabsSnaps(others);

      /* ------------------------ Last Global Session Snapshot ---------------------- */
      const sessionSnap = await analyzerReactController.getSessionLastResult();
      setSessionSnap(normalizeSnapshot(sessionSnap));

      /* --------------------------- Local Long-Term Storage ------------------------- */
      const locals = await analyzerReactController.getLocalScanResults();

      const normalizedLocals = (Array.isArray(locals) ? locals : [])
        .map((s) => {
          const norm = normalizeSnapshot(s.results || s);
          const ts =
            norm?.meta?.timestamp ??
            (Number(String(s.key || '').replace('analyzerResults_', '')) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));

      setLocalSnaps(normalizedLocals);

      enqueueSnackbar('Archive loaded from storage successfully!', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err || 'Error loading snapshots.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Initialization + auto-refresh when new scans are completed                 */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    load();

    const off = analyzerReactController.onMessage({
      onScanComplete: () => load(),
      onRuntimeScanUpdate: () => {}, // Ignored for One-Time archive
      onScanError: () => {},
    });

    return () => off();
  }, [load]);

  /**
   * *deleteScan(timestamp)*
   *
   * Removes a single One-Time Scan snapshot from local persistent storage.
   */
  const deleteScan = async (timestamp) => {
    try {
      await analyzerReactController.deleteOneTimeResultById(`analyzerResults_${timestamp}`);
      load();
      enqueueSnackbar('Scan deleted successfully from storage.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Error deleting scan from storage.', { variant: 'error' });
    }
  };

  /**
   * **deleteAllScans()**
   *
   * Removes all One-Time Scan snapshots stored in local persistent storage.
   */
  const deleteAllScans = async () => {
    try {
      await analyzerReactController.clearAllOneTimeResults();
      load();
      enqueueSnackbar('All scans deleted successfully from storage.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Error deleting all scans from storage.', { variant: 'error' });
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Loading UI                                                                 */
  /* -------------------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="otsarchiveanalyzer-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Main UI                                                                    */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="otsarchiveanalyzer-div">
      {/* ---------------------------------------------------------------------- */}
      {/* Archive description block                                              */}
      {/* ---------------------------------------------------------------------- */}
      <Paper className="description">
        <Zoom in>
          <div>
            <Typography variant="body2">
              The <strong>Analyzer’s One-Time Scan Archive</strong> aggregates previously saved
              snapshots into four categories to make them easy to locate, reopen, and compare:
            </Typography>

            <ul className="ul">
              <li>
                <strong>Current Tab</strong> — scans for the tab where the extension UI is open.
              </li>
              <li>
                <strong>Other Tabs (this session)</strong> — scans from other tabs active in this
                session.
              </li>
              <li>
                <strong>Last Global Session Run</strong> — the latest session-wide scan.
              </li>
              <li>
                <strong>Local Saved</strong> — long-term scans persisted in localStorage.
              </li>
            </ul>

            <Typography variant="body2">
              Each snapshot includes its head/body structure, metadata, URL, and DOM statistics. Use
              this archive to revisit previous analyses or compare multiple versions of the same
              page over time.
            </Typography>
          </div>
        </Zoom>
      </Paper>

      {/* ---------------------------------------------------------------------- */}
      {/* Technical Info Output (structure clarification)                        */}
      {/* ---------------------------------------------------------------------- */}
      <Collapsible defaultOpen={false} title="Info Output">
        <strong>Head</strong>
        <ul className="ul">
          <li>
            <strong>title</strong>
          </li>
          <li>
            <strong>meta</strong> (name/property + content)
          </li>
          <li>
            <strong>links</strong> (stylesheet, preload, canonical…)
          </li>
          <li>
            <strong>scripts</strong> (external + inline preview)
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
            <strong>lists</strong>
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

      {/* ---------------------------------------------------------------------- */}
      {/* Archive controls (Delete All / Refresh)                                */}
      {/* ---------------------------------------------------------------------- */}
      <div className="title">
        <Typography variant="h6">Archive Data</Typography>

        <div className="aots-options">
          {/* Delete ALL scans */}
          <Tooltip title="Delete All Scan">
            <IconButton
              variant="contained"
              size="small"
              onClick={() => setOpenDeleteAllScans(true)}
            >
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>

          <DeleteScanDialog
            open={openDeleteAllScans}
            setOpen={setOpenDeleteAllScans}
            deleteFn={deleteAllScans}
            allScans
          />

          {/* Refresh */}
          <Tooltip title="Refresh">
            <IconButton variant="contained" size="small" onClick={load}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Divider className="divider" />

      {/* ---------------------------------------------------------------------- */}
      {/* CURRENT TAB                                                            */}
      {/* ---------------------------------------------------------------------- */}
      <Collapsible title="Current Tab" defaultOpen={false}>
        {currentTabSnap ? (
          <OneTimeScanResults
            results={currentTabSnap}
            titleDisabled
            deleteDisable={false}
            deleteScan={() => deleteScan(currentTabSnap?.meta?.timestamp)}
          />
        ) : (
          <Typography>No current tab snap.</Typography>
        )}
      </Collapsible>

      {/* ---------------------------------------------------------------------- */}
      {/* OTHER TABS (THIS SESSION)                                             */}
      {/* ---------------------------------------------------------------------- */}
      <Collapsible title={`Other Tabs (${otherTabsSnaps.length})`} defaultOpen={false}>
        {otherTabsSnaps.length > 0 ? (
          otherTabsSnaps.map((snap, index) => (
            <Collapsible key={index} title={`Tab Id: ${snap.meta.tabId}`} defaultOpen={false}>
              <OneTimeScanResults
                results={snap}
                titleDisabled
                deleteDisable={false}
                deleteScan={() => deleteScan(snap?.meta?.timestamp)}
              />
            </Collapsible>
          ))
        ) : (
          <Typography>No other tabs snaps.</Typography>
        )}
      </Collapsible>

      {/* ---------------------------------------------------------------------- */}
      {/* LAST GLOBAL SESSION RUN                                               */}
      {/* ---------------------------------------------------------------------- */}
      <Collapsible title="Last Global Session Run" defaultOpen={false}>
        {sessionSnap ? (
          <OneTimeScanResults
            results={sessionSnap}
            titleDisabled
            deleteDisable={false}
            deleteScan={() => deleteScan(sessionSnap?.meta?.timestamp)}
          />
        ) : (
          <Typography>No session snap.</Typography>
        )}
      </Collapsible>

      {/* ---------------------------------------------------------------------- */}
      {/* LOCAL PERSISTED SCANS                                                 */}
      {/* ---------------------------------------------------------------------- */}
      <Collapsible title={`Local Saved (${localSnaps.length})`} defaultOpen={false}>
        {localSnaps.length > 0 ? (
          localSnaps.map((snap, index) => (
            <Collapsible
              key={index}
              title={`Date: ${formatWhen(snap.ts)} | Domain: ${getDomainAccurate(
                snap.snap.meta.url
              )}`}
              defaultOpen={false}
            >
              <OneTimeScanResults
                results={snap.snap}
                titleDisabled
                deleteDisable={false}
                deleteScan={() => deleteScan(snap?.snap?.meta?.timestamp)}
              />
            </Collapsible>
          ))
        ) : (
          <Typography>No other tabs snaps.</Typography>
        )}
      </Collapsible>
    </div>
  );
}

export default OneTimeScanArchiveAnalyzer;
