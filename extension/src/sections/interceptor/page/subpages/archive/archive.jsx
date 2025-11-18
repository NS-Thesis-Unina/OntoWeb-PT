import './archive.css';
import {
  Backdrop,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  Zoom,
  Button,
} from '@mui/material';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { enqueueSnackbar } from 'notistack';

import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

import interceptorReactController from '../../../interceptorController';
import Collapsible from '../../../../../components/collapsible/collapsible';
import RuntimeScanResults from '../components/runtimeScanResults/runtimeScanResults';

import browser from 'webextension-polyfill';
import { formatWhen, prettyBytes } from '../../../../../libs/formatting';
import DeleteScanDialog from '../../../../../components/deleteScanDialog/deleteScanDialog';

/** Storage sentinel used internally by the Interceptor to track the last run key */
const LAST_KEY_SENTINEL = 'interceptorRun_lastKey';

/**
 * Validates that a run metadata object contains all required numeric fields.
 * Prevents corrupted or incomplete entries from breaking UI.
 */
function hasValidMeta(meta) {
  return (
    meta &&
    typeof meta === 'object' &&
    Number.isFinite(meta.startedAt) &&
    Number.isFinite(meta.stoppedAt) &&
    Number.isFinite(meta.totalEvents) &&
    Number.isFinite(meta.pagesCount) &&
    Number.isFinite(meta.totalBytes)
  );
}

/**
 * **ArchiveInterceptor**
 *
 * Architectural Role:
 *   Interceptor → Archive View → ArchiveInterceptor (this component)
 *
 * Purpose:
 *   This component loads, lists, and visually organizes all saved Runtime Scan sessions
 *   captured by the Interceptor subsystem and stored in browser.local storage.
 *
 * Responsibilities:
 *   - Fetch list of saved scan sessions (metadata only)
 *   - Validate entries and exclude invalid/sentinel storage keys
 *   - Render archive items in collapsible sections, grouped by scan
 *   - Lazily load full scan data only when a section is opened
 *   - Provide “Delete All Scans” functionality
 *   - Auto-refresh when the background Interceptor signals a completed scan
 *
 * Interactions:
 *   - `interceptorReactController.listRuns()` → retrieves metadata list
 *   - `interceptorReactController.clearAllRuns()` → deletes all sessions
 *   - `interceptorReactController.deleteRunById()` → deletes one run
 *   - Uses `browser.storage.local.get()` to load full scan details lazily
 *   - Uses a shared component (<RuntimeScanResults>) to render full scan results
 *
 * Important Notes:
 *   - The archive stores only metadata initially; full scan payload is loaded per-run.
 *   - Invalid or incomplete metadata is filtered out for safety.
 *   - “LAST_KEY_SENTINEL” is excluded because it tracks the most recent run.
 */
