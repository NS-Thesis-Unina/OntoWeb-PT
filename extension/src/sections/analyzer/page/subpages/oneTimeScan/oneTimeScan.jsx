import { Backdrop, Button, CircularProgress, Paper, Typography, Zoom, Alert } from "@mui/material";
import "./oneTimeScan.css";
import analyzerReactController from "../../../analyzerController";
import Collapsible from "../../../../../components/collapsible/collapsible";
import { useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import OneTimeScanResults from "../components/oneTimeScanResults/oneTimeScanResults";
import { acquireLock, releaseLock, getLock, subscribeLockChanges, OWNERS } from "../../../../../scanLock";
import browser from "webextension-polyfill";

function OneTimeScanAnalyzer(){

  const OWNER = OWNERS.ANALYZER_ONETIME;

  const [loading, setLoading] = useState(true);
  const [loadSource, setLoadSource] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [globalLock, setGlobalLock] = useState(null);

  useEffect(() => {
    const off = analyzerReactController.onMessage({
      onScanComplete: (data) => {
        if(data){
          setResults(data);
          setScanning(false);
          setLoadSource(null);
          setLoading(false);
          enqueueSnackbar("One-Time scan complete successfully! Results below.", { variant: "success" });
          releaseLock(OWNER);
        }
      },
      onScanError: (msg) => {
        enqueueSnackbar(msg || "Scanning failed! Retry.", { variant: "error" });
        setScanning(false);
        releaseLock(OWNER);
      },
    });
    return () => off();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setResults(null);
      setGlobalLock(await getLock());
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id ?? null;

        if (tabId != null) {
          const perTab = await analyzerReactController.getSessionLastResultForTab(tabId);
          if (perTab?.results) {
            setResults(perTab);
            setLoadSource("session_by_tab");
            setLoading(false);
            enqueueSnackbar("One-Time scan loaded from Tab sessionStorage.", { variant: "info" })
            return;
          }
        }

        const globalSess = await analyzerReactController.getSessionLastResult();
        if (globalSess?.results) {
          setResults(globalSess);
          setLoadSource("session");
          setLoading(false);
          enqueueSnackbar("One-Time scan loaded from sessionStorage.", { variant: "info" })
          return;
        }

        const local = await analyzerReactController.getLocalScanResults();
        if (Array.isArray(local) && local.length) {
          const latest = [...local].sort((a, b) => {
            const ta = a?.results?.meta?.timestamp ?? (Number((a.key || "").replace("analyzerResults_", "")) || 0);
            const tb = b?.results?.meta?.timestamp ?? (Number((b.key || "").replace("analyzerResults_", "")) || 0);
            return tb - ta;
          })[0];

          if (latest?.results?.results && latest?.results?.meta) {
            setResults(latest.results);
            setLoadSource("local");
            setLoading(false);
            enqueueSnackbar("One-Time scan loaded from localStorage.", { variant: "info" })
            return;
          }
        }
        setLoading(false);
      } catch {
        setLoading(false);
        enqueueSnackbar("Error loading previous results.", { variant: "error" });
      }
    })();

    const offSub = subscribeLockChanges((n) => setGlobalLock(n ?? null));
    return () => offSub();
  }, []);

  const handleOneTimeScan = async () => {
    const attempt = await acquireLock(OWNER, "Analyzer One-Time");
    if (!attempt.ok) {
      const l = attempt.lock;
      enqueueSnackbar(`Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`, { variant: "warning" });
      return;
    }

    try {
      setResults(null);
      setScanning(true);
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error("No active tab found.");
      }
      analyzerReactController.sendStartOneTimeScan(tab.id);
    } catch (e) {
      enqueueSnackbar(e.msg || "Error during One-Time Scan occurred!", { variant: "error" });
      setScanning(false);
      releaseLock(OWNER);
    }
  };

  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  if(loading){
    return(
      <div className="otsanalyzer-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    )
  }

  return(
    <div className="otsanalyzer-div">
      {disabledByLock && (
        <Alert severity="info" sx={{ mb: 1, width: "100%" }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Please stop it before starting Analyzer One-Time.
        </Alert>
      )}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Analyzer’s One-Time Scan</strong> takes a snapshot of the page 
            exactly as delivered, with no simulated interactions or navigation. It returns 
            a static, structured view of what the page declares and shows (head, body, and 
            DOM statistics) for a quick check of content, loaded references, and complexity.
          </Typography>
        </Zoom>
      </Paper>
      <Collapsible defaultOpen={false} title="Info Output">
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
        onClick={handleOneTimeScan}
        className="scanButton"
        variant="contained"
        size="large"
        loading={scanning}
        loadingIndicator="Scan in progress..."
        disabled={disabledByLock || scanning}
      >
        {!results ? "start scan":"new scan"}
      </Button>
      {results && <OneTimeScanResults loadSource={loadSource} results={results} />}
    </div>
  )
}

export default OneTimeScanAnalyzer;