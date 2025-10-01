import * as React from 'react';
import Collapsible from "../collapsible";
import { DataGrid } from '@mui/x-data-grid';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Tooltip, Stack, Typography, Divider
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import "./collapsibleDataGrid.css";

/*
Props:
- columns: [{ field, headerName }, ...]
- rows:    [{ field: value, ... }, ...]
- title?:  string
*/

function toDisplay(val) {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

function FieldRow({ label, value, onCopy }) {
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

export default function CollapsibleDataGrid({ expanded, rows, columns: userColumns, title, titleCount, defaultOpen }) {
  const [preview, setPreview] = React.useState({ open: false, row: null });

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const paginationModel = { page: 0, pageSize: 5 };

  const defaultColProps = React.useMemo(() => ({
    flex: 1,
    minWidth: 140,
    sortable: false,
  }), []);

  const actionsCol = React.useMemo(() => ({
    field: '_actions',
    headerName: '',
    sortable: false,
    filterable: false,
    width: 56,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params) => (
      <Tooltip title="Show row details">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setPreview({ open: true, row: params.row }); }}
          aria-label="Show row details"
        >
          <VisibilityIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    ),
  }), []);

  const gridColumns = React.useMemo(() => {
    const base = (userColumns ?? []).map(c => ({ ...defaultColProps, ...c }));
    return [...base, actionsCol];
  }, [userColumns, defaultColProps, actionsCol]);

  const getId = React.useCallback(
    (row, index) => row.id ?? (userColumns?.[0]?.field ? row[userColumns[0].field] : undefined) ?? index,
    [userColumns]
  );

  const orderedEntries = React.useCallback((row) => {
    if (!row) return [];
    const keysFromCols = (userColumns ?? []).map(c => c.field);
    const setFromCols = new Set(keysFromCols);
    const first = keysFromCols
      .filter(k => k in row)
      .map(k => [k, row[k]]);
    const rest = Object.entries(row).filter(([k]) => !setFromCols.has(k));
    return [...first, ...rest];
  }, [userColumns]);

  return (
    <Collapsible defaultOpen={defaultOpen} expanded={expanded} title={`${title} ${titleCount ? ` (${titleCount})` : ""}`}>
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
          disableColumnMenu
          pageSizeOptions={[5, 10, 25]}
        />
      </div>

      <Dialog
        open={preview.open}
        onClose={() => setPreview(s => ({ ...s, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Details</DialogTitle>
        <DialogContent dividers className="collapsibledatagrid">
          {preview.row && orderedEntries(preview.row).map(([key, val]) => (
            <FieldRow key={key} label={key} value={val} onCopy={copy} />
          ))}
        </DialogContent>

        <DialogActions>
          <Button variant="contained" onClick={() => setPreview(s => ({ ...s, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Collapsible>
  );
}
