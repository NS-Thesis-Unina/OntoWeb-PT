import './dataGridSelectableInterceptor.css';
import * as React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  Divider,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

/* ========================================================================
 *                               Utilities
 * ======================================================================== */

/** Case-insensitive header lookup (used for Content-Type resolution). */
function getHeader(headers = {}, name = '') {
  const n = String(name).toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === n) return v;
  }
  return undefined;
}

/** Format various JS types for textual display (stable across the UI). */
function toDisplay(val) {
  if (val == null || val === '') return '—';
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

/** Type guard for objects (used for nested array inspection). */
const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * Compare two arrays of references as sets (order-insensitive).
 * Used to prevent circular updates in selection.
 */
function areSameRefSets(a = [], b = []) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

/* ========================================================================
 *                          Subviews / Reusable Blocks
 * ======================================================================== */

/** JSON pretty block + copy button. */
function JsonBlock({ title, data, onCopy }) {
  const json = React.useMemo(() => {
    try {
      return JSON.stringify(data ?? null, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, overflow: 'auto', maxHeight: 420 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={() => onCopy(json)}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
      <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>{json}</pre>
    </Paper>
  );
}

/** Row used for simple key/value display in the inspector dialog. */
function FieldRow({ label, value, onCopy }) {
  const text = toDisplay(value);
  return (
    <>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ py: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 120 }}>
          {label}
        </Typography>
        <Box sx={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</Box>
        <Tooltip title="Copy">
          <IconButton size="small" onClick={() => onCopy(text)}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />
    </>
  );
}

/**
 * Nested DataGrid used when a row field contains an array of objects.
 * Example: request.inputs, response.headersEntries, etc.
 */
function NestedArrayGrid({ rows, onPreview }) {
  // Stable unique IDs for nested rows
  const [autoId] = React.useState(() =>
    rows.map((_, i) => `nested_${i}_${Math.random().toString(36).slice(2, 8)}`)
  );

  const getId = React.useCallback(
    (row) => autoId[rows.indexOf(row)] ?? `nested_${rows.indexOf(row)}`,
    [rows, autoId]
  );

  // Build dynamic columns from data keys
  const deriveColumnsFromRows = React.useCallback((rws) => {
    const keys = new Set();
    rws.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));
    return Array.from(keys).map((k) => ({
      field: k,
      headerName: k,
      flex: 1,
      sortable: false,
      filterable: true,
      renderCell: (params) => {
        const v = params.row?.[k];
        if (Array.isArray(v)) return <Chip size="small" label={`${v.length} items`} />;
        return (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {toDisplay(v)}
          </span>
        );
      },
    }));
  }, []);

  const baseCols = React.useMemo(() => deriveColumnsFromRows(rows), [rows, deriveColumnsFromRows]);

  // “Show details” button for nested rows
  const actionsCol = React.useMemo(
    () => ({
      field: '_actions',
      headerName: '',
      width: 56,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Tooltip title="Show input details">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onPreview?.(params.row);
            }}
          >
            <VisibilityIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      ),
    }),
    [onPreview]
  );

  const columns = React.useMemo(() => [actionsCol, ...baseCols], [baseCols, actionsCol]);

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={getId}
      disableRowSelectionOnClick
      initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
      pageSizeOptions={[5, 10, 25]}
      onCellClick={(p, e) => {
        e.defaultMuiPrevented = true;
      }}
    />
  );
}

/**
 * **DataGridSelectableInterceptor**
 *
 * Architectural Role:
 *   Interceptor → Interceptor UI → DataGridSelectableInterceptor (this component)
 *
 * Purpose:
 *   A fully interactive MUI DataGrid designed for selecting request/response
 *   events produced by the Interceptor runtime scan. It allows the user to:
 *
 *     • View all captured HTTP events in a sortable, paginated grid
 *     • Select multiple rows (using checkboxes)
 *     • Emit the selection upward (returning the ORIGINAL captured objects)
 *     • Inspect individual rows using a detailed modal dialog
 *     • Inspect nested arrays of objects (e.g., headers, inputs) with a
 *       secondary DataGrid for each array
 *     • View raw JSON (request/response) and copy any content
 *
 * Data Model:
 *   Each `item` prop represents a capture event (request/response/metadata).
 *   Internally, rows are normalized into a flat structure for display.
 *   The original object is preserved under `__original` for selection output.
 *
 * Responsibilities:
 *   - Transform raw interceptor events into DataGrid rows
 *   - Maintain and update a robust selection model (Set-based)
 *   - Detect and prevent selection update loops
 *   - Provide dialogs for deep inspection (JSON + nested objects)
 *   - Support clipboard copying of any row field or JSON block
 *
 * Notes:
 *   - This component performs NO network calls and stores NO data.
 *   - Selection is emitted ONLY when it actually changes (ref-equality guard).
 *   - Designed to reliably handle large datasets and complex nested structures.
 */
