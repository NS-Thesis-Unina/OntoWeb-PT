import { Backdrop, Button, Chip, CircularProgress, Grid, Paper, Typography, Zoom, Alert } from "@mui/material";
import "./runtimeScan.css";
import Collapsible from '../../../../../components/collapsible/collapsible';
import { useCallback, useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import interceptorReactController from "../../../interceptorController";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import RuntimeScanResults from "../components/runtimeScanResults/runtimeScanResults";
import { acquireLock, releaseLock, getLock, subscribeLockChanges, OWNERS } from "../../../../../scanLock";

function prettyBytes(n = 0) {
  if (!Number.isFinite(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${n.toFixed( (u===0)?0:1 )} ${units[u]}`;
}

function RuntimeScanInterceptor(){

  const OWNER = OWNERS.INTERCEPTOR_RUNTIME;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ active: false, startedAt: 0, totalEvents: 0, pagesCount: 0, totalBytes: 0 });
  const [stopping, setStopping] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [globalLock, setGlobalLock] = useState(null);

  const refreshStatus = useCallback(async () => {
    const s = await interceptorReactController.getStatus();
    setStatus(s || { active: false, startedAt: 0, totalEvents: 0, pagesCount: 0, totalBytes: 0 });

    const cur = await getLock();
    if (s?.active && (!cur || cur.owner !== OWNER)) {
      await acquireLock(OWNER, "Interceptor Runtime");
      setGlobalLock(await getLock());
    }
  }, []);

  const loadLastRun = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interceptorReactController.getLastResults();
      setLastRun(res?.run ? res : { key: null, run: null });
      if(res?.run) enqueueSnackbar("Latest Interceptor run loaded from storage.", { variant: "info" });
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
      onComplete: (payload) => {
        setStopping(false);
        setStatus(s => ({ ...s, active: false }));
        if (payload?.run){
          setLastRun({ key: payload.key, run: payload.run });
          enqueueSnackbar("Interceptor run completed. Results loaded below.", { variant: "success" });
        } else {
          loadLastRun();
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
      // release nel callback onComplete
    } else {
      const attempt = await acquireLock(OWNER, "Interceptor Runtime");
      if (!attempt.ok) {
        const l = attempt.lock;
        enqueueSnackbar(`Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`, { variant: "warning" });
        return;
      }
      await interceptorReactController.start();
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
            <strong>Interceptor</strong> captures requests and responses as you browse, directly from the page context 
            (fetch/XMLHttpRequest). For each event it records the method, URL, headers, <em>request body</em>, status, 
            <em> response body</em> (with a size limit), and a timestamp. You can start or stop it at any time.
          </Typography>
        </Zoom>
      </Paper>

      <Collapsible defaultOpen={false} title="Info Output">
        <p>The runtime network capture returns a structured record for each intercepted event 
          (fetch, XHR, beacon, SSE, WebSocket), grouped by page/domain and summarized in the 
          grid. Each event contains the sections below.
        </p>
        <strong>Request</strong>
        <ul className="ul"> 
          <li>
            <strong>url</strong>: absolute request URL (may be extension, 
            http/https, ws/wss).
          </li> 
          <li>
            <strong>method</strong>: HTTP verb (e.g., GET, POST) or channel marker (e.g., 
            <code>WS_SEND</code> for outgoing WebSocket frames).</li> <li><strong>headers</strong>: 
            request headers as a case-preserving object.
          </li> 
          <li>
            <strong>body</strong>: request payload captured as text when textual, or Base64
             for binary/large bodies (see “Encoding & truncation”).
          </li> 
          <li>
            <strong>bodyEncoding</strong>: <code>text</code>, <code>base64</code>, or 
            <code>none</code>.
          </li> 
          <li>
            <strong>bodySize</strong>: original payload size in bytes (before truncation).
          </li> 
          <li>
            <strong>truncated</strong>: <code>true</code> if the captured body exceeds 
            the byte threshold.
          </li>
        </ul>

        <strong>Response</strong>
        <ul className="ul"> 
          <li>
            <strong>status</strong>: HTTP status code when available; special values may appear for non-HTTP channels 
            (e.g., <code>101</code> for WebSocket handshake, <code>0</code> for <code>sendBeacon</code> fire-and-forget).
          </li> 
          <li>
            <strong>statusText</strong>: status reason or channel label (e.g., “EventSource”, “WebSocket Message”). 
            If the request failed at the network level, a <code>networkError</code> string is provided.
          </li> 
          <li>
            <strong>headers</strong>: response headers as an object; key lookup in the UI is case-insensitive for
             convenience (e.g., <em>Content-Type</em>).
          </li> 
          <li>
            <strong>body</strong>: response payload captured as text when textual, or Base64 for binary/large 
            bodies (see “Encoding & truncation”).</li> <li><strong>bodyEncoding</strong>: <code>text</code>, 
            <code>base64</code>, or <code>none</code>.</li> <li><strong>bodySize</strong>: original payload 
            size in bytes (before truncation).
          </li> 
          <li>
            <strong>truncated</strong>: <code>true</code> if the captured body exceeds the byte threshold.
          </li> 
          <li>
            <strong>servedFromCache</strong>: <code>true</code> if the response was satisfied from cache 
            (when detectable).
          </li> 
          <li>
            <strong>fromServiceWorker</strong>: <code>true</code> if a Service Worker fulfilled the response 
            (when detectable).
          </li> 
        </ul>

        <strong>Meta</strong>
        <ul className="ul"> 
          <li>
            <strong>pageUrl</strong>: the page that issued the request.
          </li> 
          <li>
            <strong>tabId</strong>: browser tab identifier when available.
          </li> 
          <li>
            <strong>ts</strong>: request start timestamp in milliseconds since epoch.
          </li>
        </ul>

        <strong>Encoding & truncation</strong>
        <ul className="ul"> 
          <li>
            <strong>Text detection</strong>: payloads with textual MIME types (e.g., <code>text/*</code>, 
            <code>application/json</code>, <code>application/javascript</code>, <code>application/xml</code>, 
            <code>application/xhtml</code>, <code>application/x-www-form-urlencoded</code>) are decoded as UTF-8 text.
          </li> 
          <li>
            <strong>Binary handling</strong>: non-textual payloads are captured as <code>base64</code>.
          </li> 
          <li>
            <strong>Size cap</strong>: bodies larger than the configured threshold are sliced; the <code>truncated</code>
            flag indicates this, while <code>bodySize</code> still reflects the original size.
          </li> 
        </ul>

        <strong>Special channels</strong>
        <ul className="ul"> 
          <li>
            <strong>sendBeacon</strong>: logged as a POST-like request with immediate synthetic response 
            (<code>status: 0</code>), including encoded body info when available.
          </li> 
          <li>
            <strong>EventSource (SSE)</strong>: messages are recorded as response entries with channel labels; 
            headers/status reflect the stream context when observable.
          </li> 
          <li>
            <strong>WebSocket</strong>: outgoing frames appear as <code>WS_SEND</code> requests; incoming 
            frames as responses with <code>status: 101</code> (message markers). Text frames include text; 
            binary frames report size with <code>base64</code> encoding when captured.
          </li> 
        </ul>

        <strong>Grouping & summary</strong>
        <ul className="ul"> 
          <li>
            <strong>Per-domain grouping</strong>: events are grouped by the requesting page’s domain/URL. 
            Each group is shown in a collapsible grid with one row per request/response pair.
          </li> 
          <li>
            <strong>Run summary</strong>: the scan header reports start/stop times, total events, unique pages,
             and the aggregate <em>Total bytes</em> across captured payloads.
          </li> 
        </ul>

        <strong>Grid columns</strong>
        <ul className="ul"> 
          <li>
            <strong>Method</strong>, <strong>URL</strong>, <strong>Status</strong>, <strong>Status Text</strong>, 
            <strong>Content-Type</strong> are shown per row; an action button opens a dialog to inspect full 
            <em>request</em>, <em>response</em>, and all row fields.
          </li> 
        </ul> 
        
        <p>Binary bodies or bodies exceeding 
          the size threshold are stored as <code>base64</code>; the <code>bodyEncoding</code> and <code>truncated</code> 
          flags make this explicit.
        </p>
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
