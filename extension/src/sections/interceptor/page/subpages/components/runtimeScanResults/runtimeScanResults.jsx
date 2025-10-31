import { Divider, Grid, Paper, Typography, Tooltip, IconButton } from "@mui/material";
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import "./runtimeScanResults.css";
import CollapsibleDataGridInterceptor from "../collapsibleDataGridInterceptor/collapsibleDataGridInterceptor";
import React from "react";

function prettyBytes(n = 0) {
  if (!Number.isFinite(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${n.toFixed((u === 0) ? 0 : 1)} ${units[u]}`;
}

function getHeader(headers = {}, name = "") {
  if (!headers) return undefined;
  const target = String(name).toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v;
  }
  return undefined;
}

function buildRows(scans = []) {
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
      status: response?.status ?? (response?.networkError ? "ERR" : 0),
      statusText: response?.statusText ?? (response?.networkError ? String(response?.networkError) : ""),
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

function RuntimeScanResults({ results, titleDisabled = false }) {
  const domains = React.useMemo(() => Object.keys(results.run.dataset || {}), [results]);
  const [sections, setSections] = React.useState({});
  const allOpen = React.useMemo(() => domains.length > 0 && domains.every(d => sections[d] === true), [domains, sections]);
  const allClosed = React.useMemo(() => domains.every(d => sections[d] === false || sections[d] === undefined), [domains, sections]);

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

  return (
    <Paper className="irt-scanresults">
      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Runtime Scan Results
          </Typography>
        )}
        <div className="sr-options">
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
            {new Date(results.run.startedAt).toLocaleString()}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {new Date(results.run.stoppedAt).toLocaleString()}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.totalEvents}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.pagesCount}
          </Grid>
          <Grid size={12} sx={{ marginTop: "5px" }}>
            <strong>Total bytes</strong>
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {prettyBytes(results.run.totalBytes)}
          </Grid>
        </Grid>
      </Paper>

      {Object.entries(results.run.dataset).map(([domainUrl, scans]) => {
        const rows = buildRows(scans || []);
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
