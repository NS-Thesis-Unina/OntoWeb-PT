import { Backdrop, Button, Chip, CircularProgress, Grid, Paper, Typography, Zoom, Alert } from "@mui/material";
import "./runtimeScan.css";
import Collapsible from "../../../../../components/collapsible/collapsible";
import { useCallback, useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import analyzerReactController from "../../../analyzerController";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import RuntimeScanResults from "../components/runtimeScanResults/runtimeScanResults";
import { acquireLock, releaseLock, getLock, subscribeLockChanges, OWNERS } from "../../../../../scanLock";

function RuntimeScanAnalyzer(){

  const OWNER = OWNERS.ANALYZER_RUNTIME;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ runtimeActive: false, totalScans: 0, pagesCount: 0, startedAt: 0, active: false });
  const [stopping, setStopping] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [globalLock, setGlobalLock] = useState(null);

  const refreshStatus = useCallback(async () => {
    const s = await analyzerReactController.getScanStatus();
    setStatus(s || { runtimeActive: false, totalScans: 0, pagesCount: 0, startedAt: 0, active: false });

    const cur = await getLock();
    if ((s?.runtimeActive || s?.active) && (!cur || cur.owner !== OWNER)) {
      await acquireLock(OWNER, "Analyzer Runtime");
      setGlobalLock(await getLock());
    }
  }, []);

  const loadLastRun = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyzerReactController.getLastRuntimeResults();
      setLastRun(res?.run ? res : { key: null, run: null });
      if(res?.run) enqueueSnackbar("Latest Runtime scan loaded from storage.", { variant: "info" })
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    loadLastRun();
    (async () => setGlobalLock(await getLock()))();

    const off = analyzerReactController.onMessage({
      onRuntimeScanUpdate: (url, totals) => {
        if (totals) {
          setStatus((s) => ({
            ...s,
            runtimeActive: true,
            active: true,
            totalScans: totals.totalScans ?? s.totalScans,
            pagesCount: totals.pagesCount ?? s.pagesCount,
            startedAt: totals.startedAt ?? s.startedAt
          }));
        }
      },
      onRuntimeScanComplete: (payload) => {
        setStopping(false);
        setStatus((s) => ({ ...s, runtimeActive: false, active: false }));
        if (payload?.run){
          setLastRun({ key: payload.key, run: payload.run });
          enqueueSnackbar("Runtime scan complete successfully! Results below.", { variant: "success" })
        } else loadLastRun();
        // release lock se è nostro
        releaseLock(OWNER);
      }
    });

    const offSub = subscribeLockChanges((n) => setGlobalLock(n ?? null));

    return () => { off(); offSub(); };
  }, [refreshStatus, loadLastRun]);

  const handleRuntimeScan = async () => {
    if(status.runtimeActive || status.active){
      setStopping(true);
      await analyzerReactController.sendStopRuntimeScan();
    } else {
      const attempt = await acquireLock(OWNER, "Analyzer Runtime");
      if (!attempt.ok) {
        const l = attempt.lock;
        enqueueSnackbar(`Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`, { variant: "warning" });
        return;
      }
      await analyzerReactController.sendStartRuntimeScan();
      refreshStatus();
    }
  }

  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  if(loading){
    return(
      <div className="rtsanalyzer-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    )
  }

  return(
    <div className="rtsanalyzer-div">
      {disabledByLock && !status.runtimeActive && !status.active && (
        <Alert severity="info" sx={{ mb: 1, width: "100%" }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Stop it before starting Analyzer Runtime.
        </Alert>
      )}

      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Analyzer’s Runtime Scan</strong> operates continuously as the user browses,
            automatically capturing the same structured snapshot as a one-time scan each time a page
            completes loading. ...
          </Typography>
        </Zoom>
      </Paper>
      <Collapsible defaultOpen={false} title="Info Output">
        <p>For each visited page, the output includes the sections below and also records when the runtime scan was started and when it was stopped.</p>
        <strong>Head</strong>
        <ul className="ul">
          <li><strong>title</strong>: page title.</li>
          <li><strong>meta</strong>: metadata entries (name/property and content).</li>
          <li><strong>links</strong>: relations and targets (e.g., stylesheet, preload, canonical) as <code>rel</code>/<code>href</code> pairs.</li>
          <li><strong>scripts</strong>: external script sources and a short preview of inline code (possibly truncated).</li>
        </ul>

        <strong>Body</strong>
        <ul className="ul">
          <li><strong>forms</strong>: form endpoint and method with detected fields (tag, name, type, value, placeholder).</li>
          <li><strong>iframes</strong>: embedded source and title.</li>
          <li><strong>links</strong>: URL and anchor text.</li>
          <li><strong>images</strong>: source path and alt text.</li>
          <li><strong>videos / audios</strong>: media source and whether controls are present.</li>
          <li><strong>headings (h1–h6)</strong>: hierarchical heading texts.</li>
          <li><strong>lists (ul/ol)</strong>: list type and item texts.</li>
        </ul>

        <strong>Stats</strong>
        <ul className="ul">
          <li><strong>totalElements</strong>: total number of DOM nodes.</li>
          <li><strong>depth</strong>: maximum DOM tree depth.</li>
          <li><strong>tagCount</strong>: per-tag element counts.</li>
        </ul>
      </Collapsible>
      <Button
        onClick={handleRuntimeScan}
        className="scanButton"
        variant="contained"
        size="large"
        disabled={disabledByLock && !(status.runtimeActive || status.active)}
      >
        {(stopping || (!status.runtimeActive && !status.active)) ? "Start scan" : "Stop scan"}
      </Button>

      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}><strong>Status</strong></Grid>
          <Grid size={3}><strong>Started at</strong></Grid>
          <Grid size={3}><strong>Unique pages (live)</strong></Grid>
          <Grid size={3}><strong>Total scans (live)</strong></Grid>
          <Grid size={3} className="grid-newline-items">
            <Chip 
              icon={<FiberManualRecordIcon />} 
              label={(status.runtimeActive || status.active) ? "RUNNING" : "STOPPED"}
              color={(status.runtimeActive || status.active) ? "success" : "error"}
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
              {status.totalScans ?? 0}
          </Grid>
        </Grid>
      </Paper>

      {lastRun?.run && !stopping && <RuntimeScanResults results={lastRun} />}

      {stopping && (
        <Backdrop open={stopping}><CircularProgress color="inherit" /></Backdrop>
      )}
    </div>
  )
}

export default RuntimeScanAnalyzer;