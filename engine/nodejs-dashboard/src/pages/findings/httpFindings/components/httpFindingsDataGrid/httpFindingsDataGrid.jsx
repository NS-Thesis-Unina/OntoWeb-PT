import './httpFindingsDataGrid.css';
import { useState, useCallback } from 'react';
import { Box, IconButton, Tooltip, Stack, Typography, Chip, Divider } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { httpRequestsService } from '../../../../../services';
import { enqueueSnackbar } from 'notistack';
import DrawerWrapper from '../../../../../components/drawerWrapper/drawerWrapper';

/** Drawer utility row. */
function LabelValueRow({ label, value }) {
  return (
    <Stack direction="row" alignItems="flex-start" className="httpfindingsdatagrid-labelrow">
      <Typography variant="body2" className="httpfindingsdatagrid-labelrow-label">
        {label}
      </Typography>
      <Typography variant="body2" className="httpfindingsdatagrid-labelrow-value">
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

/** Severity -> chip color. */
function severityChipColor(severity) {
  const s = String(severity || '').toUpperCase();
  if (s === 'LOW') return 'info';
  if (s === 'MEDIUM') return 'warning';
  if (s === 'HIGH') return 'error';
  if (s === 'CRITICAL') return 'error';
  return 'default';
}

/** Extract the rule segment from an encoded HTTP finding ID. */
function extractHttpFindingRule(id) {
  if (!id) return '';
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(':');
    if (parts.length >= 4 && parts[2] === 'http') {
      return parts[3] || '';
    }
    return '';
  } catch {
    return '';
  }
}

/** Extract the target segment(s) from an encoded HTTP finding ID. */
function extractHttpFindingTarget(id) {
  if (!id) return '';
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(':');
    if (parts.length >= 5 && parts[2] === 'http') {
      return parts.slice(4).join(':');
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Component: HttpFindingsDataGrid
 *
 * Architectural Role:
 * - Paginated table of HTTP resolver findings with an on-demand details drawer.
 *
 * Responsibilities:
 * - Parse "rule" and "target" segments from the encoded finding ID for quick columns.
 * - Load full finding payload on action click and render its HTTP summary.
 * - Provide clipboard helpers and severity mapping.
 *
 * Assumptions:
 * - HTTP finding ID format: <ns>:<resolver>:http:<rule>:<target...>
 */
function HttpFindingsDataGrid({ rows, page, loading, onPageChange }) {
  const [open, setOpen] = useState(false);
  const [loadingFinding, setLoadingFinding] = useState(true);
  const [finding, setFinding] = useState(null);

  /** Clipboard helper. */
  const copyToClipboard = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  }, []);

  /** Fetch full finding details for the drawer. */
  const fetchFinding = async (id) => {
    try {
      setFinding(null);
      setLoadingFinding(true);
      const res = await httpRequestsService.getHttpFindingById(id);
      setFinding(res);
    } catch (error) {
      enqueueSnackbar('Error while retrieving finding details.', {
        variant: 'error',
      });
      setFinding(null);
      setOpen(false);
    } finally {
      setLoadingFinding(false);
    }
  };

  /** Grid columns with derived quick-glance fields. */
  const columns = [
    {
      field: 'id',
      headerName: 'Finding ID',
      flex: 1.2,
      minWidth: 260,
      renderCell: (params) => (
        <Tooltip title={params.row.id}>
          <span className="httpfindingsdatagrid-idcell">{params.row.id}</span>
        </Tooltip>
      ),
    },
    {
      field: 'rule',
      headerName: 'Rule',
      width: 180,
      valueGetter: (_, row) => extractHttpFindingRule(row.id),
    },
    {
      field: 'target',
      headerName: 'Target',
      flex: 1,
      minWidth: 220,
      valueGetter: (_, row) => extractHttpFindingTarget(row.id),
    },
    {
      field: 'actions',
      headerName: '',
      sortable: false,
      filterable: false,
      width: 70,
      align: 'center',
      headerAlign: 'center',
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

  // Controlled fallback page to keep DataGrid consistent.
  const safePage = page || {
    limit: 100,
    offset: 0,
    total: 0,
  };

  const paginationModel = {
    page: safePage.limit > 0 ? Math.floor(safePage.offset / safePage.limit) : 0,
    pageSize: safePage.limit,
  };

  /** Server-side pagination handler. */
  const handlePaginationModelChange = (model) => {
    const newOffset = model.page * model.pageSize;
    const newLimit = model.pageSize;

    if (newOffset !== safePage.offset || newLimit !== safePage.limit) {
      onPageChange(newOffset, newLimit);
    }
  };

  // Drawer header conveniences.
  const severity = finding?.severity;
  const ruleId = finding?.ruleId;
  const description = finding?.description;
  const httpSummary = finding?.http;
  const httpUrl = httpSummary?.url;

  return (
    <>
      <DataGrid
        className="httpfindingsdatagrid"
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
        title={finding ? `Finding details - Id: ${finding.id}` : 'Finding details'}
        loading={loadingFinding}
      >
        {finding && (
          <Box className="httpfindingsdatagrid-drawer">
            {/* Header: rule/severity chips + description + meta */}
            <Box className="httpfindingsdatagrid-header">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="httpfindingsdatagrid-header-chips"
              >
                {ruleId && (
                  <Chip label={ruleId} size="small" className="httpfindingsdatagrid-rule-chip" />
                )}

                {severity && (
                  <Chip label={severity} size="small" color={severityChipColor(severity)} />
                )}
              </Stack>

              {description && (
                <Typography variant="body2" className="httpfindingsdatagrid-header-description">
                  {description}
                </Typography>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                className="httpfindingsdatagrid-header-meta"
              >
                Category: {finding.findingCategory || '—'} • OWASP: {finding.owaspCategory || '—'} •
                Resolver: {finding.resolver || '—'}
              </Typography>
            </Box>

            <Divider />

            {/* Core attributes */}
            <Box className="httpfindingsdatagrid-section">
              <Typography variant="subtitle1" className="httpfindingsdatagrid-section-title">
                Finding
              </Typography>

              <LabelValueRow label="Id" value={finding.id} />
              <LabelValueRow
                label="Rule"
                value={finding.ruleId || extractHttpFindingRule(finding.id)}
              />
              <LabelValueRow label="Severity" value={finding.severity} />
              <LabelValueRow label="Category" value={finding.findingCategory} />
              <LabelValueRow label="OWASP category" value={finding.owaspCategory} />
              <LabelValueRow label="Resolver" value={finding.resolver} />
              <LabelValueRow label="Description" value={finding.description} />
              <LabelValueRow label="Remediation" value={finding.remediation} />
            </Box>

            <Divider />

            {/* HTTP summary block */}
            <Box className="httpfindingsdatagrid-section">
              <Typography variant="subtitle1" className="httpfindingsdatagrid-section-title">
                HTTP summary
              </Typography>

              <LabelValueRow label="Method" value={httpSummary?.method} />
              <LabelValueRow
                label="Status"
                value={
                  typeof httpSummary?.status === 'number'
                    ? String(httpSummary.status)
                    : httpSummary?.status
                }
              />

              <Box className="httpfindingsdatagrid-httpurl">
                <Typography
                  variant="body2"
                  className="httpfindingsdatagrid-httpurl-text"
                  title={httpUrl}
                >
                  {httpUrl || '—'}
                </Typography>
                {httpUrl && (
                  <Tooltip title="Copy URL">
                    <IconButton size="small" onClick={() => copyToClipboard(httpUrl)}>
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </DrawerWrapper>
    </>
  );
}

export default HttpFindingsDataGrid;
