import * as React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Tooltip, Stack, Typography, Divider, Chip, Tabs, Tab, Paper
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import "./collapsibleDataGridInterceptor.css";
import Collapsible from '../../../../../../components/collapsible/collapsible';

function toDisplay(val) {
  if (val == null || val === '') return '—';
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

const isPlainObject = (v) =>
  v != null && typeof v === 'object' && !Array.isArray(v);

function deriveColumnsFromRows(rows, exclude = new Set()) {
  const keys = new Set();
  rows.forEach(r => Object.keys(r || {}).forEach(k => { if (!exclude.has(k)) keys.add(k); }));

  return Array.from(keys).map((k) => ({
    field: k,
    headerName: k,
    flex: 1,
    sortable: false,
    filterable: true,
    renderCell: (params) => {
      const v = params.row?.[k];
      if (Array.isArray(v)) {
        const label = k.toLowerCase() === 'inputs' ? `${v.length} inputs` : `${v.length} items`;
        return <Chip size="small" label={label} />;
      }
      return (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {toDisplay(v)}
        </span>
      );
    },
  }));
}

function NestedArrayGrid({ rows, onPreview }) {
  const [autoId] = React.useState(() =>
    rows.map((_, i) => `nested_${i}_${Math.random().toString(36).slice(2,8)}`)
  );

  const getId = React.useCallback((row) => {
    const idx = rows.indexOf(row);
    return autoId[idx] ?? `nested_${idx}`;
  }, [rows, autoId]);

  const baseCols = React.useMemo(() => deriveColumnsFromRows(rows), [rows]);

  const actionsCol = React.useMemo(() => ({
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
          onClick={(e) => { e.stopPropagation(); onPreview?.(params.row); }}
          aria-label="Show input details"
        >
          <VisibilityIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    ),
  }), [onPreview]);

  const columns = React.useMemo(() => [actionsCol, ...baseCols], [baseCols, actionsCol]);

  const paginationModel = { page: 0, pageSize: 5 };

  return (
    <div>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={getId}
        disableRowSelectionOnClick
        pageSizeOptions={[5, 10, 25]}
        rowSelection={false}
        initialState={{ pagination: { paginationModel } }}
        onCellClick={(p, e) => { e.defaultMuiPrevented = true; }}
      />
    </div>
  );
}

