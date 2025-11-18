import './collapsibleDataGrid.css';
import * as React from 'react';
import Collapsible from '../collapsible';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

/**
 * Maps arbitrary JS values to readable strings for the grid.
 */
function toDisplay(val) {
  if (val == null || val === '') return '—';
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * Auto-derive columns from the dataset if no explicit columns are given.
 * Useful for generic result sets where each row may have arbitrary fields.
 */
function deriveColumnsFromRows(rows, exclude = new Set()) {
  const keys = new Set();
  rows.forEach((r) =>
    Object.keys(r || {}).forEach((k) => {
      if (!exclude.has(k)) keys.add(k);
    })
  );

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

/**
 * **NestedArrayGrid**
 *
 * Renders an array of objects inside a nested DataGrid,
 * typically used for "inputs", "matches", or "sub-elements".
 *
 * Includes a preview action to display individual object details.
 */
function NestedArrayGrid({ rows, onPreview }) {
  const [autoId] = React.useState(() =>
    rows.map((_, i) => `nested_${i}_${Math.random().toString(36).slice(2, 8)}`)
  );

  const getId = React.useCallback(
    (row) => {
      const idx = rows.indexOf(row);
      return autoId[idx] ?? `nested_${idx}`;
    },
    [rows, autoId]
  );

  const baseCols = React.useMemo(() => deriveColumnsFromRows(rows), [rows]);

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
            aria-label="Show input details"
          >
            <VisibilityIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      ),
    }),
    [onPreview]
  );

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
        onCellClick={(p, e) => {
          // Prevent DataGrid navigation from hijacking expand/collapse clicks
          e.defaultMuiPrevented = true;
        }}
      />
    </div>
  );
}

/**
 * **FieldRow**
 *
 * Renders a key-value row inside the Details dialog.
 * Supports:
 * - array of plain objects → rendered as nested DataGrid
 * - primitive or structured values → rendered as text with copy button
 */
function FieldRow({ label, value, onCopy, onPreviewArrayItem }) {
  const isArrayOfObjects = Array.isArray(value) && value.every(isPlainObject);

  if (isArrayOfObjects) {
    return (
      <>
        <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
          {label}
        </Typography>
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
        <Box className="fieldRowValue">{text}</Box>
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
 * **CollapsibleDataGrid**
 *
 * A highly flexible collapsible section that displays a MUI DataGrid
 * alongside an expandable dialog viewer for row details and nested values.
 *
 * Architectural Responsibilities:
 * - Renders a DataGrid inside a collapsible block.
 * - Automatically formats arrays, objects, and primitive values.
 * - Displays a modal dialog with structured row details.
 * - Supports nested arrays of objects rendered through a secondary DataGrid.
 * - Provides copy-to-clipboard utilities and preview dialogs.
 *
 * This component is widely used across Analyzer, TechStack, and Interceptor
 * sections to display:
 * - HTTP request metadata
 * - Scan results
 * - Extracted inputs / payloads
 * - Structured runtime data
 *
 * @param {Object} props
 * @param {boolean} props.expanded - Controlled expansion state.
 * @param {Array<Object>} props.rows - Data rows to display.
 * @param {Array<Object>} [props.columns] - Optional column definitions.
 * @param {string} props.title - Section title.
 * @param {number} [props.titleCount] - Count appended to title.
 * @param {boolean} [props.defaultOpen] - Start expanded by default.
 */
export default function CollapsibleDataGrid({
  expanded,
  rows,
  columns: userColumns,
  title,
  titleCount,
  defaultOpen,
}) {
  // State for main row preview dialog
  const [preview, setPreview] = React.useState({ open: false, row: null });

  // State for nested array item preview dialog
  const [subPreview, setSubPreview] = React.useState({
    open: false,
    item: null,
    title: '',
  });

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const paginationModel = { page: 0, pageSize: 5 };

  const defaultColProps = React.useMemo(
    () => ({
      flex: 1,
      minWidth: 140,
      sortable: false,
      filterable: true,
    }),
    []
  );

  // Actions column for main grid
  const actionsCol = React.useMemo(
    () => ({
      field: '_actions',
      headerName: '',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 56,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Tooltip title="Show row details">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setPreview({ open: true, row: params.row });
            }}
            aria-label="Show row details"
          >
            <VisibilityIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      ),
    }),
    []
  );

  /**
   * Add array-formatting behavior to every user column.
   */
  const withArrayFormatter = React.useCallback(
    (col) => ({
      ...col,
      renderCell: (params) => {
        const v = params.row?.[col.field];
        if (Array.isArray(v)) {
          const label =
            col.field.toLowerCase() === 'inputs' ? `${v.length} inputs` : `${v.length} items`;
          return <Chip size="small" label={label} />;
        }
        if (col.renderCell) return col.renderCell(params);
        return (
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toDisplay(v)}
          </span>
        );
      },
    }),
    []
  );

  /**
   * Build the final column set:
   * - user columns (if provided)
   * - array formatting wrapper
   * - actions column
   */
  const gridColumns = React.useMemo(() => {
    const base = (userColumns ?? []).map((c) => withArrayFormatter({ ...defaultColProps, ...c }));
    return [...base, actionsCol];
  }, [userColumns, defaultColProps, actionsCol, withArrayFormatter]);

  /**
   * Row ID logic:
   * - use explicit `row.id` when available
   * - otherwise assign stable auto-generated IDs using a WeakMap
   */
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

  /**
   * Orders key-value pairs in row preview:
   * - First: keys that appear in user-defined columns
   * - Then: all other object properties
   */
  const orderedEntries = React.useCallback(
    (row) => {
      if (!row) return [];

      const keysFromCols = (userColumns ?? []).map((c) => c.field);
      const setFromCols = new Set(keysFromCols);

      const first = keysFromCols.filter((k) => k in row).map((k) => [k, row[k]]);
      const rest = Object.entries(row).filter(([k]) => !setFromCols.has(k));

      return [...first, ...rest];
    },
    [userColumns]
  );

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      expanded={expanded}
      title={`${title} ${titleCount ? ` (${titleCount})` : ''}`}
    >
      {/* Main DataGrid */}
      <div className="collapsibledatagrid">
        <DataGrid
          className="collapsibleDataGrid"
          rows={rows}
          columns={gridColumns}
          initialState={{ pagination: { paginationModel } }}
          getRowId={getId}
          rowSelection={false}
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25]}
          onCellClick={(p, e) => {
            // Prevent navigation issues with nested click handlers
            e.defaultMuiPrevented = true;
          }}
        />
      </div>

      {/* Row detail dialog */}
      <Dialog
        open={preview.open}
        onClose={() => setPreview((s) => ({ ...s, open: false }))}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Details</DialogTitle>
        <DialogContent dividers className="collapsibledatagrid">
          {preview.row &&
            orderedEntries(preview.row).map(([key, val]) => (
              <FieldRow
                key={key}
                label={key}
                value={val}
                onCopy={copy}
                onPreviewArrayItem={(item) =>
                  setSubPreview({ open: true, item, title: `${key} item` })
                }
              />
            ))}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPreview((s) => ({ ...s, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nested item preview dialog */}
      <Dialog
        open={subPreview.open}
        onClose={() => setSubPreview((s) => ({ ...s, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{subPreview.title || 'Item details'}</DialogTitle>
        <DialogContent dividers className="collapsibledatagrid">
          {isPlainObject(subPreview.item) &&
            Object.entries(subPreview.item).map(([k, v]) => (
              <FieldRow key={k} label={k} value={v} onCopy={copy} />
            ))}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSubPreview((s) => ({ ...s, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Collapsible>
  );
}