function ArchiveInterceptor() {
  /** Global loading state while loading run metadata */
  const [loading, setLoading] = useState(true);

  /**
   * "runs" contains only SUMMARY info:
   *   [
   *     { key: "interceptorRun_...", meta: {...} }
   *   ]
   *
   * Full payload is loaded lazily by RunResultsByKey.
   */
  const [runs, setRuns] = useState([]);

  /** Dialog control for "Delete All Scans" */
  const [openDeleteAllScans, setOpenDeleteAllScans] = useState(false);

  /**
   * Fetches and validates the list of stored scans.
   * Filters out:
   *  - sentinel keys,
   *  - malformed entries,
   *  - non-interceptor keys.
   */
  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await interceptorReactController.listRuns();
      const list = Array.isArray(res?.runs) ? res.runs : [];

      const cleaned = list.filter(
        (item) =>
          item &&
          typeof item.key === 'string' &&
          item.key !== LAST_KEY_SENTINEL &&
          item.key.startsWith('interceptorRun_') &&
          hasValidMeta(item.meta)
      );

      setRuns(cleaned);
      enqueueSnackbar('Archive loaded from storage successfully!', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(e?.message || 'Error loading runs from storage.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * On mount:
   *   - Load archive metadata
   *   - Register listener for Interceptor background events
   *     → when a scan completes, reload archive list
   */
  useEffect(() => {
    load();

    const off = interceptorReactController.onMessage({
      onComplete: () => load(),
    });

    return () => off();
  }, [load]);

  /** Convenience: whether any runs exist */
  const hasRuns = useMemo(() => runs.length > 0, [runs]);

  /**
   * Deletes ALL saved runs and refreshes the archive view.
   */
  const deleteAllScans = async () => {
    try {
      await interceptorReactController.clearAllRuns();
      load();
      enqueueSnackbar('All scans deleted successfully from storage.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Error deleting all scans from storage.', { variant: 'error' });
    }
  };

  /** While metadata is loading, show centered overlay loader */
  if (loading) {
    return (
      <div className="archiveinterceptor-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  /* ========================================================================
   * RENDER: Archive Metadata List
   * ======================================================================== */
  return (
    <div className="archiveinterceptor-div">
      {/* Description card at top */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Interceptor’s Runtime Scan Archive</strong> lists saved sessions from{' '}
            <em>local storage</em>. Each entry shows start/stop time, total events, pages count, and
            total bytes. Expanding an item loads the complete dataset from storage and displays it
            like a runtime scan.
          </Typography>
        </Zoom>
      </Paper>

      {/* Expandable Information Section (Documentation for users) */}
      <Collapsible defaultOpen={false} title="Info Output">
        <p>
          For each saved scan in local storage, the archive displays the same grouping and grid used
          in the Runtime Scan view.
        </p>

        {/* Request structure */}
        <strong>Request</strong>
        <ul className="ul">
          <li>
            <strong>url</strong>: absolute URL (extension/http/https/ws/wss)
          </li>
          <li>
            <strong>method</strong>: HTTP verb or protocol marker
          </li>
          <li>
            <strong>headers</strong>: preserved case-sensitive object
          </li>
          <li>
            <strong>body</strong>: text or Base64 payload
          </li>
          <li>
            <strong>bodyEncoding</strong>: text | base64 | none
          </li>
          <li>
            <strong>bodySize</strong> & <strong>truncated</strong>
          </li>
        </ul>

        {/* Response structure */}
        <strong>Response</strong>
        <ul className="ul">
          <li>
            <strong>status</strong> / <strong>statusText</strong>
          </li>
          <li>
            <strong>headers</strong>
          </li>
          <li>
            <strong>body</strong> with encoding indicators
          </li>
          <li>
            <strong>servedFromCache</strong>, <strong>fromServiceWorker</strong>
          </li>
        </ul>

        {/* Meta structure */}
        <strong>Meta</strong>
        <ul className="ul">
          <li>
            <strong>pageUrl</strong>, <strong>tabId</strong>, <strong>ts</strong>
          </li>
        </ul>

        {/* Special channels */}
        <strong>Special channels</strong>
        <ul className="ul">
          <li>sendBeacon, EventSource, WebSocket markers included</li>
        </ul>

        {/* Summary */}
        <strong>Grouping & summary</strong>
        <ul className="ul">
          <li>Per-domain grouping identical to runtime view</li>
          <li>Metadata: start, stop, events, pages, bytes</li>
        </ul>

        {/* Grid columns */}
        <strong>Grid columns</strong>
        <ul className="ul">
          <li>Method, URL, Status, Status Text, Content-Type</li>
        </ul>
      </Collapsible>

      {/* HEADER: Archive title + action buttons */}
      <div className="title">
        <Typography variant="h6">Archive</Typography>

        <div className="aots-options">
          {/* Delete all scans */}
          <Tooltip title="Delete All Scan">
            <IconButton size="small" onClick={() => setOpenDeleteAllScans(true)}>
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>

          <DeleteScanDialog
            open={openDeleteAllScans}
            setOpen={setOpenDeleteAllScans}
            deleteFn={deleteAllScans}
            allScans={true}
          />

          {/* Manual refresh */}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Divider className="divider" />

      {/* MAIN CONTENT: List saved runs */}
      {hasRuns ? (
        runs.map(({ key, meta }) => {
          // Header summary preview for each scan
          const title = `Started: ${formatWhen(meta.startedAt)} | Stopped: ${formatWhen(
            meta.stoppedAt
          )} | Pages: ${meta.pagesCount} | Events: ${meta.totalEvents} | Bytes: ${prettyBytes(
            meta.totalBytes
          )}`;

          return (
            <Collapsible key={key} defaultOpen={false} title={title}>
              <RunResultsByKey keyId={key} load={load} />
            </Collapsible>
          );
        })
      ) : (
        <Typography>No runtime runs.</Typography>
      )}
    </div>
  );
}

/**
 * **RunResultsByKey**
 *
 * Architectural Role:
 *   Hands-on loader + presenter for the *full dataset* of a saved run.
 *
 * Purpose:
 *   This nested component loads the entire run (requests/responses/etc.)
 *   from browser.storage.local only when a user expands a Collapsible.
 *
 * Responsibilities:
 *   - Load full scan details lazily from storage
 *   - Handle “retry” logic if load fails
 *   - Pass loaded data to <RuntimeScanResults> for rendering
 *   - Support deleting just that specific run
 *
 * Notes:
 *   - Avoids loading all data upfront → improving performance.
 *   - Metadata was already validated upstream.
 */
function RunResultsByKey({ keyId, load }) {
  /** Loading and error status for the *full* dataset of this run */
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Delete one specific scan by timestamp.
   * Storage format uses keys: "interceptorRun_<timestamp>"
   */
  const deleteScan = async (timestamp) => {
    try {
      await interceptorReactController.deleteRunById(`interceptorRun_${timestamp}`);
      load();
      enqueueSnackbar('Scan deleted successfully from storage.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Error deleting scan from storage.', { variant: 'error' });
    }
  };

  /**
   * Loads the full run dataset from browser.local when this
   * collapsible section is opened or when retrying.
   */
  const loadFromStorage = useCallback(async () => {
    if (loading || run) return;

    setLoading(true);
    setError(null);

    try {
      const all = await browser.storage.local.get(keyId);
      const r = all?.[keyId] || null;

      if (!r) {
        setError('Run not found in storage.');
      } else {
        setRun(r);
      }
    } catch (e) {
      setError(e?.message || 'Error reading run from storage.');
    } finally {
      setLoading(false);
    }
  }, [keyId, loading, run]);

  /** Load immediately upon expansion */
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  /** Render: Loading state */
  if (loading) {
    return (
      <div style={{ padding: 8, display: 'flex', alignItems: 'center' }}>
        <CircularProgress size={24} /> <span style={{ marginLeft: 8 }}>Loading run…</span>
      </div>
    );
  }

  /** Render: Error state with retry button */
  if (error) {
    return (
      <div style={{ padding: 8 }}>
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          {error}
        </Typography>
        <Button size="small" variant="outlined" onClick={loadFromStorage}>
          Retry
        </Button>
      </div>
    );
  }

  /** Render: Not loaded yet — request manual load */
  if (!run) {
    return (
      <div style={{ padding: 8 }}>
        <Button size="small" variant="outlined" onClick={loadFromStorage}>
          Load run details
        </Button>
      </div>
    );
  }

  /** Render: Loaded run passed to the shared RuntimeScanResults renderer */
  return (
    <RuntimeScanResults
      results={{ key: keyId, run }}
      titleDisabled
      deleteScan={() => deleteScan(run?.stoppedAt)}
      deleteDisable={false}
    />
  );
}

export default ArchiveInterceptor;
