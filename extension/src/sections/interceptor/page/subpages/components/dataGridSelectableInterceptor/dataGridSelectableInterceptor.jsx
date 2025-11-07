import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
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
  Divider
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import "./dataGridSelectableInterceptor.css";

/* ---------- Local utils ---------- */
function getHeader(headers = {}, name = "") {
  const n = String(name).toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === n) return v;
  }
  return undefined;
}

function toDisplay(val) {
  if (val == null || val === "") return "—";
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

const isPlainObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);

/** Compare two arrays of object references as sets (order-insensitive, by reference). */
function areSameRefSets(a = [], b = []) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) {
    if (!setA.has(x)) return false;
  }
  return true;
}

/* ---------- Local subviews ---------- */
function JsonBlock({ title, data, onCopy }) {
  const json = React.useMemo(() => {
    try {
      return JSON.stringify(data ?? null, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, overflow: "auto", maxHeight: 420 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={() => onCopy(json)} aria-label="Copy JSON">
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
      <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>{json}</pre>
    </Paper>
  );
}

function FieldRow({ label, value, onCopy }) {
  const text = toDisplay(value);
  return (
    <>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ py: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 120 }}>
          {label}
        </Typography>
        <Box sx={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</Box>
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

function NestedArrayGrid({ rows, onPreview }) {
  // Generate deterministic ids for nested rows
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
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {toDisplay(v)}
          </span>
        );
      }
    }));
  }, []);

  const baseCols = React.useMemo(() => deriveColumnsFromRows(rows), [rows, deriveColumnsFromRows]);

  const actionsCol = React.useMemo(
    () => ({
      field: "_actions",
      headerName: "",
      width: 56,
      align: "center",
      headerAlign: "center",
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
      )
    }),
    [onPreview]
  );

  const columns = React.useMemo(() => [actionsCol, ...baseCols], [baseCols, actionsCol]);
  const paginationModel = { page: 0, pageSize: 5 };

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={getId}
      disableRowSelectionOnClick
      pageSizeOptions={[5, 10, 25]}
      initialState={{ pagination: { paginationModel } }}
      onCellClick={(p, e) => {
        // Prevent accidental selection toggles from cell clicks
        e.defaultMuiPrevented = true;
      }}
    />
  );
}

/* ---------- Main component ---------- */
export default function DataGridSelectableInterceptor({
  items = [],             // original request/response objects
  setArray,               // callback: selected ORIGINAL objects
  initialPageSize = 5,
  pageSizeOptions = [5, 10, 25],
  className,
  sx
}) {
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  // Build flat rows from items (keep original on __original)
  const rows = React.useMemo(() => {
    return (Array.isArray(items) ? items : []).map((evt, idx) => {
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
        meta,
        __original: evt
      };
    });
  }, [items]);

  // Map: rowId -> original object
  const idToOriginal = React.useMemo(() => {
    const map = new Map();
    rows.forEach((r) => map.set(r.id, r.__original));
    return map;
  }, [rows]);

  const columns = React.useMemo(
    () => [
      { field: "method", headerName: "Method", width: 110 },
      {
        field: "url",
        headerName: "URL",
        flex: 1.8,
        renderCell: (p) => (
          <Tooltip title={p.value || ""}>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.value || "—"}
          </span>
        )
      },
      {
        field: "resContentType",
        headerName: "Content-Type",
        flex: 1.1,
        renderCell: (p) => (
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.value || "—"}
          </span>
        )
      },
      {
        field: "_actions",
        type: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        width: 56,
        align: "center",
        headerAlign: "center",
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
        )
      }
    ],
    []
  );

  const allRowIds = React.useMemo(() => rows.map(r => r.id), [rows]);

  // v7 selection model (controlled) — keep the same shape you already use
  const [rowSelectionModel, setRowSelectionModel] = React.useState({
    type: "include",
    ids: new Set()
  });

  /** Store the last selection we emitted to the parent to avoid feedback loops. */
  const lastEmittedRef = React.useRef([]);

  const getSelectedIdsFromModel = React.useCallback(
    (model) => {
      if (!model) return [];
      if (model.type === "include") return Array.from(model.ids ?? []);
      // exclude mode: all rows except the excluded ones
      const excluded = model.ids ?? new Set();
      return allRowIds.filter((id) => !excluded.has(id));
    },
    [allRowIds]
  );

  // Sync outward when selection model changes — guarded to prevent loops
  React.useEffect(() => {
    if (!rowSelectionModel) return;
    const selectedIds = getSelectedIdsFromModel(rowSelectionModel);
    const selected = selectedIds.map((id) => idToOriginal.get(id)).filter(Boolean);

    // Guard: only emit if the selection set (by ref) actually changed
    if (setArray && !areSameRefSets(selected, lastEmittedRef.current)) {
      lastEmittedRef.current = selected;
      setArray(selected);
    }
  }, [rowSelectionModel, getSelectedIdsFromModel, idToOriginal, setArray]);

  // Keep selected ORIGINAL items in sync on user interaction — also guarded
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

  // Order row snapshot for details
  const orderedEntries = React.useCallback((row) => {
    if (!row) return [];
    const keysFromCols = ["method", "url", "status", "statusText", "resContentType"];
    const setFromCols = new Set(keysFromCols);
    const first = keysFromCols.filter((k) => k in row).map((k) => [k, row[k]]);
    const rest = Object.entries(row).filter(([k]) => !setFromCols.has(k) && k !== "__original");
    return [...first, ...rest];
  }, []);

  const [preview, setPreview] = React.useState({ open: false, row: null, tab: 0 });
  const paginationModel = React.useMemo(() => ({ page: 0, pageSize: initialPageSize }), [initialPageSize]);

  return (
    <div className={`dataGridSelectableInterceptor ${className ?? ""}`} style={{ width: "100%", marginTop: 5 }}>
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
          // Prevent row selection toggling when clicking inside cells (icons, etc.)
          e.defaultMuiPrevented = true;
        }}
      />

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
              <Tabs value={preview.tab} onChange={(_, val) => setPreview((s) => ({ ...s, tab: val }))} sx={{ mb: 2 }}>
                <Tab label="Request" />
                <Tab label="Response" />
              </Tabs>

              {preview.tab === 0 && <JsonBlock title="Request (raw)" data={preview.row.request} onCopy={copy} />}
              {preview.tab === 1 && <JsonBlock title="Response (raw)" data={preview.row.response} onCopy={copy} />}

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                All fields (row snapshot)
              </Typography>

              {orderedEntries(preview.row).map(([key, val]) => {
                // Render nested arrays of objects with a sub-grid
                if (Array.isArray(val) && val.every(isPlainObject)) {
                  return (
                    <React.Fragment key={key}>
                      <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
                        {key}
                      </Typography>
                      <NestedArrayGrid
                        rows={val}
                        onPreview={(item) =>
                          setPreview((s) => ({ ...s, open: true, row: { ...s.row, __sub: item }, tab: s.tab }))
                        }
                      />
                      <Divider sx={{ mt: 1 }} />
                    </React.Fragment>
                  );
                }
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
