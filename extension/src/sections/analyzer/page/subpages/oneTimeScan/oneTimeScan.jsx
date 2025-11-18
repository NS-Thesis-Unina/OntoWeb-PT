import './oneTimeScan.css';
import { Backdrop, Button, CircularProgress, Paper, Typography, Zoom, Alert } from '@mui/material';
import analyzerReactController from '../../../analyzerController';
import Collapsible from '../../../../../components/collapsible/collapsible';
import { useEffect, useState } from 'react';
import { enqueueSnackbar } from 'notistack';
import OneTimeScanResults from '../components/oneTimeScanResults/oneTimeScanResults';
import {
  acquireLock,
  releaseLock,
  getLock,
  subscribeLockChanges,
  OWNERS,
} from '../../../../../scanLock';
import browser from 'webextension-polyfill';

/**
 * **OneTimeScanAnalyzer**
 *
 * Architectural Role:
 *   Analyzer → Analyzer One-Time Scan (manual, single-shot DOM analysis)
 *
 * Purpose:
 *   Performs a single, synchronous snapshot of the current page as delivered
 *   (no emulated interactions or navigation). Ideal for quick inspection of:
 *     - Head metadata
 *     - Structural DOM content
 *     - Forms, scripts, media, links
 *     - DOM statistics and complexity
 *
 * Responsibilities:
 *   - Coordinate a one-time analysis for the active browser tab
 *   - Manage lifecycle of scan: start → receive results → display
 *   - Retrieve previously stored results from:
 *       • tab sessionStorage
 *       • extension sessionStorage
 *       • extension localStorage (persistent archive)
 *   - Enforce global scan exclusivity via scanLock (shared with Runtime Scan & Interceptor)
 *
 * Interactions:
 *   - analyzerReactController.sendStartOneTimeScan(tabId)
 *   - analyzerReactController.onMessage() → onScanComplete / onScanError
 *   - analyzerReactController.getSessionLastResultForTab(tabId)
 *   - analyzerReactController.getSessionLastResult()
 *   - analyzerReactController.getLocalScanResults()
 *   - browser.tabs.query() → target the active tab
 *   - scanLock API → acquireLock / releaseLock / subscribeLockChanges
 *
 * Important Notes:
 *   - A scan cannot start if any other scanning subsystem holds the lock.
 *   - The component automatically restores the last results (if any).
 *   - The loadSource flag indicates where results came from (per-tab session,
 *     global session, or local storage).
 */
