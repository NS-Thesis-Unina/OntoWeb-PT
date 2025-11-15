import { Backdrop, CircularProgress, Divider, IconButton, Paper, Tooltip, Typography, Zoom } from "@mui/material";
import "./oneTimeScan.css";
import analyzerReactController from "../../../../../analyzerController";
import Collapsible from "../../../../../../../components/collapsible/collapsible";
import { useCallback, useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import OneTimeScanResults from "../../../components/oneTimeScanResults/oneTimeScanResults";
import { formatWhen, getDomainAccurate } from "../../../../../../../libs/formatting";
import RefreshIcon from '@mui/icons-material/Refresh';
import browser from "webextension-polyfill";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteScanDialog from "../../../../../../../components/deleteScanDialog/deleteScanDialog";

function OneTimeScanArchiveAnalyzer() {

  const [loading, setLoading] = useState(true);
  const [currentTabSnap, setCurrentTabSnap] = useState(null);
  const [otherTabsSnaps, setOtherTabsSnaps] = useState([]);
  const [sessionSnap, setSessionSnap] = useState(null);
  const [localSnaps, setLocalSnaps] = useState([]);
  const [openDeleteAllScans, setOpenDeleteAllScans] = useState(false);

  function normalizeSnapshot(snap) {
    if (!snap) return null;
    if (snap.meta && snap.results) return snap;
    if (snap.results && snap.results.meta && snap.results.results) {
      return { meta: snap.results.meta, results: snap.results.results };
    }
    if (snap.results) return { meta: snap.meta || {}, results: snap.results };
    return null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tid = await analyzerReactController.getCurrentTabId();
      const byTab = await analyzerReactController.getSessionByTabMap();
      const openTabs = await browser.tabs.query({});
      const openIds = new Set(openTabs.map(t => t?.id).filter(id => id != null));

      const cur = (tid != null && openIds.has(tid) && byTab?.[tid]) ? normalizeSnapshot(byTab[tid]) : null;
      setCurrentTabSnap(cur);

      const others = Object.entries(byTab || {})
        .map(([k, v]) => [Number(k), v])
        .filter(([id]) => openIds.has(id) && String(id) !== String(tid))
        .map(([, v]) => normalizeSnapshot(v))
        .filter(Boolean)
        .sort((a, b) => (b?.meta?.timestamp || 0) - (a?.meta?.timestamp || 0));
      setOtherTabsSnaps(others);

      const sess = await analyzerReactController.getSessionLastResult();
      setSessionSnap(normalizeSnapshot(sess));

      const locals = await analyzerReactController.getLocalScanResults();
      const normalizedLocals = (Array.isArray(locals) ? locals : [])
        .map(s => {
          const norm = normalizeSnapshot(s.results || s);
          const ts = norm?.meta?.timestamp ?? (Number(String(s.key || "").replace("analyzerResults_", "")) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setLocalSnaps(normalizedLocals);
      enqueueSnackbar("Archive loaded from storage successfully!", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e || "Error loading snaps from storage.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const off = analyzerReactController.onMessage({
      onScanComplete: () => load(),
      onRuntimeScanUpdate: () => {},
      onScanError: () => {}
    });
    return () => off();
  }, [load]);

  const deleteScan = async(timestamp) => {
    try{
      await analyzerReactController.deleteOneTimeResultById(`analyzerResults_${timestamp}`);
      load();
      enqueueSnackbar("Scan deleted successfully from storage.", { variant: "success" });
    }catch(err){
      enqueueSnackbar("Error deleting scan from storage.", { variant: "error" });
    }
  }

  const deleteAllScans = async() => {
    try{
      await analyzerReactController.clearAllOneTimeResults();
      load();
      enqueueSnackbar("All scans deleted successfully from storage.", { variant: "success" });
    }catch(err){
      enqueueSnackbar("Error deleting all scans from storage.", { variant: "error" });
    }
  }

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
    <div className="otsarchiveanalyzer-div">
      <Paper className="description">
        <Zoom in>
          <div>
            <Typography variant="body2">
              The <strong>Analyzer’s One-Time Scan Archive</strong> collects previously saved snapshots and
              organizes them into four views so you can quickly find, reopen, or compare results:
            </Typography>

            <ul className="ul">
              <li><strong>Current Tab</strong> — scans captured for the tab where the extension is open now.</li>
              <li><strong>Other Tabs (this session)</strong> — scans from any other tabs in the current browser session.</li>
              <li><strong>Last Global Session Run</strong> — the most recent one-time scan recorded across the entire session.</li>
              <li><strong>Local Saved</strong> — scans persisted locally for long-term reference.</li>
            </ul>

            <Typography variant="body2">
              Each entry includes the page URL, title, and timestamp, plus the stored head/body snapshot and DOM stats.
              Use the archive to review past pages, compare versions, or pick up where you left off without rescanning.
            </Typography>
          </div>
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
      <div className="title">
        <Typography variant="h6">
          Archive Data
        </Typography>
        <div className="aots-options">
          <Tooltip title={"Delete All Scan"} >
            <IconButton variant="contained" size="small" onClick={() => setOpenDeleteAllScans(true)} >
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
          <DeleteScanDialog open={openDeleteAllScans} setOpen={setOpenDeleteAllScans} deleteFn={deleteAllScans} allScans={true} />
          <Tooltip title={"Refresh"} >
            <IconButton variant="contained" size="small" onClick={load} >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider className="divider" />
      <Collapsible title={"Current Tab"} defaultOpen={false}>
        {currentTabSnap ? 
          (
            <OneTimeScanResults results={currentTabSnap} titleDisabled deleteDisable={false} deleteScan={() => deleteScan(currentTabSnap?.meta?.timestamp)} />
          )
          :
          (
            <Typography>
              No current tab snap.
            </Typography>
          )
        }
      </Collapsible>
      <Collapsible title={`Other Tabs (${otherTabsSnaps.length})`} defaultOpen={false}>
        {otherTabsSnaps.length > 0 ?
          (
            otherTabsSnaps.map((snap, index) => (
              <Collapsible key={index} title={`Tab Id: ${snap.meta.tabId}`} defaultOpen={false}>
                <OneTimeScanResults results={snap} titleDisabled deleteDisable={false} deleteScan={() => deleteScan(snap?.meta?.timestamp)} />
              </Collapsible>
            ))
          )
          :
          (
            <Typography>
              No other tabs snaps.
            </Typography>
          )
        }
      </Collapsible>
      <Collapsible title={"Last Global Session Run"} defaultOpen={false}>
      {sessionSnap ?
        (
          <OneTimeScanResults results={sessionSnap} titleDisabled deleteDisable={false} deleteScan={() => deleteScan(sessionSnap?.meta?.timestamp)}/>
        )
        :
        (
          <Typography>
            No session snap.
          </Typography>
        )
      }
      </Collapsible>
      <Collapsible title={`Local Saved (${localSnaps.length})`} defaultOpen={false}>
      {localSnaps.length > 0 ?
        (
          localSnaps.map((snap, index) => (
            <Collapsible key={index} title={`Date: ${formatWhen(snap.ts)} | Domain: ${getDomainAccurate(snap.snap.meta.url)}`} defaultOpen={false}>
              <OneTimeScanResults results={snap.snap} titleDisabled deleteDisable={false} deleteScan={() => deleteScan(snap?.snap?.meta?.timestamp)}/>
            </Collapsible>
          ))
        )
        :
        (
          <Typography>
            No other tabs snaps.
          </Typography>
        )
      }
      </Collapsible>
    </div>
  )

}

export default OneTimeScanArchiveAnalyzer;
