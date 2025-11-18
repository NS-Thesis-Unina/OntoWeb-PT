import './archive.css';
import {
  Backdrop,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import Collapsible from '../../../../../components/collapsible/collapsible';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { enqueueSnackbar } from 'notistack';
import techStackReactController from '../../../techstackController';
import ScanResults from '../components/scanResults/scanResults';
import { formatWhen, getDomainAccurate } from '../../../../../libs/formatting';
import DeleteScanDialog from '../../../../../components/deleteScanDialog/deleteScanDialog';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

/**
 * **ArchiveTechStack**
 *
 * Architectural Role:
 *   React UI → TechStackReactController → background → TechStackEngine
 *
 * Responsibilities:
 * - Load and display all stored TechStack snapshots:
 *    • Current tab snapshot (from session storage)
 *    • Snapshots from other open tabs
 *    • Global session snapshot
 *    • Local (persistent) archive snapshots
 * - Normalize previously stored snapshots into the unified ScanResults format
 * - Allow deleting:
 *    • A single snapshot
 *    • All snapshots (wipe archive)
 * - Refresh archive view on-demand or after new scans
 *
 * Storage Hierarchy:
 *   1. Per-tab sessionStorage:   techstack_lastByTab[tabId]
 *   2. Global sessionStorage:    techstack_lastResult
 *   3. Local extension storage:  techstackResults_<timestamp>
 *
 * Notes:
 * - This component has no scanning logic.
 * - It only *reads* snapshots, normalizes them, and renders <ScanResults />.
 * - It automatically refreshes when a new scan completes (background → React).
 */
function ArchiveTechStack() {
  /**
   * ---------------------------------------------------------
   * Component State
   * ---------------------------------------------------------
   */
  const [loading, setLoading] = useState(true);

  const [currentTabSnap, setCurrentTabSnap] = useState(null);
  const [otherTabsSnaps, setOtherTabsSnaps] = useState([]);

  const [sessionSnap, setSessionSnap] = useState(null);

  const [localSnaps, setLocalSnaps] = useState([]);

  const [openDeleteAllScans, setOpenDeleteAllScans] = useState(false);

  /**
   * Normalize different snapshot formats into a unified structure:
   * { meta, results }
   *
   * Because older versions or different storage states may contain
   * slightly different structures.
   */
  function normalizeSnapshot(snap) {
    if (!snap) return null;

    // Already normalized
    if (snap.meta && snap.results) return snap;

    // Some older / wrapped formats: { results: { meta, results } }
    if (snap.results && snap.results.meta && snap.results.results)
      return { meta: snap.results.meta, results: snap.results.results };

    // Snap with results but missing meta wrapper
    if (snap.results) return { meta: snap.meta || {}, results: snap.results };

    // Raw format (legacy):
    if (snap.technologies || snap.waf || snap.storage || snap.cookies || snap.raw) {
      return { meta: snap.meta || null, results: snap };
    }

    return null;
  }

  /**
   * ---------------------------------------------------------
   * Load all snapshots from storage (tab/session/local)
   * ---------------------------------------------------------
   */
  const load = useCallback(async () => {
    setLoading(true);

    try {
      // -----------------------------------------------------
      // Identify current active tab
      // -----------------------------------------------------
      const tid = await techStackReactController.getCurrentTabId();

      // -----------------------------------------------------
      // Per-tab snapshots (session storage)
      // -----------------------------------------------------
      let byTab = {};
      try {
        const obj = await browser.storage.session.get('techstack_lastByTab');
        byTab = obj?.techstack_lastByTab ?? {};
      } catch {
        byTab = {};
      }

      // All open tab IDs
      const openTabs = await browser.tabs.query({});
      const openIds = new Set(openTabs.map((t) => t?.id).filter((id) => id != null));

      // Current tab snapshot
      const cur =
        tid != null && openIds.has(tid) && byTab?.[tid] ? normalizeSnapshot(byTab[tid]) : null;
      setCurrentTabSnap(cur);

      // Snapshots from other open tabs
      const others = Object.entries(byTab || {})
        .map(([k, v]) => [Number(k), v])
        .filter(([id]) => openIds.has(id) && String(id) !== String(tid))
        .map(([, v]) => normalizeSnapshot(v))
        .filter(Boolean)
        .sort((a, b) => (b?.meta?.timestamp || 0) - (a?.meta?.timestamp || 0));
      setOtherTabsSnaps(others);

      // -----------------------------------------------------
      // Global session snapshot
      // -----------------------------------------------------
      const sess = await techStackReactController.getSessionLastResult();
      setSessionSnap(normalizeSnapshot(sess));

      // -----------------------------------------------------
      // Local storage archive (persistent)
      // -----------------------------------------------------
      const locals = await techStackReactController.getLocalResults();

      const normalizedLocals = (Array.isArray(locals) ? locals : [])
        .map((s) => {
          // local format: { key, results: { meta, results } }
          const norm = normalizeSnapshot(s.results || s);

          const ts =
            norm?.meta?.timestamp ?? Number(String(s.key || '').replace('techstackResults_', ''));

          return { key: s.key, ts, snap: norm };
        })
        .filter((x) => x.snap)
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));

      setLocalSnaps(normalizedLocals);

      enqueueSnackbar('Archive loaded from storage successfully!', {
        variant: 'success',
      });
    } catch (e) {
      enqueueSnackbar(e || 'Error loading snaps from storage.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * ---------------------------------------------------------
   * Side Effects: Load archive and subscribe to scan events
   * ---------------------------------------------------------
   */
  useEffect(() => {
    load();

    // Refresh archive when new scan completes
    const off = techStackReactController.onMessage({
      onScanComplete: () => load(),
    });

    return () => off();
  }, [load]);

  /**
   * ---------------------------------------------------------
   * Delete a single snapshot
   * ---------------------------------------------------------
   */
  const deleteScan = async (timestamp) => {
    try {
      await techStackReactController.deleteResultById(`techstackResults_${timestamp}`);
      load();
      enqueueSnackbar('Scan deleted successfully from storage.', {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar('Error deleting scan from storage.', {
        variant: 'error',
      });
    }
  };

  /**
   * ---------------------------------------------------------
   * Delete ALL snapshots (wipe archive)
   * ---------------------------------------------------------
   */
  const deleteAllScans = async () => {
    try {
      await techStackReactController.clearAllResults();
      load();
      enqueueSnackbar('All scans deleted successfully from storage.', {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar('Error deleting all scans from storage.', {
        variant: 'error',
      });
    }
  };

  /**
   * ---------------------------------------------------------
   * Loading Screen
   * ---------------------------------------------------------
   */
  if (loading) {
    return (
      <div className="scanteckstack-div">
        <Backdrop open={true}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  /**
   * ---------------------------------------------------------
   * Main Render
   * ---------------------------------------------------------
   */
  return (
    <div className="archivetechstack-div">
      {/* ------------------ Info Section ------------------ */}
      <Collapsible defaultOpen={false} title="Info Archive">
        <strong>Archive</strong> stores and organizes the results of TechStack scans by context:
        <ul className="ul">
          <li>
            <strong>Current tab</strong>: latest scan of the active tab.
          </li>
          <li>
            <strong>Other tabs</strong>: scans from other currently open tabs.
          </li>
          <li>
            <strong>Session</strong>: global session history.
          </li>
          <li>
            <strong>Local archive</strong>: persistent storage across sessions.
          </li>
        </ul>
      </Collapsible>

      {/* ------------------ Header ------------------ */}
      <div className="title">
        <Typography variant="h6">Archive Data</Typography>
        <div className="ats-options">
          {/* Delete All */}
          <Tooltip title={'Delete All Scan'}>
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
            allScans={true}
          />

          {/* Refresh */}
          <Tooltip title={'Refresh'}>
            <IconButton variant="contained" size="small" onClick={load}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Divider className="divider" />

      {/* ------------------ Current Tab ------------------ */}
      <Collapsible defaultOpen={false} title={'Current Tab'}>
        {currentTabSnap ? (
          <ScanResults
            results={currentTabSnap}
            titleDisabled
            deleteDisable={false}
            deleteScan={() => deleteScan(currentTabSnap.meta.timestamp)}
          />
        ) : (
          <Typography variant="body2">Current tab scan empty.</Typography>
        )}
      </Collapsible>

      {/* ------------------ Other Tabs ------------------ */}
      <Collapsible defaultOpen={false} title={`Other Tabs (${otherTabsSnaps.length})`}>
        {otherTabsSnaps.length > 0 ? (
          otherTabsSnaps.map((scan, index) => (
            <Collapsible
              key={index}
              defaultOpen={false}
              title={`${getDomainAccurate(scan.meta.url)} - ${formatWhen(scan.meta.timestamp)}`}
            >
              <ScanResults
                key={index}
                titleDisabled
                results={scan}
                deleteDisable={false}
                deleteScan={() => deleteScan(scan.meta.timestamp)}
              />
            </Collapsible>
          ))
        ) : (
          <Typography variant="body2">Other Tabs scan empty.</Typography>
        )}
      </Collapsible>

      {/* ------------------ Session Snapshot ------------------ */}
      <Collapsible defaultOpen={false} title={'Session (Global)'}>
        {sessionSnap ? (
          <ScanResults
            results={sessionSnap}
            titleDisabled
            deleteDisable={false}
            deleteScan={() => deleteScan(sessionSnap.meta.timestamp)}
          />
        ) : (
          <Typography variant="body2">Session tab scan empty.</Typography>
        )}
      </Collapsible>

      {/* ------------------ Local Archive ------------------ */}
      <Collapsible defaultOpen={false} title={`Local (${localSnaps.length})`}>
        {localSnaps.length > 0 ? (
          localSnaps.map((scan, index) => (
            <Collapsible
              key={index}
              defaultOpen={false}
              title={`${getDomainAccurate(scan.snap.meta.url)} - ${formatWhen(scan.ts)}`}
            >
              <ScanResults
                key={index}
                titleDisabled
                results={scan.snap}
                deleteDisable={false}
                deleteScan={() => deleteScan(scan.snap.meta.timestamp)}
              />
            </Collapsible>
          ))
        ) : (
          <Typography variant="body2">Other Tabs scan empty.</Typography>
        )}
      </Collapsible>
    </div>
  );
}

export default ArchiveTechStack;
