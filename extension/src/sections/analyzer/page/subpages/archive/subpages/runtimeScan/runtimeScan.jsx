import { Backdrop, CircularProgress, Divider, IconButton, Paper, Tooltip, Typography, Zoom } from "@mui/material";
import "./runtimeScan.css";
import Collapsible from "../../../../../../../components/collapsible/collapsible";
import { useCallback, useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import analyzerReactController from "../../../../../analyzerController";
import RefreshIcon from '@mui/icons-material/Refresh';
import RuntimeScanResults from "../../../components/runtimeScanResults/runtimeScanResults";
import { formatWhen } from "../../../../../../../libs/formatting";

function RuntimeScanArchiveAnalyzer(){

  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await analyzerReactController.getAllRuntimeResults();
      setRuns(Array.isArray(list) ? list : []);
      enqueueSnackbar("Archive loaded from storage successfully!", { variant: "success" });
    }catch(e){
      enqueueSnackbar(e || "Error loading snaps from storage.", { variant: "error" });
    }finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const off = analyzerReactController.onMessage({
      onRuntimeScanComplete: () => load()
    });
    return () => off();
  }, [load]);

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
    <div className="artsanalyzer-div">
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Analyzer’s Runtime Scan Archive</strong> shows a chronological list of runtime
            sessions saved to <em>local storage</em> only.
            Each entry includes when the run started and stopped, the number of total scans, and the count of
            unique pages captured, with quick access to the stored head/body snapshots and DOM stats.
            Use this archive to review past navigation sessions, compare runs, or pick up an analysis without
            starting a new scan.
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
      <div className="title">
        <Typography variant="h6">
          Archive Data
        </Typography>
        <div className="aots-options">
          <Tooltip title={"Refresh"} >
            <IconButton variant="contained" size="small" onClick={load} >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider className="divider" />
      {runs.length > 0 ? 
        (
          runs.map((snap, index) => (
            <Collapsible defaultOpen={false} title={`Date: ${formatWhen(snap.run.startedAt)} | Pages Count: ${snap.run.pagesCount}`} key={index}>
              <RuntimeScanResults results={snap} titleDisabled />
            </Collapsible>
          ))
        )
        :
        (
          <Typography>
            No runtime snaps.
          </Typography>
        )
      }
    </div>
  )
}

export default RuntimeScanArchiveAnalyzer;