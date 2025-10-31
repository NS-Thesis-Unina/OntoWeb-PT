import { Backdrop, Button, CircularProgress, Paper, Typography, Zoom, Alert } from "@mui/material";
import "./scan.css";
import Collapsible from "../../../../../components/collapsible/collapsible";
import techStackReactController from "../../../techstackController";
import { useCallback, useEffect, useState } from "react";
import { formatWhen, getDomainAccurate } from "../../../../../libs/formatting";
import ScanResults from "../components/scanResults/scanResults";
import { enqueueSnackbar } from "notistack";
import { acquireLock, releaseLock, getLock, subscribeLockChanges, OWNERS } from "../../../../../scanLock";

function ScanTechStack(){

  const OWNER = OWNERS.TECHSTACK_ONETIME;

  const [loading, setLoading] = useState(true);
  const [loadSource, setLoadSource] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [globalLock, setGlobalLock] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        setGlobalLock(await getLock());
        const tabId = await techStackReactController.getCurrentTabId();
        const res = await techStackReactController.loadLastAvailable(tabId);
        if (!mounted) return;
        if(res.data !== null){
          const domain = getDomainAccurate(res.data.meta.url);
          const date = formatWhen(res.data.meta.timestamp);
          res.data = {...res.data, meta: {...res.data.meta, domain, date}};
          if(res.source && res.source === "session_by_tab"){
            enqueueSnackbar("Scan loaded from Tab sessionStorage.", { variant: "info" })
          } else if (res.source === "session") {
            enqueueSnackbar("Scan loaded from sessionStorage.", { variant: "info" })
          } else if (res.source === "local") {
            enqueueSnackbar("Scan loaded from localStorage.", { variant: "info" })
          }
          setLoadSource(res.source);
          setResults(res.data);
        }
      } catch {
        enqueueSnackbar("Error loading previous results.", { variant: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const offMsg = techStackReactController.onMessage({
      onScanComplete: (p) => {
        const domain = getDomainAccurate(p.meta.url);
        const date = formatWhen(p.meta.timestamp);
        p = {...p, meta: {...p.meta, domain, date}};
        setLoadSource("scan");
        setResults(p);
        enqueueSnackbar('Scan complete successfully! Results below.', { variant: "success"});
        setScanning(false);
        releaseLock(OWNER);
      },
      onScanError: (msg) => {
        enqueueSnackbar(msg || "Scanning failed! Retry.", { variant: "error" });
        setScanning(false);
        releaseLock(OWNER);
      }
    });

    const offSub = subscribeLockChanges(async (n) => setGlobalLock(n ?? null));

    return () => {
      mounted = false;
      offMsg();
      offSub();
    };
  }, []);

  const startScan = useCallback(async () => {
    const attempt = await acquireLock(OWNER, "Techstack One-Time");
    if (!attempt.ok) {
      const l = attempt.lock;
      enqueueSnackbar(`Another scan is running (${l?.label || l?.owner}). Stop it before starting a new one.`, { variant: "warning" });
      return;
    }
    setScanning(true);
    const tabId = await techStackReactController.getCurrentTabId();
    techStackReactController.sendStartOneTimeStackScan(tabId);
  }, []);

  const disabledByLock = !!globalLock && globalLock.owner !== OWNER;

  if(loading){
    return(
      <div className="scantechstack-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    )
  }

  return(
    <div className="scantechstack-div">
      {disabledByLock && (
        <Alert severity="info" sx={{ mb: 1, width: "100%" }}>
          Another scan is running: <strong>{globalLock?.label || globalLock?.owner}</strong>. Please stop it before starting Techstack.
        </Alert>
      )}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Technology Stack</strong> identifies and summarizes the technologies and services used by a web page, 
            aggregating evidence from headers, scripts, cookies, storage, and static analyses. It serves as 
            a starting point for technical reconnaissance: providing both a quick overview (what is there) 
            and the details needed to conduct targeted checks and prepare reports.
          </Typography>
        </Zoom>
      </Paper>
      <Collapsible defaultOpen={false} title="Info Output">
        <ul className="ul">
          <li><strong>Technologies</strong>: concise list of detected libraries, frameworks, and services (name and version when available).</li>
          <li><strong>SecureHeaders</strong>: results of security header checks (e.g., HSTS, CSP, X-Content-Type-Options) with indication of missing or anomalous configurations.</li>
          <li><strong>WAF</strong>: identification of Web Application Firewalls, CDNs, or edge proxies in use (e.g., Cloudflare, AWS CloudFront, FortiWeb).</li>
          <li><strong>Cookies</strong>: list of detected cookies (domain, name, httpOnly flag) with a preview of values useful for session/SSO analysis.</li>
          <li><strong>Storage</strong>: dump of localStorage and sessionStorage (keys/values) to identify data exposed to JavaScript such as tokens or client-side configurations.</li>
          <li><strong>Raw</strong>: raw/detailed output (e.g., Wappalyzer resolved) containing metadata, categories, confidence, and information useful for further analysis.</li>
        </ul>
      </Collapsible>
      <Button
        onClick={startScan}
        className="scanButton"
        variant="contained"
        size="large"
        loading={scanning}
        loadingIndicator="Scan in progress..."
        disabled={disabledByLock || scanning}
      >
        {!results ? "start scan":"new scan"}
      </Button>
      {results && <ScanResults results={results} loadSource={loadSource} />}
    </div>
  )
}

export default ScanTechStack;
