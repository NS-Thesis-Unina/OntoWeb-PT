import './runtimeScanResults.css';
import { Divider, Grid, Paper, Typography, Tooltip, IconButton } from '@mui/material';

import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';

import CollapsibleDataGridInterceptor from '../collapsibleDataGridInterceptor/collapsibleDataGridInterceptor';
import React from 'react';

import { getHeader, prettyBytes } from '../../../../../../libs/formatting';
import DownloadJsonButton from '../../../../../../components/downloadJsonButton/downloadJsonButton';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteScanDialog from '../../../../../../components/deleteScanDialog/deleteScanDialog';

/* ==========================================================================
 *                      Utility: Build DataGrid rows
 * ==========================================================================
 */

/**
 * Converts a list of raw interceptor events into normalized rows
 * suitable for MUI DataGrid and CollapsibleDataGridInterceptor.
 */
function buildRows(scans = []) {
  if (!Array.isArray(scans)) return [];
  return scans.map((evt, idx) => {
    const { meta = {}, request = {}, response = {} } = evt || {};
    const resCT = getHeader(response.headers, 'content-type');

    return {
      id: `${meta?.ts || idx}_${idx}`,
      ts: meta?.ts ?? null,
      pageUrl: meta?.pageUrl ?? null,

      method: request?.method ?? 'GET',
      url: request?.url ?? '',
      reqBodySize: Number(request?.bodySize || 0),
      reqEncoding: request?.bodyEncoding || 'none',
      reqTruncated: !!request?.truncated,

      status: response?.status ?? (response?.networkError ? 'ERR' : 0),
      statusText:
        response?.statusText ?? (response?.networkError ? String(response?.networkError) : ''),

      resContentType: resCT || '',
      resBodySize: Number(response?.bodySize || 0),
      resEncoding: response?.bodyEncoding || 'none',
      resTruncated: !!response?.truncated,

      servedFromCache: !!response?.servedFromCache,
      fromServiceWorker: !!response?.fromServiceWorker,

      request,
      response,
      meta,
    };
  });
}

/* ==========================================================================
 *                          DataGrid Column Definition
 * ==========================================================================
 * This matches the structure used in DataGridSelectableInterceptor for
 * consistency and predictable UX across all Interceptor views.
 */

const columns = [
  { field: 'method', headerName: 'Method', width: 110 },

  {
    field: 'url',
    headerName: 'URL',
    flex: 1.8,
    renderCell: (p) => (
      <Tooltip title={p.value || ''}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.value || '—'}
        </span>
      </Tooltip>
    ),
  },

  { field: 'status', headerName: 'Status', width: 110 },

  {
    field: 'statusText',
    headerName: 'Status Text',
    flex: 1.2,
    renderCell: (p) => (
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {p.value || '—'}
      </span>
    ),
  },

  {
    field: 'resContentType',
    headerName: 'Content-Type',
    flex: 1.1,
    renderCell: (p) => (
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {p.value || '—'}
      </span>
    ),
  },
];

/**
 * **RuntimeScanResults**
 *
 * Architectural Role:
 *   Interceptor → Runtime Scan → Results View (this component)
 *
 * Purpose:
 *   Display, organize and make inspectable the data produced by the Interceptor
 *   during a Runtime Scan. Data is grouped by page-domain, and each domain
 *   contains a list of captured HTTP events (request + response + metadata).
 *
 * Main Responsibilities:
 *   - Render metadata about the entire scan (start/stop, total events, bytes...)
 *   - Expand/collapse per-domain sections
 *   - Generate DataGrid rows for each HTTP event
 *   - Provide request/response inspection through CollapsibleDataGridInterceptor
 *   - Allow JSON export of the entire scan
 *   - Allow deletion of the scan via DeleteScanDialog
 *
 * Dataset Format:
 *   results = {
 *     run: {
 *       startedAt,
 *       stoppedAt,
 *       totalEvents,
 *       totalBytes,
 *       pagesCount,
 *       dataset: {
 *         "<domain or page URL>": [ { request, response, meta }, ... ]
 *       }
 *     }
 *   }
 *
 * Notes:
 *   - This component does no network IO.
 *   - All heavy inspection (request/response dialog) is delegated to
 *     CollapsibleDataGridInterceptor for consistency with SendToOntology UI.
 *   - Designed defensively: handles corrupted or missing sections gracefully.
 */
