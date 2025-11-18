import './scan.css';
import { Backdrop, Button, CircularProgress, Paper, Typography, Zoom, Alert } from '@mui/material';
import Collapsible from '../../../../../components/collapsible/collapsible';
import techStackReactController from '../../../techstackController';
import { useCallback, useEffect, useState } from 'react';
import { formatWhen, getDomainAccurate } from '../../../../../libs/formatting';
import ScanResults from '../components/scanResults/scanResults';
import { enqueueSnackbar } from 'notistack';
import {
  acquireLock,
  releaseLock,
  getLock,
  subscribeLockChanges,
  OWNERS,
} from '../../../../../scanLock';

/**
 * **ScanTechStack**
 *
 * Architectural Role:
 *   React UI → TechStackReactController → background → TechStackEngine
 *
 * Responsibilities:
 * - Manage one-time TechStack scans (start, status, results, errors)
 * - Load the last available scan for the current tab (tab-session → session → local)
 * - Enforce global scan-locking to prevent concurrent scans across tools
 * - Display results through <ScanResults />
 * - Provide UI explanation of the output (Info Output section)
 *
 * Main Flow:
 *  1. On mount:
 *       • Load last available result (tab session / session / local)
 *       • Subscribe to background events
 *       • Listen for scan-lock changes
 *  2. When "Start Scan" is clicked:
 *       • Acquire scan lock
 *       • Send start request through TechStackReactController
 *  3. When scan completes (background → React):
 *       • Inject metadata (domain, date)
 *       • Display result and notify user
 *  4. When scan fails:
 *       • Show error
 *       • Release lock
 *
 * Notes:
 * - No scanning logic is implemented here. Everything is delegated to:
 *     → techStackReactController
 *     → TechStackBackgroundController
 *     → TechStackEngine
 */
function ScanTechStack() {
  // Scan-lock owner name for TechStack one-time scan
  const OWNER = OWNERS.TECHSTACK_ONETIME;

  // ----------------------------
  // Component State
  // ----------------------------
  const [loading, setLoading] = useState(true); // Loading previous scan
  const [loadSource, setLoadSource] = useState(null); // Where the last scan was loaded from
  const [scanning, setScanning] = useState(false); // Is a scan currently running?
  const [results, setResults] = useState(null); // Loaded or fresh scan results
  const [globalLock, setGlobalLock] = useState(null); // Global scan lock object

  // =====================================================================
  // On Mount: Load last available scan + Subscribe to background events
  // =====================================================================
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        // Load global lock status
        setGlobalLock(await getLock());

        // Identify active tab and load last available scan
        const tabId = await techStackReactController.getCurrentTabId();
        const res = await techStackReactController.loadLastAvailable(tabId);

        if (!mounted) return;

        if (res.data !== null) {
          // Inject formatted domain + date to metadata
          const domain = getDomainAccurate(res.data.meta.url);
          const date = formatWhen(res.data.meta.timestamp);
          res.data = {
            ...res.data,
            meta: { ...res.data.meta, domain, date },
          };

          // Notify user of load source
          if (res.source === 'session_by_tab') {
            enqueueSnackbar('Scan loaded from Tab sessionStorage.', {
              variant: 'info',
            });
          } else if (res.source === 'session') {
            enqueueSnackbar('Scan loaded from sessionStorage.', {
              variant: 'info',
            });
          } else if (res.source === 'local') {
            enqueueSnackbar('Scan loaded from localStorage.', {
              variant: 'info',
            });
          }

          setLoadSource(res.source);
          setResults(res.data);
        }
      } catch {
        enqueueSnackbar('Error loading previous results.', {
          variant: 'error',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // ---------------------------------------------------------
    // Background → UI events subscription (scanComplete / scanError)
    // ---------------------------------------------------------
    const offMsg = techStackReactController.onMessage({
      onScanComplete: (p) => {
        // Enrich metadata (domain + date)
        const domain = getDomainAccurate(p.meta.url);
        const date = formatWhen(p.meta.timestamp);
        p = { ...p, meta: { ...p.meta, domain, date } };

        setLoadSource('scan');
        setResults(p);

        enqueueSnackbar('Scan complete successfully! Results below.', {
          variant: 'success',
        });

        setScanning(false);
        releaseLock(OWNER);
      },

      onScanError: (msg) => {
        enqueueSnackbar(msg || 'Scanning failed! Retry.', {
          variant: 'error',
        });

        setScanning(false);
        releaseLock(OWNER);
      },
    });

    // ---------------------------------------------------------
    // Global Lock listener
    // ---------------------------------------------------------
    const offSub = subscribeLockChanges(async (n) => setGlobalLock(n ?? null));

    // Cleanup
    return () => {
      mounted = false;
      offMsg();
      offSub();
    };
  }, []);

  // =====================================================================
  // Start Scan (Acquire Lock + Trigger Background Scan)
  // =====================================================================
  const startScan = useCallback(async () => {
    const attempt = await acquireLock(OWNER, 'Techstack One-Time');

    // If another scan is running globally
    if (!attempt.ok) {
      const l = attempt.lock;
      enqueueSnackbar(
        `Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`,
        { variant: 'warning' }
      );
      return;
    }

    setScanning(true);

    const tabId = await techStackReactController.getCurrentTabId();
    techStackReactController.sendStartOneTimeStackScan(tabId);
  }, []);

  // Disable scan button if another tool owns the lock
  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  // ======================================================================
  // Initial Loading Screen
  // ======================================================================
  if (loading) {
    return (
      <div className="scantechstack-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  // ======================================================================
  // Main Render
  // ======================================================================
  return (
    <div className="scantechstack-div">
      {/* Active scan warning */}
      {disabledByLock && (
        <Alert severity="info" sx={{ mb: 1, width: '100%' }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Please
          stop it before starting Techstack.
        </Alert>
      )}

      {/* Description Panel */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Technology Stack</strong> identifies and summarizes the technologies and
            services used by a web page, aggregating evidence from headers, scripts, cookies,
            storage, and static analyses. It serves as a starting point for technical
            reconnaissance: providing both a quick overview (what is there) and the details needed
            to conduct targeted checks and prepare reports.
          </Typography>
        </Zoom>
      </Paper>

      {/* Info Output Section */}
      <Collapsible defaultOpen={false} title="Info Output">
        <ul className="ul">
          <li>
            <strong>Technologies</strong>: concise list of detected libraries, frameworks, and
            services.
          </li>
          <li>
            <strong>SecureHeaders</strong>: results of security header checks (e.g., HSTS, CSP,
            X-Content-Type-Options).
          </li>
          <li>
            <strong>WAF</strong>: identifies Web Application Firewalls / CDNs in use.
          </li>
          <li>
            <strong>Cookies</strong>: detected cookies with domain & HttpOnly indicators.
          </li>
          <li>
            <strong>Storage</strong>: dump of localStorage/sessionStorage.
          </li>
          <li>
            <strong>Raw</strong>: complete detailed output for deeper analysis.
          </li>
        </ul>
      </Collapsible>

      {/* Scan Button */}
      <Button
        onClick={startScan}
        className="scanButton"
        variant="contained"
        size="large"
        loading={scanning}
        loadingIndicator="Scan in progress..."
        disabled={disabledByLock || scanning}
      >
        {!results ? 'start scan' : 'new scan'}
      </Button>

      {/* Results Display */}
      {results && <ScanResults results={results} loadSource={loadSource} />}
    </div>
  );
}

export default ScanTechStack;