export default function DataGridSelectableInterceptor({
  items = [], // list of interceptor events
  setArray, // callback: array of original selected events
  initialPageSize = 5,
  pageSizeOptions = [5, 10, 25],
  className,
  sx,
}) {
  /* ------------------------------- Clipboard ----------------------------- */
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  /* ------------------------------- Row Build ----------------------------- */
  /** Normalize each interceptor event into a DataGrid row. */
  const rows = React.useMemo(
    () =>
      (Array.isArray(items) ? items : []).map((evt, idx) => {
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

          __original: evt, // Preserve original event (important!)
        };
      }),
    [items]
  );

  /** Map row IDs → original captured objects. */
  const idToOriginal = React.useMemo(() => {
    const map = new Map();
    rows.forEach((r) => map.set(r.id, r.__original));
    return map;
  }, [rows]);

  /* --------------------------- DataGrid Columns -------------------------- */
  const columns = React.useMemo(
    () => [
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

      // Open details dialog
      {
        field: '_actions',
        type: 'actions',
        headerName: '',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        width: 56,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Tooltip title="Show request/response details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setPreview({ open: true, row: params.row, tab: 0 });
              }}
            >
              <VisibilityIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    []
  );

  /* ---------------------------- Selection Model --------------------------- */

  const allRowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);

  /** v7-style selection model (Set-based with include/exclude modes). */
  const [rowSelectionModel, setRowSelectionModel] = React.useState({
    type: 'include',
    ids: new Set(),
  });

  /** Last emitted selection to avoid update loops. */
  const lastEmittedRef = React.useRef([]);

  /** Extract selected row IDs based on include/exclude mode. */
  const getSelectedIdsFromModel = React.useCallback(
    (model) => {
      if (model.type === 'include') return Array.from(model.ids ?? []);
      const excluded = model.ids ?? new Set();
      return allRowIds.filter((id) => !excluded.has(id));
    },
    [allRowIds]
  );

  /** Emit updates upward only when selection actually changes. */
  React.useEffect(() => {
    const selectedIds = getSelectedIdsFromModel(rowSelectionModel);
    const selected = selectedIds.map((id) => idToOriginal.get(id)).filter(Boolean);

    if (setArray && !areSameRefSets(selected, lastEmittedRef.current)) {
      lastEmittedRef.current = selected;
      setArray(selected);
    }
  }, [rowSelectionModel, getSelectedIdsFromModel, idToOriginal, setArray]);

  /** Handle user selection changes. */
  const handleSelection = React.useCallback(
    (model) => {
      setRowSelectionModel(model);

      const selectedIds = getSelectedIdsFromModel(model);
      const selected = selectedIds.map((id) => idToOriginal.get(id)).filter(Boolean);

      if (setArray && !areSameRefSets(selected, lastEmittedRef.current)) {
        lastEmittedRef.current = selected;
        setArray(selected);
      }
    },
    [getSelectedIdsFromModel, idToOriginal, setArray]
  );

  /* ---------------------- Field Ordering for Inspector --------------------- */
  const orderedEntries = React.useCallback((row) => {
    if (!row) return [];
    const preferred = ['method', 'url', 'status', 'statusText', 'resContentType'];
    const setPreferred = new Set(preferred);

    const first = preferred.filter((k) => k in row).map((k) => [k, row[k]]);
    const rest = Object.entries(row).filter(([k]) => !setPreferred.has(k) && k !== '__original');

    return [...first, ...rest];
  }, []);

  /* --------------------------- Preview Dialog ------------------------------ */

  const [preview, setPreview] = React.useState({
    open: false,
    row: null,
    tab: 0,
  });

  const paginationModel = React.useMemo(
    () => ({ page: 0, pageSize: initialPageSize }),
    [initialPageSize]
  );

  /* ========================================================================
   *                               RENDER
   * ======================================================================== */

  return (
    <div
      className={`dataGridSelectableInterceptor ${className ?? ''}`}
      style={{ width: '100%', marginTop: 5 }}
    >
      {/** ---------------------------------------------------------------
           DataGrid (Main Interactive List)
       --------------------------------------------------------------- */}
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        checkboxSelection
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={handleSelection}
        disableRowSelectionOnClick={false}
        pageSizeOptions={pageSizeOptions}
        initialState={{ pagination: { paginationModel } }}
        sx={sx}
        onCellClick={(p, e) => {
          // Prevent toggling selection when clicking inside fields or icons
          e.defaultMuiPrevented = true;
        }}
      />

      {/** ---------------------------------------------------------------
           Inspector Dialog (Request / Response)
       --------------------------------------------------------------- */}
      <Dialog
        open={preview.open}
        onClose={() => setPreview((s) => ({ ...s, open: false }))}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Request / Response details</DialogTitle>
        <DialogContent dividers>
          {preview.row && (
            <>
              {/* Tabs selecting between request + response */}
              <Tabs
                value={preview.tab}
                onChange={(_, val) => setPreview((s) => ({ ...s, tab: val }))}
                sx={{ mb: 2 }}
              >
                <Tab label="Request" />
                <Tab label="Response" />
              </Tabs>

              {/* JSON blocks */}
              {preview.tab === 0 && (
                <JsonBlock title="Request (raw)" data={preview.row.request} onCopy={copy} />
              )}

              {preview.tab === 1 && (
                <JsonBlock title="Response (raw)" data={preview.row.response} onCopy={copy} />
              )}

              {/* Snapshot of all row fields */}
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                All fields (row snapshot)
              </Typography>

              {orderedEntries(preview.row).map(([key, val]) => {
                // Nested array of objects -> render sub-grid
                if (Array.isArray(val) && val.every(isPlainObject)) {
                  return (
                    <React.Fragment key={key}>
                      <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
                        {key}
                      </Typography>

                      <NestedArrayGrid
                        rows={val}
                        onPreview={(item) =>
                          setPreview((s) => ({
                            ...s,
                            row: { ...s.row, __sub: item },
                            tab: s.tab,
                          }))
                        }
                      />

                      <Divider sx={{ mt: 1 }} />
                    </React.Fragment>
                  );
                }

                // Simple field
                return <FieldRow key={key} label={key} value={val} onCopy={copy} />;
              })}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button variant="contained" onClick={() => setPreview((s) => ({ ...s, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
