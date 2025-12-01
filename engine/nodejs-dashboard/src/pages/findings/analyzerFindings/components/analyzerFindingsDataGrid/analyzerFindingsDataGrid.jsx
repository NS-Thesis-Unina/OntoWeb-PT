import { useState, useCallback } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Chip,
  Divider,
  Paper,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import "./analyzerFindingsDataGrid.css";
import { enqueueSnackbar } from "notistack";
import { analyzerService } from "../../../../../services";
import DrawerWrapper from "../../../../../components/drawerWrapper/drawerWrapper";

function LabelValueRow({ label, value }) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      className="analyzerfindingsdatagrid-labelrow"
    >
      <Typography
        variant="body2"
        className="analyzerfindingsdatagrid-labelrow-label"
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        className="analyzerfindingsdatagrid-labelrow-value"
      >
        {value ?? "—"}
      </Typography>
    </Stack>
  );
}

function severityChipColor(severity) {
  const s = String(severity || "").toUpperCase();
  if (s === "LOW") return "info";
  if (s === "MEDIUM") return "warning";
  if (s === "HIGH") return "error";
  if (s === "CRITICAL") return "error";
  return "default";
}

function extractAnalyzerRule(id) {
  if (!id) return "";
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(":");
    if (parts.length >= 3) {
      return parts[2] || "";
    }
    return "";
  } catch {
    return "";
  }
}

function extractAnalyzerDocument(id) {
  if (!id) return "";
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(":");
    if (parts.length >= 4) {
      return parts[3] || "";
    }
    return "";
  } catch {
    return "";
  }
}

function AnalyzerFindingsDataGrid({ rows, page, loading, onPageChange }) {
  const [open, setOpen] = useState(false);
  const [loadingFinding, setLoadingFinding] = useState(true);
  const [finding, setFinding] = useState(null);

  const copyToClipboard = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchFinding = async (id) => {
    try {
      setFinding(null);
      setLoadingFinding(true);
      const res = await analyzerService.getAnalyzerFindingById(id);
      setFinding(res);
    } catch (error) {
      enqueueSnackbar("Error while retrieving finding details.", {
        variant: "error",
      });
      setFinding(null);
      setOpen(false);
    } finally {
      setLoadingFinding(false);
    }
  };

  const columns = [
    {
      field: "id",
      headerName: "Finding ID",
      flex: 1.4,
      minWidth: 260,
      renderCell: (params) => (
        <Tooltip title={params.row.id}>
          <span className="analyzerfindingsdatagrid-idcell">
            {params.row.id}
          </span>
        </Tooltip>
      ),
    },
    {
      field: "rule",
      headerName: "Rule",
      width: 180,
      valueGetter: (_, row) => extractAnalyzerRule(row.id),
    },
    {
      field: "document",
      headerName: "Document",
      flex: 1,
      minWidth: 220,
      valueGetter: (_, row) => extractAnalyzerDocument(row.id),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      width: 70,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Tooltip title="View details">
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
              fetchFinding(params.row.id);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const safePage = page || {
    limit: 100,
    offset: 0,
    total: 0,
  };

  const paginationModel = {
    page: safePage.limit > 0 ? Math.floor(safePage.offset / safePage.limit) : 0,
    pageSize: safePage.limit,
  };

  const handlePaginationModelChange = (model) => {
    const newOffset = model.page * model.pageSize;
    const newLimit = model.pageSize;

    if (newOffset !== safePage.offset || newLimit !== safePage.limit) {
      onPageChange(newOffset, newLimit);
    }
  };

  const severity = finding?.severity;
  const ruleId = finding?.ruleId;
  const description = finding?.description;
  const context = finding?.context;
  const contextSrc = context?.src;
  const htmlNodes = Array.isArray(finding?.html) ? finding.html : [];

  return (
    <>
      <DataGrid
        className="analyzerfindingsdatagrid"
        rows={rows}
        columns={columns}
        loading={loading}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={safePage.total}
        pageSizeOptions={[25, 50, 100]}
        disableColumnMenu
      />

      <DrawerWrapper
        open={open}
        setOpen={setOpen}
        title={
          finding
            ? `Finding details - Id: ${finding.id}`
            : "Finding details"
        }
        loading={loadingFinding}
      >
        {finding && (
          <Box className="analyzerfindingsdatagrid-drawer">
            <Box className="analyzerfindingsdatagrid-header">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="analyzerfindingsdatagrid-header-chips"
              >
                {ruleId && (
                  <Chip
                    label={ruleId}
                    size="small"
                    className="analyzerfindingsdatagrid-rule-chip"
                  />
                )}

                {severity && (
                  <Chip
                    label={severity}
                    size="small"
                    color={severityChipColor(severity)}
                  />
                )}
              </Stack>

              {description && (
                <Typography
                  variant="body2"
                  className="analyzerfindingsdatagrid-header-description"
                >
                  {description}
                </Typography>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                className="analyzerfindingsdatagrid-header-meta"
              >
                Category: {finding.findingCategory || "—"} • OWASP:{" "}
                {finding.owaspCategory || "—"} • Resolver:{" "}
                {finding.resolver || "—"}
              </Typography>
            </Box>

            <Divider />

            <Box className="analyzerfindingsdatagrid-section">
              <Typography
                variant="subtitle1"
                className="analyzerfindingsdatagrid-section-title"
              >
                Finding
              </Typography>

              <LabelValueRow label="Id" value={finding.id} />
              <LabelValueRow
                label="Rule"
                value={finding.ruleId || extractAnalyzerRule(finding.id)}
              />
              <LabelValueRow label="Severity" value={finding.severity} />
              <LabelValueRow
                label="Category"
                value={finding.findingCategory}
              />
              <LabelValueRow
                label="OWASP category"
                value={finding.owaspCategory}
              />
              <LabelValueRow label="Resolver" value={finding.resolver} />
              <LabelValueRow label="Description" value={finding.description} />
            </Box>

            <Divider />

            <Box className="analyzerfindingsdatagrid-section">
              <Typography
                variant="subtitle1"
                className="analyzerfindingsdatagrid-section-title"
              >
                Context
              </Typography>

              <LabelValueRow label="Type" value={context?.type} />
              <LabelValueRow label="Origin" value={context?.origin} />

              <Box className="analyzerfindingsdatagrid-contextsrc">
                <Typography
                  variant="body2"
                  className="analyzerfindingsdatagrid-contextsrc-text"
                  title={contextSrc}
                >
                  {contextSrc || "—"}
                </Typography>
                {contextSrc && (
                  <Tooltip title="Copy source URL">
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(contextSrc)}
                    >
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            <Divider />

            <Box className="analyzerfindingsdatagrid-section">
              <Typography
                variant="subtitle1"
                className="analyzerfindingsdatagrid-section-title"
              >
                HTML reference
              </Typography>

              {htmlNodes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No HTML reference available.
                </Typography>
              ) : (
                <Paper
                  variant="outlined"
                  className="analyzerfindingsdatagrid-htmlbox"
                >
                  {htmlNodes.map((node, idx) => (
                    <Box
                      key={idx}
                      className="analyzerfindingsdatagrid-htmlrow"
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="analyzerfindingsdatagrid-html-iri"
                      >
                        {node.iri}
                      </Typography>
                      <Typography
                        variant="body2"
                        className="analyzerfindingsdatagrid-html-source"
                      >
                        {node.source}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>
          </Box>
        )}
      </DrawerWrapper>
    </>
  );
}

export default AnalyzerFindingsDataGrid;
