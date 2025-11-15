import { Backdrop, Button, Chip, CircularProgress, Grid, Paper, Typography, Zoom, Alert } from "@mui/material";
import "./runtimeScan.css";
import Collapsible from '../../../../../components/collapsible/collapsible';
import { useCallback, useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import interceptorReactController from "../../../interceptorController";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import RuntimeScanResults from "../components/runtimeScanResults/runtimeScanResults";
import { acquireLock, releaseLock, getLock, subscribeLockChanges, OWNERS } from "../../../../../scanLock";
import browser from "webextension-polyfill";
import { prettyBytes } from "../../../../../libs/formatting";

function RuntimeScanInterceptor(){

  const OWNER = OWNERS.INTERCEPTOR_RUNTIME;

  const EMPTY_STATUS = { active: false, startedAt: 0, totalEvents: 0, pagesCount: 0, totalBytes: 0 };

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [stopping, setStopping] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [globalLock, setGlobalLock] = useState(null);

  const refreshStatus = useCallback(async () => {
    const s = await interceptorReactController.getStatus();

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

    const cur = await getLock();
    if (s?.active && (!cur || cur.owner !== OWNER)) {
      await acquireLock(OWNER, "Interceptor Runtime");
      setGlobalLock(await getLock());
    }
  }, []);

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
      if (run) enqueueSnackbar("Latest Interceptor run loaded from storage.", { variant: "info" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    loadLastRun();
    (async () => setGlobalLock(await getLock()))();

    const off = interceptorReactController.onMessage({
      onUpdate: (totals) => {
        if (totals) {
          setStatus(s => ({
            ...s,
            active: true,
            startedAt: totals.startedAt ?? s.startedAt,
            totalEvents: totals.totalEvents ?? s.totalEvents,
            pagesCount: totals.pagesCount ?? s.pagesCount,
            totalBytes: totals.totalBytes ?? s.totalBytes
          }));
        }
      },
      onComplete: async (payload) => {
        setStopping(false);
        setStatus(s => ({ ...s, active: false }));

        const key = payload?.key;
        if (key) {
          const all = await browser.storage.local.get(key);
          const run = all?.[key] || null;
          if (run) {
            setLastRun({ key, run });
            enqueueSnackbar("Interceptor run completed. Results loaded below.", { variant: "success" });
          } else {
            await loadLastRun();
          }
        } else {
          await loadLastRun();
        }

        releaseLock(OWNER);
      }
    });

    const offSub = subscribeLockChanges((n) => setGlobalLock(n ?? null));
    return () => { off(); offSub(); };
  }, [refreshStatus, loadLastRun]);

  const handleToggle = async () => {
    if(status.active){
      setStopping(true);
      await interceptorReactController.stop();
    } else {
      const attempt = await acquireLock(OWNER, "Interceptor Runtime");
      if (!attempt.ok) {
        const l = attempt.lock;
        enqueueSnackbar(`Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`, { variant: "warning" });
        return;
      }
      await interceptorReactController.start({
        types: { http: true, beacon: true, sse: true, websocket: true },
        maxBodyBytes: 1572864 // 1.5 MB
      });
      refreshStatus();
    }
  };

  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  if (loading){
    return (
      <div className="rtinterceptor-div">
        <Backdrop open={loading}><CircularProgress color="inherit" /></Backdrop>
      </div>
    );
  }

  return (
    <div className="rtinterceptor-div">
      {disabledByLock && !status.active && (
        <Alert severity="info" sx={{ mb: 1, width: "100%" }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Stop it before starting Interceptor.
        </Alert>
      )}

      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Interceptor</strong> captures HTTP requests and responses as you browse, directly from the page
            context (fetch/XMLHttpRequest). For each event it records the method, URL, headers, <em>request body</em>,
            status, <em>response body</em> (with a size limit), and a timestamp.
          </Typography>
        </Zoom>
      </Paper>

      <Collapsible defaultOpen={false} title="Info Output">
        <p>
          The runtime network capture produces a structured record for each intercepted HTTP event
          (fetch and XHR), grouped by page/domain and summarized in the grid. Each event includes
          the sections below.
        </p>
        <strong>Request</strong>
        <ul className="ul">
          <li><strong>url</strong>: absolute request URL (http/https).</li>
          <li><strong>method</strong>: HTTP verb (e.g., <code>GET</code>, <code>POST</code>).</li>
          <li><strong>headers</strong>: request headers as a case-preserving object.</li>
          <li><strong>body</strong>: text for textual payloads, Base64 for binary/large bodies.</li>
          <li><strong>bodyEncoding</strong>: <code>text</code>, <code>base64</code>, or <code>none</code>.</li>
          <li><strong>bodySize</strong>: original payload size in bytes.</li>
          <li><strong>truncated</strong>: <code>true</code> when the body exceeds the configured threshold.</li>
        </ul>

        <strong>Response</strong>
        <ul className="ul">
          <li><strong>status</strong> and <strong>statusText</strong> returned by the server.</li>
          <li><strong>headers</strong>: response headers stored as an object.</li>
          <li><strong>body</strong>: text for textual payloads, Base64 for binary/large bodies.</li>
          <li><strong>bodyEncoding</strong> and <strong>bodySize</strong>, plus <strong>truncated</strong> flag.</li>
          <li><strong>servedFromCache</strong> and <strong>fromServiceWorker</strong> when detectable.</li>
        </ul>

        <strong>Meta</strong>
        <ul className="ul">
          <li><strong>pageUrl</strong>, <strong>tabId</strong> (when available), <strong>ts</strong> (ms).</li>
        </ul>

        <strong>Grouping &amp; summary</strong>
        <ul className="ul">
          <li>Events are grouped by the requesting page’s domain/URL.</li>
          <li>The header reports start/stop, total events, unique pages, and total bytes.</li>
        </ul>

        <strong>Grid columns</strong>
        <ul className="ul">
          <li><strong>Method</strong>, <strong>URL</strong>, <strong>Status</strong>, <strong>Status Text</strong>, <strong>Content-Type</strong>, with a details dialog for full inspection.</li>
        </ul>
      </Collapsible>

      <Button
        onClick={handleToggle}
        className="scanButton"
        variant="contained"
        size="large"
        disabled={disabledByLock && !status.active}
      >
        {status.active ? "Stop interceptor" : "Start interceptor"}
      </Button>

      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}><strong>Status</strong></Grid>
          <Grid size={3}><strong>Started at</strong></Grid>
          <Grid size={3}><strong>Unique pages</strong></Grid>
          <Grid size={3}><strong>Total events</strong></Grid>

          <Grid size={3} className="grid-newline-items">
            <Chip
              icon={<FiberManualRecordIcon />}
              label={status.active ? "RUNNING" : "STOPPED"}
              color={status.active ? "success" : "error"}
              variant="outlined"
            />
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {status.startedAt ? new Date(status.startedAt).toLocaleString() : "—"}
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

      {lastRun?.run && !stopping && <RuntimeScanResults results={lastRun} />}

      {stopping && (
        <Backdrop open={stopping}><CircularProgress color="inherit" /></Backdrop>
      )}
    </div>
  );
}

export default RuntimeScanInterceptor;