function FieldRow({ label, value, onCopy, onPreviewArrayItem }) {
  const isArrayOfObjects = Array.isArray(value) && value.every(isPlainObject);

  if (isArrayOfObjects) {
    return (
      <>
        <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>{label}</Typography>
        <NestedArrayGrid rows={value} onPreview={onPreviewArrayItem} />
        <Divider sx={{ mt: 1 }} />
      </>
    );
  }

  const text = toDisplay(value);

  return (
    <>
      <Stack direction="row" alignItems="flex-start" spacing={1} className="fieldRow">
        <Typography variant="body2" className="fieldRowLabel">
          {label}
        </Typography>
        <Box className="fieldRowValue">
          {text}
        </Box>
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

function JsonBlock({ title, data, onCopy }) {
  const json = React.useMemo(() => {
    try { return JSON.stringify(data ?? null, null, 2); } catch { return String(data); }
  }, [data]);
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, overflow: 'auto', maxHeight: 420 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={() => onCopy(json)} aria-label="Copy JSON">
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
      <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>
        {json}
      </pre>
    </Paper>
  );
}

export default function CollapsibleDataGridInterceptor({ expanded, onChange, rows, columns: userColumns, title, titleCount, defaultOpen }) {
  const [preview, setPreview] = React.useState({ open: false, row: null, tab: 0 });
  const [subPreview, setSubPreview] = React.useState({ open: false, item: null, title: '' });

  const copy = async (text) => { try { await navigator.clipboard.writeText(text); } catch {} };

  const paginationModel = { page: 0, pageSize: 5 };

  const defaultColProps = React.useMemo(() => ({
    flex: 1,
    minWidth: 120,
    sortable: false,
    filterable: true
  }), []);

  const actionsCol = React.useMemo(() => ({
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
          aria-label="Show row details"
        >
          <VisibilityIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    ),
  }), []);

  const withArrayFormatter = React.useCallback((col) => ({
    ...col,
    renderCell: (params) => {
      const v = params.row?.[col.field];
      if (Array.isArray(v)) {
        const label = col.field.toLowerCase() === 'inputs' ? `${v.length} inputs` : `${v.length} items`;
        return <Chip size="small" label={label} />;
      }
      if (col.renderCell) return col.renderCell(params);
      return <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{toDisplay(v)}</span>;
    }
  }), []);

  const gridColumns = React.useMemo(() => {
    const base = (userColumns ?? []).map(c => withArrayFormatter({ ...defaultColProps, ...c }));
    return [actionsCol, ...base];
  }, [userColumns, defaultColProps, actionsCol, withArrayFormatter]);

  const rowIdMapRef = React.useRef(new WeakMap());
  const counterRef = React.useRef(0);
  const getId = React.useCallback((row) => {
    if (row && row.id != null) return String(row.id);
    let existing = rowIdMapRef.current.get(row);
    if (existing) return existing;
    counterRef.current += 1;
    const newId = `auto_${counterRef.current}`;
    rowIdMapRef.current.set(row, newId);
    return newId;
  }, []);

  const orderedEntries = React.useCallback((row) => {
    if (!row) return [];
    const keysFromCols = (userColumns ?? []).map(c => c.field);
    const setFromCols = new Set(keysFromCols);
    const first = keysFromCols.filter(k => k in row).map(k => [k, row[k]]);
    const rest = Object.entries(row).filter(([k]) => !setFromCols.has(k));
    return [...first, ...rest];
  }, [userColumns]);

  return (
    <Collapsible defaultOpen={defaultOpen} expanded={expanded} onChange={onChange} title={`${title} ${titleCount ? ` (${titleCount})` : ""}`}>
      <div className="collapsibledatagrid">
        <DataGrid
          className="collapsibleDataGrid"
          rows={rows}
          columns={gridColumns}
          initialState={{ pagination: { paginationModel } }}
          getRowId={getId}
          rowSelection={false}
          disableRowSelectionOnClick
          onCellClick={(p, e) => { e.defaultMuiPrevented = true; }}
          pageSizeOptions={[5, 10, 25]}
        />
      </div>

      <Dialog
        open={preview.open}
        onClose={() => setPreview(s => ({ ...s, open: false }))}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Request / Response details</DialogTitle>
        <DialogContent dividers className="collapsibledatagrid">
          {preview.row && (
            <>
              <Tabs
                value={preview.tab}
                onChange={(_, val) => setPreview(s => ({ ...s, tab: val }))}
                sx={{ mb: 2 }}
              >
                <Tab label="Request" />
                <Tab label="Response" />
              </Tabs>

              {preview.tab === 0 && (
                <JsonBlock title="Request (raw)" data={preview.row.request} onCopy={copy} />
              )}
              {preview.tab === 1 && (
                <JsonBlock title="Response (raw)" data={preview.row.response} onCopy={copy} />
              )}

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                All fields (row snapshot)
              </Typography>
              {orderedEntries(preview.row).map(([key, val]) => (
                <FieldRow
                  key={key}
                  label={key}
                  value={val}
                  onCopy={copy}
                  onPreviewArrayItem={(item) => setSubPreview({ open: true, item, title: `${key} item` })}
                />
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPreview(s => ({ ...s, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={subPreview.open}
        onClose={() => setSubPreview(s => ({ ...s, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{subPreview.title || 'Item details'}</DialogTitle>
        <DialogContent dividers className="collapsibledatagrid">
          {isPlainObject(subPreview.item) && Object.entries(subPreview.item).map(([k, v]) => (
            <FieldRow key={k} label={k} value={v} onCopy={copy} />
          ))}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSubPreview(s => ({ ...s, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Collapsible>
  );
}
