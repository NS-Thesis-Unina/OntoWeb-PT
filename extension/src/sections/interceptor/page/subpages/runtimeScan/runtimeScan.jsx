import './runtimeScan.css';
import {
  Backdrop,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
  Zoom,
  Alert,
} from '@mui/material';

import Collapsible from '../../../../../components/collapsible/collapsible';
import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'notistack';

import interceptorReactController from '../../../interceptorController';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import RuntimeScanResults from '../components/runtimeScanResults/runtimeScanResults';

import {
  acquireLock,
  releaseLock,
  getLock,
  subscribeLockChanges,
  OWNERS,
} from '../../../../../scanLock';

import browser from 'webextension-polyfill';
import { prettyBytes } from '../../../../../libs/formatting';

/**
 * **RuntimeScanInterceptor**
 *
 * Architectural Role:
 *   Interceptor → Live Capture UI → RuntimeScanInterceptor (this component)
 *
 * Purpose:
 *   Provides the live runtime capture interface for the Interceptor subsystem.
 *   It allows the user to start and stop HTTP interception in real time and
 *   displays a summary of the currently running session as well as the results
 *   of the latest completed scan session.
 *
 * Responsibilities:
 *   - Start and stop the interceptor background service
 *   - Display live status (running/stopped) and real-time counters
 *   - Manage concurrency lock (only one scan at a time across the whole extension)
 *   - Auto-load the latest completed scan from storage
 *   - React to push events from the background (onUpdate, onComplete)
 *   - Provide UI for full scan results using <RuntimeScanResults>
 *
 * Interactions:
 *   - interceptorReactController.start/stop/getStatus/getLastKey/listRuns
 *   - browser.storage.local.get() to fetch full run data
 *   - Uses scanLock system (acquireLock, releaseLock, subscribeLockChanges)
 *   - UI-level components: Collapsible, RuntimeScanResults
 *
 * Important Notes:
 *   - Uses a global lock to guarantee that only ONE runtime scan can run at a time
 *   - Reactively updates as background sends incremental totals
 *   - The latest completed scan automatically appears below the status card
 *   - All heavy result rendering is delegated to RuntimeScanResults
 */