function RuntimeScanResults({ results, titleDisabled = false, deleteScan, deleteDisable = true }) {
  /* --------------------------------------------------------------
   * Extract scan run info with defensive fallback
   * -------------------------------------------------------------- */
  const run = React.useMemo(() => results?.run || {}, [results]);

  const dataset = React.useMemo(() => {
    return run?.dataset && typeof run.dataset === 'object' ? run.dataset : {};
  }, [run]);

  const domains = React.useMemo(() => Object.keys(dataset), [dataset]);

  /* --------------------------------------------------------------
   * Section expand/collapse state for each domain
   * -------------------------------------------------------------- */
  const [sections, setSections] = React.useState({});
  const [openDeleteScan, setOpenDeleteScan] = React.useState(false);

  const allOpen = React.useMemo(
    () => domains.length > 0 && domains.every((d) => sections[d] === true),
    [domains, sections]
  );

  const allClosed = React.useMemo(
    () => domains.every((d) => sections[d] === false || sections[d] === undefined),
    [domains, sections]
  );

  /** Ensure domains always exist in the expand/collapse object */
  React.useEffect(() => {
    setSections((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const d of domains) {
        if (!(d in next)) {
          next[d] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [domains]);

  /** Toggle expand/collapse all sections */
  const toggleAll = () => {
    const nextVal = !(allOpen && !allClosed);
    setSections(Object.fromEntries(domains.map((d) => [d, nextVal])));
  };

  /* --------------------------------------------------------------
   * Runtime scan metadata
   * -------------------------------------------------------------- */
  const startedAt = run?.startedAt ? new Date(run.startedAt).toLocaleString() : '—';

  const stoppedAt = run?.stoppedAt ? new Date(run.stoppedAt).toLocaleString() : '—';

  const totalEvents = Number(run?.totalEvents || 0);
  const pagesCount = Number(run?.pagesCount || domains.length || 0);
  const totalBytes = Number(run?.totalBytes || 0);

  /* --------------------------------------------------------------
   *                            Render
   * -------------------------------------------------------------- */

  return (
    <Paper className="irt-scanresults">
      {/* ----------------------------------------------------------
           TITLE + ACTION BAR
         ---------------------------------------------------------- */}
      <div className="title">
        {!titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">Runtime Scan Results</Typography>
        )}

        <div className="sr-options">
          {/* Delete scan */}
          {!deleteDisable && (
            <Tooltip title="Delete Scan">
              <IconButton size="small" onClick={() => setOpenDeleteScan(true)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}

          <DeleteScanDialog
            open={openDeleteScan}
            setOpen={setOpenDeleteScan}
            deleteFn={deleteScan}
          />

          {/* JSON Download */}
          {results && (
            <DownloadJsonButton
              data={results.run}
              filename={`interceptorResults_${results.run.startedAt}`}
            />
          )}

          {/* Expand/collapse all */}
          <Tooltip title={allOpen ? 'Collapse All' : 'Expand All'}>
            <IconButton size="small" onClick={toggleAll}>
              {allOpen ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {!titleDisabled && <Divider orientation="horizontal" />}

      {/* ----------------------------------------------------------
           GLOBAL SCAN METADATA
         ---------------------------------------------------------- */}
      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}>
            <strong>Started at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Stopped at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Total events</strong>
          </Grid>
          <Grid size={3}>
            <strong>Unique Pages</strong>
          </Grid>

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

          <Grid size={12} sx={{ marginTop: '5px' }}>
            <strong>Total bytes</strong>
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {prettyBytes(totalBytes)}
          </Grid>
        </Grid>
      </Paper>

      {/* ----------------------------------------------------------
           NO DATA CASE
         ---------------------------------------------------------- */}
      {domains.length === 0 && (
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
          No entries in this run.
        </Typography>
      )}

      {/* ----------------------------------------------------------
           DOMAIN-BY-DOMAIN DATA LISTS
         ---------------------------------------------------------- */}
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
            onChange={(_, isExpanded) => setSections((s) => ({ ...s, [domainUrl]: !!isExpanded }))}
          />
        );
      })}
    </Paper>
  );
}

export default RuntimeScanResults;
