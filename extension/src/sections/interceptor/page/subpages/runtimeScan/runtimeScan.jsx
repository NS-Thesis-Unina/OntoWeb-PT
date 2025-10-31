import { Backdrop, Button, Chip, CircularProgress, Grid, Paper, Typography, Zoom } from "@mui/material";
import "./runtimeScan.css";
import Collapsible from '../../../../../components/collapsible/collapsible';
import { useCallback, useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import interceptorReactController from "../../../interceptorController";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import RuntimeScanResults from "../components/runtimeScanResults/runtimeScanResults";

function prettyBytes(n = 0) {
  if (!Number.isFinite(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${n.toFixed( (u===0)?0:1 )} ${units[u]}`;
}

function RuntimeScanInterceptor(){

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ active: false, startedAt: 0, totalEvents: 0, pagesCount: 0, totalBytes: 0 });
  const [stopping, setStopping] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const refreshStatus = useCallback(async () => {
    const s = await interceptorReactController.getStatus();
    setStatus(s || { active: false, startedAt: 0, totalEvents: 0, pagesCount: 0, totalBytes: 0 });
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
      }
    });

    return () => off();
  }, [refreshStatus, loadLastRun]);

  const handleToggle = async () => {
    if(status.active){
      setStopping(true);
      await interceptorReactController.stop();
    } else {
      await interceptorReactController.start();
      refreshStatus();
    }
  };

  if (loading){
    return (
      <div className="rtinterceptor-div">
        <Backdrop open={loading}><CircularProgress color="inherit" /></Backdrop>
      </div>
    );
  }

  return (
    <div className="rtinterceptor-div">
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
        <ul className="ul">
          <li><strong>request</strong>: url, method, headers, body (testo o base64), size.</li>
          <li><strong>response</strong>: status, statusText, headers, body (testo o base64), size.</li>
          <li><strong>meta</strong>: pageUrl, tabId (se disponibile), ts (ms).</li>
        </ul>
        <p>I body binari o superiori alla soglia vengono salvati in <code>base64</code>.</p>
      </Collapsible>

      <Button onClick={handleToggle} className="scanButton" variant="contained" size="large">
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

      {lastRun?.run && !stopping && (
        <RuntimeScanResults results={lastRun} />
      )}

      {stopping && (
        <Backdrop open={stopping}><CircularProgress color="inherit" /></Backdrop>
      )}
    </div>
  );
}

export default RuntimeScanInterceptor;