function RuntimeScanInterceptor() {
  /** Owner identity for lock system */
  const OWNER = OWNERS.INTERCEPTOR_RUNTIME;

  /** Default status snapshot when no scan is running */
  const EMPTY_STATUS = {
    active: false,
    startedAt: 0,
    totalEvents: 0,
    pagesCount: 0,
    totalBytes: 0,
  };

  /** Component state */
  const [loading, setLoading] = useState(true); // Loading initial state
  const [status, setStatus] = useState(EMPTY_STATUS); // Live status from background
  const [stopping, setStopping] = useState(false); // Stop-in-progress spinner
  const [lastRun, setLastRun] = useState(null); // Last completed scan session
  const [globalLock, setGlobalLock] = useState(null); // Lock info from global scanLock

  /**
   * Fetches current status from background controller and ensures
   * that the global lock is owned by Interceptor Runtime if active.
   */
  const refreshStatus = useCallback(async () => {
    const s = await interceptorReactController.getStatus();

    // If not active, adopt empty snapshot
    if (!s || !s.active) {
      setStatus(EMPTY_STATUS);
    } else {
      setStatus({
        active: !!s.active,
        startedAt: s.startedAt ?? 0,
        totalEvents: s.totalEvents ?? 0,
        pagesCount: s.pagesCount ?? 0,
        totalBytes: s.totalBytes ?? 0,
      });
    }

    // Lock check: if interceptor is running but lock is missing or belongs to someone else
    const cur = await getLock();
    if (s?.active && (!cur || cur.owner !== OWNER)) {
      await acquireLock(OWNER, 'Interceptor Runtime');
      setGlobalLock(await getLock());
    }
  }, []);

  /**
   * Loads the latest completed scan session from browser storage.
   * Used on initialization and after scan completion.
   */
  const loadLastRun = useCallback(async () => {
    setLoading(true);
    try {
      const { key } = await interceptorReactController.getLastKey();
      if (!key) {
        setLastRun({ key: null, run: null });
        return;
      }

      const all = await browser.storage.local.get(key);
      const run = all?.[key] || null;

      setLastRun(run ? { key, run } : { key: null, run: null });

      if (run) enqueueSnackbar('Latest Interceptor run loaded from storage.', { variant: 'info' });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * On mount:
   *   - Load status and last run
   *   - Sync lock
   *   - Subscribe to push events from background (onUpdate, onComplete)
   *   - Subscribe to lock changes from scanLock
   */
  useEffect(() => {
    refreshStatus();
    loadLastRun();
    (async () => setGlobalLock(await getLock()))();

    // Incoming messages from background controller
    const off = interceptorReactController.onMessage({
      /** Incremental status update while scan is active */
      onUpdate: (totals) => {
        if (totals) {
          setStatus((s) => ({
            ...s,
            active: true,
            startedAt: totals.startedAt ?? s.startedAt,
            totalEvents: totals.totalEvents ?? s.totalEvents,
            pagesCount: totals.pagesCount ?? s.pagesCount,
            totalBytes: totals.totalBytes ?? s.totalBytes,
          }));
        }
      },

      /** Scan completed event */
      onComplete: async (payload) => {
        setStopping(false);
        setStatus((s) => ({ ...s, active: false }));

        // Load newly completed run
        const key = payload?.key;
        if (key) {
          const all = await browser.storage.local.get(key);
          const run = all?.[key] || null;

          if (run) {
            setLastRun({ key, run });
            enqueueSnackbar('Interceptor run completed. Results loaded below.', {
              variant: 'success',
            });
          } else {
            await loadLastRun();
          }
        } else {
          await loadLastRun();
        }

        // Release lock
        releaseLock(OWNER);
      },
    });

    const offSub = subscribeLockChanges((n) => setGlobalLock(n ?? null));

    return () => {
      off();
      offSub();
    };
  }, [refreshStatus, loadLastRun]);

  /**
   * Start/stop button handler.
   * Enforces concurrency lock across entire extension.
   */
  const handleToggle = async () => {
    if (status.active) {
      // Stop in progress
      setStopping(true);
      await interceptorReactController.stop();
      return;
    }

    // Attempt to acquire global lock for new run
    const attempt = await acquireLock(OWNER, 'Interceptor Runtime');
    if (!attempt.ok) {
      const l = attempt.lock;
      enqueueSnackbar(
        `Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`,
        { variant: 'warning' }
      );
      return;
    }

    // Start new scan
    await interceptorReactController.start({
      types: { http: true, beacon: true, sse: true, websocket: true },
      maxBodyBytes: 1572864, // 1.5 MB capture size limit
    });

    refreshStatus();
  };

  /** Disabled if some other subsystem owns the global lock */
  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  /** Initial loading screen */
  if (loading) {
    return (
      <div className="rtinterceptor-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  /* ========================================================================
   * RENDER
   * ======================================================================== */
  return (
    <div className="rtinterceptor-div">
      {/* Inform user if lock is held by another component */}
      {disabledByLock && !status.active && (
        <Alert severity="info" sx={{ mb: 1, width: '100%' }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Stop
          it before starting Interceptor.
        </Alert>
      )}

      {/* Description card */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Interceptor</strong> captures HTTP requests and responses as you browse,
            directly from the page context (fetch/XMLHttpRequest). For each event it records the
            method, URL, headers, <em>request body</em>, status, <em>response body</em> (with a size
            limit), and a timestamp.
          </Typography>
        </Zoom>
      </Paper>

      {/* Documentation: Info Output section */}
      <Collapsible defaultOpen={false} title="Info Output">
        <p>
          The runtime network capture produces a structured record for each intercepted HTTP event
          (fetch and XHR), grouped by page/domain and summarized in the grid. Each event includes
          the sections below.
        </p>

        <strong>Request</strong>
        <ul className="ul">
          <li>
            <strong>url</strong>: absolute request URL
          </li>
          <li>
            <strong>method</strong>: HTTP verb
          </li>
          <li>
            <strong>headers</strong>: preserved case
          </li>
          <li>
            <strong>body</strong>: text or Base64
          </li>
          <li>
            <strong>bodyEncoding</strong>: text/base64/none
          </li>
          <li>
            <strong>bodySize</strong> & truncated flag
          </li>
        </ul>

        <strong>Response</strong>
        <ul className="ul">
          <li>
            <strong>status</strong> / <strong>statusText</strong>
          </li>
          <li>
            <strong>body</strong> & encoding
          </li>
          <li>
            <strong>servedFromCache</strong>, <strong>fromServiceWorker</strong>
          </li>
        </ul>

        <strong>Meta</strong>
        <ul className="ul">
          <li>
            <strong>pageUrl</strong>, <strong>tabId</strong>, <strong>ts</strong>
          </li>
        </ul>

        <strong>Grouping & summary</strong>
        <ul className="ul">
          <li>Grouped per requesting page’s domain</li>
          <li>Header shows start/stop/events/pages/bytes</li>
        </ul>

        <strong>Grid columns</strong>
        <ul className="ul">
          <li>Method, URL, Status, Status Text, Content-Type</li>
        </ul>
      </Collapsible>

      {/* Start/Stop button */}
      <Button
        onClick={handleToggle}
        className="scanButton"
        variant="contained"
        size="large"
        disabled={disabledByLock && !status.active}
      >
        {status.active ? 'Stop interceptor' : 'Start interceptor'}
      </Button>

      {/* Live status panel */}
      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}>
            <strong>Status</strong>
          </Grid>
          <Grid size={3}>
            <strong>Started at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Unique pages</strong>
          </Grid>
          <Grid size={3}>
            <strong>Total events</strong>
          </Grid>

          <Grid size={3} className="grid-newline-items">
            <Chip
              icon={<FiberManualRecordIcon />}
              label={status.active ? 'RUNNING' : 'STOPPED'}
              color={status.active ? 'success' : 'error'}
              variant="outlined"
            />
          </Grid>

          <Grid size={3} className="grid-newline-items">
            {status.startedAt ? new Date(status.startedAt).toLocaleString() : '—'}
          </Grid>

          <Grid size={3} className="grid-newline-items">
            {status.pagesCount ?? 0}
          </Grid>

          <Grid size={3} className="grid-newline-items">
            {status.totalEvents ?? 0}
          </Grid>
        </Grid>

        <div style={{ marginTop: 8 }}>
          <strong>Total bytes captured:</strong> {prettyBytes(status.totalBytes || 0)}
        </div>
      </Paper>

      {/* Render last completed run */}
      {lastRun?.run && !stopping && <RuntimeScanResults results={lastRun} />}

      {/* Stop-in-progress overlay */}
      {stopping && (
        <Backdrop open={stopping}>
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
    </div>
  );
}

export default RuntimeScanInterceptor;