function OneTimeScanAnalyzer() {
  /** Unique lock owner ID for this subsystem */
  const OWNER = OWNERS.ANALYZER_ONETIME;

  /** Component state */
  const [loading, setLoading] = useState(true); // Global loading (initialization)
  const [loadSource, setLoadSource] = useState(null); // Source of restored results: "session_by_tab", "session", "local"
  const [scanning, setScanning] = useState(false); // Scan-in-progress flag
  const [results, setResults] = useState(null); // Current scan's results
  const [globalLock, setGlobalLock] = useState(null); // Active global lock state

  /**
   * Subscribes to background analyzer events:
   *   - onScanComplete: result successfully computed
   *   - onScanError: fatal or unexpected error
   */
  useEffect(() => {
    const off = analyzerReactController.onMessage({
      onScanComplete: (data) => {
        if (data) {
          setResults(data);
          setScanning(false);
          setLoadSource(null);
          setLoading(false);
          enqueueSnackbar('One-Time scan complete successfully! Results below.', {
            variant: 'success',
          });
          releaseLock(OWNER);
        }
      },

      onScanError: (msg) => {
        enqueueSnackbar(msg || 'Scanning failed! Retry.', { variant: 'error' });
        setScanning(false);
        releaseLock(OWNER);
      },
    });

    return () => off();
  }, []);

  /**
   * On mount:
   *   - Load last results from (in priority order):
   *       1. Tab sessionStorage
   *       2. Global sessionStorage
   *       3. Local storage (persistent)
   *   - Subscribe to external lock changes
   */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setResults(null);
      setGlobalLock(await getLock());

      try {
        /** --------------------------------------------------------------------
         * 1. Per-tab session result
         * ------------------------------------------------------------------ */
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;

        if (tabId != null) {
          const perTab = await analyzerReactController.getSessionLastResultForTab(tabId);
          if (perTab?.results) {
            setResults(perTab);
            setLoadSource('session_by_tab');
            setLoading(false);
            enqueueSnackbar('One-Time scan loaded from Tab sessionStorage.', { variant: 'info' });
            return;
          }
        }

        /** --------------------------------------------------------------------
         * 2. Global sessionStorage
         * ------------------------------------------------------------------ */
        const globalSess = await analyzerReactController.getSessionLastResult();
        if (globalSess?.results) {
          setResults(globalSess);
          setLoadSource('session');
          setLoading(false);
          enqueueSnackbar('One-Time scan loaded from sessionStorage.', { variant: 'info' });
          return;
        }

        /** --------------------------------------------------------------------
         * 3. Local storage (persistent)
         * ------------------------------------------------------------------ */
        const local = await analyzerReactController.getLocalScanResults();
        if (Array.isArray(local) && local.length) {
          // Determine latest record via timestamp or numeric suffix
          const latest = [...local].sort((a, b) => {
            const ta =
              a?.results?.meta?.timestamp ??
              (Number((a.key || '').replace('analyzerResults_', '')) || 0);
            const tb =
              b?.results?.meta?.timestamp ??
              (Number((b.key || '').replace('analyzerResults_', '')) || 0);
            return tb - ta;
          })[0];

          if (latest?.results?.results && latest?.results?.meta) {
            setResults(latest.results);
            setLoadSource('local');
            setLoading(false);
            enqueueSnackbar('One-Time scan loaded from localStorage.', { variant: 'info' });
            return;
          }
        }

        // No previous results found
        setLoading(false);
      } catch {
        setLoading(false);
        enqueueSnackbar('Error loading previous results.', { variant: 'error' });
      }
    })();

    /** Subscribe to lock state changes */
    const offSub = subscribeLockChanges((n) => setGlobalLock(n ?? null));

    return () => offSub();
  }, []);

  /**
   * Trigger a one-time scan:
   *   - Acquire lock
   *   - Reset previous results
   *   - Identify active tab
   *   - Dispatch start-scan command to background
   */
  const handleOneTimeScan = async () => {
    const attempt = await acquireLock(OWNER, 'Analyzer One-Time');
    if (!attempt.ok) {
      const l = attempt.lock;
      enqueueSnackbar(
        `Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`,
        { variant: 'warning' }
      );
      return;
    }

    try {
      setResults(null);
      setScanning(true);

      // Identify active tab
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error('No active tab found.');
      }

      analyzerReactController.sendStartOneTimeScan(tab.id);
    } catch (e) {
      enqueueSnackbar(e.msg || 'Error during One-Time Scan occurred!', { variant: 'error' });
      setScanning(false);
      releaseLock(OWNER);
    }
  };

  /** True when another subsystem owns the lock */
  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  /** Initial loading state while retrieving previous results */
  if (loading) {
    return (
      <div className="otsanalyzer-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  return (
    <div className="otsanalyzer-div">
      {/* Lock conflict warning */}
      {disabledByLock && (
        <Alert severity="info" sx={{ mb: 1, width: '100%' }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Please
          stop it before starting Analyzer One-Time.
        </Alert>
      )}

      {/* Description */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Analyzer’s One-Time Scan</strong> takes a snapshot of the page exactly as
            delivered, with no simulated interactions or navigation. It returns a static, structured
            view of what the page declares and shows (head, body, and DOM statistics) for a quick
            check of content, loaded references, and complexity.
          </Typography>
        </Zoom>
      </Paper>

      {/* Output explanation */}
      <Collapsible defaultOpen={false} title="Info Output">
        <strong>Head</strong>
        <ul className="ul">
          <li>
            <strong>title</strong>: page title.
          </li>
          <li>
            <strong>meta</strong>: metadata entries.
          </li>
          <li>
            <strong>links</strong>: rel/href pairs.
          </li>
          <li>
            <strong>scripts</strong>: external and inline previews.
          </li>
        </ul>

        <strong>Body</strong>
        <ul className="ul">
          <li>
            <strong>forms</strong>: detected form fields.
          </li>
          <li>
            <strong>iframes</strong>: embedded content.
          </li>
          <li>
            <strong>links</strong>: anchors and URLs.
          </li>
          <li>
            <strong>images</strong>: src and alt.
          </li>
          <li>
            <strong>videos / audios</strong>: media resources.
          </li>
          <li>
            <strong>headings</strong>: h1–h6 hierarchy.
          </li>
          <li>
            <strong>lists</strong>: list items.
          </li>
        </ul>

        <strong>Stats</strong>
        <ul className="ul">
          <li>
            <strong>totalElements</strong>: DOM node count.
          </li>
          <li>
            <strong>depth</strong>: maximum DOM tree depth.
          </li>
          <li>
            <strong>tagCount</strong>: tag frequency map.
          </li>
        </ul>
      </Collapsible>

      {/* Scan button */}
      <Button
        onClick={handleOneTimeScan}
        className="scanButton"
        variant="contained"
        size="large"
        loading={scanning}
        loadingIndicator="Scan in progress..."
        disabled={disabledByLock || scanning}
      >
        {!results ? 'start scan' : 'new scan'}
      </Button>

      {/* Results viewer */}
      {results && <OneTimeScanResults loadSource={loadSource} results={results} />}
    </div>
  );
}

export default OneTimeScanAnalyzer;
