import { Backdrop, CircularProgress, Divider, IconButton, Paper, Tooltip, Typography, Zoom, Button } from "@mui/material";
import "./archive.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import RefreshIcon from '@mui/icons-material/Refresh';
import interceptorReactController from "../../../interceptorController";
import Collapsible from "../../../../../components/collapsible/collapsible";
import RuntimeScanResults from "../components/runtimeScanResults/runtimeScanResults";
import browser from "webextension-polyfill";
import { formatWhen, prettyBytes } from "../../../../../libs/formatting";

const LAST_KEY_SENTINEL = "interceptorRun_lastKey";

function hasValidMeta(meta) {
  return meta && typeof meta === "object"
    && Number.isFinite(meta.startedAt)
    && Number.isFinite(meta.stoppedAt)
    && Number.isFinite(meta.totalEvents)
    && Number.isFinite(meta.pagesCount)
    && Number.isFinite(meta.totalBytes);
}

function ArchiveInterceptor(){

  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]); // [{ key, meta }]

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interceptorReactController.listRuns();
      const list = Array.isArray(res?.runs) ? res.runs : [];

      // Filters out sentinel and invalid metadata entries.
      const cleaned = list.filter(item =>
        item
        && typeof item.key === "string"
        && item.key !== LAST_KEY_SENTINEL
        && item.key.startsWith("interceptorRun_")
        && hasValidMeta(item.meta)
      );

      setRuns(cleaned);
      enqueueSnackbar("Archive loaded successfully.", { variant: "success" });
    } catch(e) {
      enqueueSnackbar(e?.message || "Error loading runs from storage.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const off = interceptorReactController.onMessage({
      onComplete: () => load()
    });
    return () => off();
  }, [load]);

  const hasRuns = useMemo(() => runs.length > 0, [runs]);

  if (loading) {
    return (
      <div className="rtsanalyzer-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    );
  }

  return (
    <div className="artsanalyzer-div">
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            The <strong>Interceptor’s Runtime Scan Archive</strong> lists saved sessions from <em>local storage</em>.
            Each entry shows start/stop time, total events, pages count, and total bytes. Expanding an item loads
            the complete dataset from storage and displays it like a runtime scan.
          </Typography>
        </Zoom>
      </Paper>

      <Collapsible defaultOpen={false} title="Info Output">
        <p>For each saved scan in local storage, the archive displays the same grouping and grid used in the Runtime Scan view.</p>

        <strong>Request</strong>
        <ul className="ul"> 
          <li><strong>url</strong>: absolute URL (extension/http/https/ws/wss).</li>
          <li><strong>method</strong>: HTTP verb or channel marker (e.g., <code>WS_SEND</code>).</li>
          <li><strong>headers</strong>: case-preserving object.</li>
          <li><strong>body</strong>: text for textual payloads, Base64 for binary/large bodies.</li>
          <li><strong>bodyEncoding</strong>: <code>text</code>, <code>base64</code>, or <code>none</code>.</li>
          <li><strong>bodySize</strong>: original size in bytes; <strong>truncated</strong> flag when capped.</li>
        </ul>

        <strong>Response</strong>
        <ul className="ul">
          <li><strong>status</strong> and <strong>statusText</strong> with channel labels when applicable.</li>
          <li><strong>headers</strong>: stored as an object.</li>
          <li><strong>body</strong>: text or Base64; includes encoding, size, and truncated flag.</li>
          <li><strong>servedFromCache</strong> and <strong>fromServiceWorker</strong> when detectable.</li>
        </ul>

        <strong>Meta</strong>
        <ul className="ul">
          <li><strong>pageUrl</strong>, <strong>tabId</strong> (when available), <strong>ts</strong> (ms).</li>
        </ul>

        <strong>Special channels</strong>
        <ul className="ul">
          <li><strong>sendBeacon</strong>, <strong>EventSource</strong>, and <strong>WebSocket</strong> markers are included.</li>
        </ul>

        <strong>Grouping & summary</strong>
        <ul className="ul">
          <li>Per-domain grouping identical to the live runtime view.</li>
          <li>Each saved scan header reports start/stop, total events, unique pages, and total bytes.</li>
        </ul>

        <strong>Grid columns</strong>
        <ul className="ul">
          <li><strong>Method</strong>, <strong>URL</strong>, <strong>Status</strong>, <strong>Status Text</strong>, <strong>Content-Type</strong>, with a details dialog for full inspection.</li>
        </ul>
      </Collapsible>

      <div className="title">
        <Typography variant="h6">Archive</Typography>
        <div className="aots-options">
          <Tooltip title={"Refresh"}>
            <IconButton variant="contained" size="small" onClick={load}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider className="divider" />

      {hasRuns ? (
        runs.map(({ key, meta }) => {
          const title = `Started: ${formatWhen(meta.startedAt)} | Stopped: ${formatWhen(meta.stoppedAt)} | Pages: ${meta.pagesCount} | Events: ${meta.totalEvents} | Bytes: ${prettyBytes(meta.totalBytes)}`;
          return (
            <Collapsible key={key} defaultOpen={false} title={title}>
              <RunResultsByKey keyId={key} />
            </Collapsible>
          );
        })
      ) : (
        <Typography>No runtime runs.</Typography>
      )}
    </div>
  );
}

// Loads a run directly from storage and renders it through the shared results component.
function RunResultsByKey({ keyId }) {
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);

  const loadFromStorage = useCallback(async () => {
    if (loading || run) return;
    setLoading(true);
    setError(null);
    try {
      const all = await browser.storage.local.get(keyId);
      const r = all?.[keyId] || null;
      if (!r) {
        setError("Run not found in storage.");
      } else {
        setRun(r);
      }
    } catch (e) {
      setError(e?.message || "Error reading run from storage.");
    } finally {
      setLoading(false);
    }
  }, [keyId, loading, run]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  if (loading) {
    return (
      <div style={{ padding: 8, display: "flex", alignItems: "center" }}>
        <CircularProgress size={24} /> <span style={{ marginLeft: 8 }}>Loading run…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 8 }}>
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>
        <Button size="small" variant="outlined" onClick={loadFromStorage}>Retry</Button>
      </div>
    );
  }

  if (!run) {
    return (
      <div style={{ padding: 8 }}>
        <Button size="small" variant="outlined" onClick={loadFromStorage}>Load run details</Button>
      </div>
    );
  }

  return <RuntimeScanResults results={{ key: keyId, run }} titleDisabled />;
}

export default ArchiveInterceptor;
