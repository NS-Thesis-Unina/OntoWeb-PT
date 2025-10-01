import { Backdrop, Button, CircularProgress, Divider, IconButton, Paper, Tooltip, Typography, Zoom } from "@mui/material";
import "./archive.css";
import Collapsible from "../../../../../components/collapsible/collapsible";
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";
import { enqueueSnackbar } from "notistack";
import techStackReactController from "../../../techstackController";
import ScanResults from "../components/scanResults/scanResults";
import { formatWhen, getDomainAccurate } from "../../../../../libs/formatting";

function ArchiveTechStack(){

  const [loading, setLoading] = useState(true);
  const [currentTabSnap, setCurrentTabSnap] = useState(null);
  const [otherTabsSnaps, setOtherTabsSnaps] = useState([]);
  const [sessionSnap, setSessionSnap] = useState(null);
  const [localSnaps, setLocalSnaps] = useState([]);

  function normalizeSnapshot(snap) {
    if (!snap) return null;
    if (snap.meta && snap.results) return snap;
    if (snap.results && snap.results.meta && snap.results.results) {
      return { meta: snap.results.meta, results: snap.results.results };
    }
    if (snap.results) return { meta: snap.meta || {}, results: snap.results };
    if (snap.technologies || snap.waf || snap.storage || snap.cookies || snap.raw) {
      return { meta: snap.meta || null, results: snap };
    }
    return null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {

      // active tab
      const tid = await techStackReactController.getCurrentTabId();

      // techstack_lastByTab
      let byTab = {};
      try {
        const obj = await browser.storage.session.get("techstack_lastByTab");
        byTab = obj?.techstack_lastByTab ?? {};
      } catch (e) {
        byTab = {};
      }

      // all open tabs
      const openTabs = await browser.tabs.query({});
      const openIds = new Set(openTabs.map(t => t?.id).filter(id => id != null));

      // current tab
      const cur = (tid != null && openIds.has(tid) && byTab?.[tid]) ? normalizeSnapshot(byTab[tid]) : null;
      setCurrentTabSnap(cur);

      // other tabs
      const others = Object.entries(byTab || {})
        .map(([k, v]) => [Number(k), v])
        .filter(([id]) => openIds.has(id) && String(id) !== String(tid))
        .map(([, v]) => normalizeSnapshot(v))
        .filter(Boolean)
        .sort((a, b) => (b?.meta?.timestamp || 0) - (a?.meta?.timestamp || 0));
      setOtherTabsSnaps(others);

      // global session
      const sess = await techStackReactController.getSessionLastResult();
      setSessionSnap(normalizeSnapshot(sess));

      // local storage
      const locals = await techStackReactController.getLocalResults();
      const normalizedLocals = (Array.isArray(locals) ? locals : [])
        .map(s => {
          // local entries are expected like { key, results: { meta, results } }
          const norm = normalizeSnapshot(s.results || s);
          const ts = norm?.meta?.timestamp ?? (Number(String(s.key || "").replace("techstackResults_", "")) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .filter(x => x.snap) // drop invalid
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setLocalSnaps(normalizedLocals);
    } catch (e) {
      enqueueSnackbar(`Error: ${e}`)
    } finally {
      setTimeout(() => {setLoading(false);}, 500);
    }
  }, []);

  useEffect(() => {
    load();
    const off = techStackReactController.onMessage({
      onScanComplete: () => load()
    });
    return () => off();
  }, [load]);

  useEffect(() => {
    console.log("current", currentTabSnap);
    console.log("other", otherTabsSnaps);
    console.log("session", sessionSnap);
    console.log("local", localSnaps);
  },[currentTabSnap, otherTabsSnaps, sessionSnap, localSnaps]);

  if(loading){
    return(
      <div className="scanteckstack-div">
        <Backdrop open={true}>
          <CircularProgress color="inherit" />
        </Backdrop> 
      </div>
    )
  }

  return(
    <div className="archivetechstack-div">
      <Collapsible defaultOpen={false} title="Info Archive">
        <strong>Archive</strong> stores and makes accessible the results of TechStack scans, organizing them 
        by context (current tab, other open tabs, session, persistent local archive). 
        For each snapshot, it displays metadata (URL, timestamp, Tab ID), summary counters 
        (Technologies, WAF, SecureHeaders, Cookies, Local/Session Storage), and useful 
        previews for analysis, including security headers, detected cookies, storage, 
        and the “Raw resolved” dump.
        <ul className="ul">
          <li><strong>Current tab</strong>: the latest scan of the active tab.</li>
          <li><strong>Other tabs</strong>: recent scans from other open tabs.</li>
          <li><strong>Session</strong>: persistent history sorted by date, with full preview and exportable JSON.</li>
          <li><strong>Local archive</strong>: list of detected cookies (domain, name, httpOnly flag) with a preview of values useful for session/SSO analysis.</li>
        </ul>
      </Collapsible>
      <div className="title">
        <Typography variant="h6">
          Archive Data
        </Typography>
        <div className="ats-options">
          <Tooltip title={"Refresh"} >
            <IconButton variant="contained" size="small" onClick={load} >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider className="divider" />
      <Collapsible defaultOpen={false} title={"Current Tab"}>
        {currentTabSnap ? (
          <ScanResults results={currentTabSnap} titleDisabled />
        )
        :
        (
          <Typography variant="body2">Current tab scan empty.</Typography>
        )}
      </Collapsible>
      <Collapsible defaultOpen={false} title={`Other Tabs (${otherTabsSnaps.length})`}>
        {
          otherTabsSnaps.length > 0 ? (
            otherTabsSnaps.map((scan, index) => (
              <Collapsible key={index} defaultOpen={false} title={`${getDomainAccurate(scan.meta.url)} - ${formatWhen(scan.meta.timestamp)}`}>
                <ScanResults key={index} titleDisabled results={scan} />
              </Collapsible>
            ))
          )
          :
          (
            <Typography variant="body2">Other Tabs scan empty.</Typography>
          )
        }
      </Collapsible>
      <Collapsible defaultOpen={false} title={"Session (Global)"}>
        {currentTabSnap ? (
          <ScanResults results={sessionSnap} titleDisabled />
        )
        :
        (
          <Typography variant="body2">Session tab scan empty.</Typography>
        )}
      </Collapsible>
      <Collapsible defaultOpen={false} title={`Local (${localSnaps.length})`}>
        {
          localSnaps.length > 0 ? (
            localSnaps.map((scan, index) => (
              <Collapsible key={index} defaultOpen={false} title={`${getDomainAccurate(scan.snap.meta.url)} - ${formatWhen(scan.ts)}`}>
                <ScanResults key={index} titleDisabled results={scan.snap} />
              </Collapsible>
            ))
          )
          :
          (
            <Typography variant="body2">Other Tabs scan empty.</Typography>
          )
        }
      </Collapsible>
    </div>
  )
}

export default ArchiveTechStack;