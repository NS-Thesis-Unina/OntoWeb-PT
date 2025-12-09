import './techstackFindingsDataGrid.css';
import { useState, useCallback } from 'react';
import { Box, IconButton, Tooltip, Stack, Typography, Chip, Divider, Paper } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { enqueueSnackbar } from 'notistack';
import { techstackService } from '../../../../../services';
import DrawerWrapper from '../../../../../components/drawerWrapper/drawerWrapper';

/** Utility row for drawer sections. */
function LabelValueRow({ label, value }) {
  return (
    <Stack direction="row" alignItems="flex-start" className="techstackfindingsdatagrid-labelrow">
      <Typography variant="body2" className="techstackfindingsdatagrid-labelrow-label">
        {label}
      </Typography>
      <Typography variant="body2" className="techstackfindingsdatagrid-labelrow-value">
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

/** Severity -> chip color intent. */
function severityChipColor(severity) {
  const s = String(severity || '').toUpperCase();
  if (s === 'LOW') return 'info';
  if (s === 'MEDIUM') return 'warning';
  if (s === 'HIGH') return 'error';
  if (s === 'CRITICAL') return 'error';
  return 'default';
}

/** Extractors for fields encoded inside the finding ID. */
function extractTechstackType(id) {
  if (!id) return '';
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(':');
    if (parts.length >= 3) {
      return parts[2] || '';
    }
    return '';
  } catch {
    return '';
  }
}
function extractTechstackScope(id) {
  if (!id) return '';
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(':');
    if (parts.length >= 4) {
      return parts[3] || '';
    }
    return '';
  } catch {
    return '';
  }
}
function extractTechstackSubject(id) {
  if (!id) return '';
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(':');
    if (parts.length >= 5) {
      return parts[4] || '';
    }
    return '';
  } catch {
    return '';
  }
}
function extractTechstackRuleFromId(id) {
  if (!id) return '';
  try {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split(':');
    if (parts.length >= 6) {
      return parts[5] || '';
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Component: TechstackFindingsDataGrid
 *
 * Architectural Role:
 * - Paginated table of Techstack findings (IDs), with an on-demand details drawer.
 *
 * Responsibilities:
 * - Parse structured information from the encoded finding ID (type/scope/subject/rule).
 * - Load full finding payload on row action and render structured evidence blocks.
 * - Provide basic clipboard utilities and severity mapping.
 *
 * Assumptions:
 * - Finding ID format is a colon-separated string:
 *   <ns>:<resolver>:<type>:<scope>:<subject>:<rule>:...
 */
function TechstackFindingsDataGrid({ rows, page, loading, onPageChange }) {
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

  /** Load full finding payload and open drawer. */
  const fetchFinding = async (id) => {
    try {
      setFinding(null);
      setLoadingFinding(true);
      const res = await techstackService.getTechstackFindingById(id);
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

  /** Grid columns with derived fields from the encoded ID. */
  const columns = [
    {
      field: 'id',
      headerName: 'Finding ID',
      flex: 1.4,
      minWidth: 260,
      renderCell: (params) => (
        <Tooltip title={params.row.id}>
          <span className="techstackfindingsdatagrid-idcell">{params.row.id}</span>
        </Tooltip>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 140,
      valueGetter: (_, row) => extractTechstackType(row.id),
    },
    {
      field: 'scope',
      headerName: 'Scope',
      flex: 1,
      minWidth: 200,
      valueGetter: (_, row) => extractTechstackScope(row.id),
    },
    {
      field: 'subject',
      headerName: 'Subject',
      flex: 1,
      minWidth: 180,
      valueGetter: (_, row) => extractTechstackSubject(row.id),
    },
    {
      field: 'target',
      headerName: 'Target',
      flex: 1,
      minWidth: 220,
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

  // Controlled paging fallback.
  const safePage = page || {
    limit: 100,
    offset: 0,
    total: 0,
  };

  const paginationModel = {
    page: safePage.limit > 0 ? Math.floor(safePage.offset / safePage.limit) : 0,
    pageSize: safePage.limit,
  };

  /** Server-side pagination callback. */
  const handlePaginationModelChange = (model) => {
    const newOffset = model.page * model.pageSize;
    const newLimit = model.pageSize;

    if (newOffset !== safePage.offset || newLimit !== safePage.limit) {
      onPageChange(newOffset, newLimit);
    }
  };

  // Drawer header details.
  const severity = finding?.severity;
  const ruleId = finding?.ruleId;
  const description = finding?.description;
  const remediation = finding?.remediation;
  const evidenceType = finding?.evidenceType;

  // Evidence collections (optional).
  const cookies = Array.isArray(finding?.cookies) ? finding.cookies : [];
  const headers = Array.isArray(finding?.headers) ? finding.headers : [];
  const software = Array.isArray(finding?.software) ? finding.software : [];

  return (
    <>
      <DataGrid
        className="techstackfindingsdatagrid"
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
      />

      <DrawerWrapper
        open={open}
        setOpen={setOpen}
        title={finding ? `Finding details - Id: ${finding.id}` : 'Finding details'}
        loading={loadingFinding}
      >
        {finding && (
          <Box className="techstackfindingsdatagrid-drawer">
            {/* Header: rule/severity/evidence-type chips + description + meta */}
            <Box className="techstackfindingsdatagrid-header">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="techstackfindingsdatagrid-header-chips"
              >
                {(ruleId || extractTechstackRuleFromId(finding.id)) && (
                  <Chip
                    label={ruleId || extractTechstackRuleFromId(finding.id)}
                    size="small"
                    className="techstackfindingsdatagrid-rule-chip"
                  />
                )}

                {severity && (
                  <Chip label={severity} size="small" color={severityChipColor(severity)} />
                )}

                {evidenceType && <Chip label={evidenceType} size="small" variant="outlined" />}
              </Stack>

              {description && (
                <Typography
                  variant="body2"
                  className="techstackfindingsdatagrid-header-description"
                >
                  {description}
                </Typography>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                className="techstackfindingsdatagrid-header-meta"
              >
                Category: {finding.findingCategory || '—'} • Resolver: {finding.resolver || '—'}
              </Typography>
            </Box>

            <Divider />

            {/* Finding core attributes */}
            <Box className="techstackfindingsdatagrid-section">
              <Typography variant="subtitle1" className="techstackfindingsdatagrid-section-title">
                Finding
              </Typography>

              <LabelValueRow label="Id" value={finding.id} />
              <LabelValueRow
                label="Rule"
                value={finding.ruleId || extractTechstackRuleFromId(finding.id)}
              />
              <LabelValueRow label="Severity" value={finding.severity} />
              <LabelValueRow label="Target" value={finding.mainDomain} />   
              <LabelValueRow label="Category" value={finding.findingCategory} />
              <LabelValueRow label="Evidence type" value={finding.evidenceType} />
              <LabelValueRow label="Resolver" value={finding.resolver} />
              <LabelValueRow label="Description" value={finding.description} />
              <LabelValueRow label="Remediation" value={remediation} />
            </Box>

            <Divider />

            {/* Cookie evidence */}
            <Box className="techstackfindingsdatagrid-section">
              <Typography variant="subtitle1" className="techstackfindingsdatagrid-section-title">
                Cookie evidence
              </Typography>

              {cookies.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No cookie evidence available.
                </Typography>
              ) : (
                <Paper variant="outlined" className="techstackfindingsdatagrid-evidencebox">
                  {cookies.map((c, idx) => (
                    <Box key={idx} className="techstackfindingsdatagrid-evidencerow">
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="techstackfindingsdatagrid-evidence-iri"
                      >
                        {c.iri}
                      </Typography>
                      <Typography variant="body2">Name: {c.name || '—'}</Typography>
                      <Typography variant="body2">Domain: {c.domain || '—'}</Typography>
                      <Typography variant="body2">
                        Secure: {typeof c.secure === 'boolean' ? String(c.secure) : '—'}
                      </Typography>
                      <Typography variant="body2">
                        HttpOnly: {typeof c.httpOnly === 'boolean' ? String(c.httpOnly) : '—'}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            <Divider />

            {/* Header evidence */}
            <Box className="techstackfindingsdatagrid-section">
              <Typography variant="subtitle1" className="techstackfindingsdatagrid-section-title">
                Header evidence
              </Typography>

              {headers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No header evidence available.
                </Typography>
              ) : (
                <Paper variant="outlined" className="techstackfindingsdatagrid-evidencebox">
                  {headers.map((h, idx) => (
                    <Box key={idx} className="techstackfindingsdatagrid-evidencerow">
                      <Typography variant="body2">
                        {h.name}: {h.value}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            <Divider />

            {/* Software evidence */}
            <Box className="techstackfindingsdatagrid-section">
              <Typography variant="subtitle1" className="techstackfindingsdatagrid-section-title">
                Software evidence
              </Typography>

              {software.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No software evidence available.
                </Typography>
              ) : (
                <Paper variant="outlined" className="techstackfindingsdatagrid-evidencebox">
                  {software.map((s, idx) => (
                    <Box key={idx} className="techstackfindingsdatagrid-evidencerow">
                      <Typography variant="body2">Name: {s.name || '—'}</Typography>
                      <Typography variant="body2">Version: {s.version || '—'}</Typography>
                      <Typography variant="body2">Category: {s.category || '—'}</Typography>
                      <Typography variant="body2">Vendor: {s.vendor || '—'}</Typography>
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

export default TechstackFindingsDataGrid;
