import { Divider, Grid, Paper, Typography, Tooltip, IconButton } from "@mui/material";
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import "./runtimeScanResults.css";
import CollapsibleDataGridInterceptor from "../collapsibleDataGridInterceptor/collapsibleDataGridInterceptor";
import React from "react";
import { getHeader, prettyBytes } from "../../../../../../libs/formatting";
import DownloadJsonButton from "../../../../../../components/downloadJsonButton/downloadJsonButton";
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteScanDialog from "../../../../../../components/deleteScanDialog/deleteScanDialog";

function buildRows(scans = []) {
  if (!Array.isArray(scans)) return [];
  return scans.map((evt, idx) => {
    const { meta = {}, request = {}, response = {} } = evt || {};
    const resCT = getHeader(response.headers, "content-type");
    return {
      id: `${meta?.ts || idx}_${idx}`,
      ts: meta?.ts ?? null,
      pageUrl: meta?.pageUrl ?? null,
      method: request?.method ?? "GET",
      url: request?.url ?? "",
      reqBodySize: Number(request?.bodySize || 0),
      reqEncoding: request?.bodyEncoding || "none",
      reqTruncated: !!request?.truncated,
      status: (response?.status ?? (response?.networkError ? "ERR" : 0)),
      statusText: (response?.statusText ?? (response?.networkError ? String(response?.networkError) : "")),
      resContentType: resCT || "",
      resBodySize: Number(response?.bodySize || 0),
      resEncoding: response?.bodyEncoding || "none",
      resTruncated: !!response?.truncated,
      servedFromCache: !!response?.servedFromCache,
      fromServiceWorker: !!response?.fromServiceWorker,
      request,
      response,
      meta
    };
  });
}

const columns = [
  { field: "method", headerName: "Method", width: 110 },
  {
    field: "url",
    headerName: "URL",
    flex: 1.8,
    renderCell: (p) => (
      <Tooltip title={p.value || ""}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.value || "—"}
        </span>
      </Tooltip>
    )
  },
  { field: "status", headerName: "Status", width: 110 },
  {
    field: "statusText",
    headerName: "Status Text",
    flex: 1.2,
    renderCell: (p) => (
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {p.value || "—"}
      </span>
    )
  },
  {
    field: "resContentType",
    headerName: "Content-Type",
    flex: 1.1,
    renderCell: (p) => (
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {p.value || "—"}
      </span>
    )
  }
];

function RuntimeScanResults({ results, titleDisabled = false, deleteScan, deleteDisable = true }) {
  // Uses defensive defaults for absent run or dataset.
  const run = React.useMemo(() => results?.run || {}, [results]);
  const dataset = React.useMemo(
    () => (run?.dataset && typeof run.dataset === "object") ? run.dataset : {},
    [run]
  );

  const domains = React.useMemo(() => Object.keys(dataset), [dataset]);
  const [sections, setSections] = React.useState({});
  const [openDeleteScan, setOpenDeleteScan] = React.useState(false);

  const allOpen = React.useMemo(
    () => domains.length > 0 && domains.every(d => sections[d] === true),
    [domains, sections]
  );
  const allClosed = React.useMemo(
    () => domains.every(d => sections[d] === false || sections[d] === undefined),
    [domains, sections]
  );

  React.useEffect(() => {
    setSections(prev => {
      const next = { ...prev };
      let changed = false;
      for (const d of domains) {
        if (!(d in next)) { next[d] = false; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [domains]);

  const toggleAll = () => {
    const nextVal = !(allOpen && !allClosed);
    setSections(Object.fromEntries(domains.map(d => [d, nextVal])));
  };

  const startedAt = run?.startedAt ? new Date(run.startedAt).toLocaleString() : "—";
  const stoppedAt = run?.stoppedAt ? new Date(run.stoppedAt).toLocaleString() : "—";
  const totalEvents = Number(run?.totalEvents || 0);
  const pagesCount = Number(run?.pagesCount || domains.length || 0);
  const totalBytes = Number(run?.totalBytes || 0);

  return (
    <Paper className="irt-scanresults">
      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Runtime Scan Results
          </Typography>
        )}
        <div className="sr-options">
          {!deleteDisable && (
            <Tooltip title={"Delete Scan"} >
              <IconButton variant="contained" size="small" onClick={() => setOpenDeleteScan(true)}>
                <DeleteIcon />
              </IconButton>
          </Tooltip>
          )}
          <DeleteScanDialog open={openDeleteScan} setOpen={setOpenDeleteScan} deleteFn={deleteScan} />
          {results && <DownloadJsonButton data={results.run} filename={`interceptorResults_${results.run.startedAt}`} />}
          <Tooltip title={allOpen ? "Collapse All" : "Expand All"}>
            <IconButton size="small" onClick={toggleAll}>
              {allOpen ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
      {!titleDisabled && (<Divider orientation="horizontal" />)}

      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}><strong>Started at</strong></Grid>
          <Grid size={3}><strong>Stopped at</strong></Grid>
          <Grid size={3}><strong>Total events</strong></Grid>
          <Grid size={3}><strong>Unique Pages</strong></Grid>

          <Grid size={3} className="grid-newline-items">
            {startedAt}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {stoppedAt}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {totalEvents}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {pagesCount}
          </Grid>

          <Grid size={12} sx={{ marginTop: "5px" }}>
            <strong>Total bytes</strong>
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {prettyBytes(totalBytes)}
          </Grid>
        </Grid>
      </Paper>

      {domains.length === 0 && (
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
          No entries in this run.
        </Typography>
      )}

      {Object.entries(dataset).map(([domainUrl, scans]) => {
        const rows = buildRows(scans);
        const expanded = sections[domainUrl] === true;
        return (
          <CollapsibleDataGridInterceptor
            key={domainUrl}
            title={domainUrl}
            titleCount={rows.length}
            rows={rows}
            columns={columns}
            expanded={expanded}
            onChange={(_, isExpanded) => setSections(s => ({ ...s, [domainUrl]: !!isExpanded }))}
          />
        );
      })}
    </Paper>
  );
}

export default RuntimeScanResults;
