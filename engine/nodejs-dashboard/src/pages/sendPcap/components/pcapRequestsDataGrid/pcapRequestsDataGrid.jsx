import './pcapRequestsDataGrid.css';
import { useState, useCallback } from 'react';
import { Box, IconButton, Tooltip, Stack, Typography, Chip, Divider, Paper } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DrawerWrapper from '../../../../components/drawerWrapper/drawerWrapper';

/** Generic label/value row used inside the drawer sections. */
function LabelValueRow({ label, value }) {
  return (
    <Stack direction="row" alignItems="flex-start" className="pcaprequestsdatagrid-labelrow">
      <Typography variant="body2" className="pcaprequestsdatagrid-labelrow-label">
        {label}
      </Typography>
      <Typography variant="body2" className="pcaprequestsdatagrid-labelrow-value">
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

/** Render headers as a simple name:value list. */
function HeadersList({ headers }) {
  if (!headers || !headers.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No headers
      </Typography>
    );
  }

  return (
    <Paper variant="outlined" className="pcaprequestsdatagrid-headers">
      {headers.map((h, idx) => (
        <Box key={idx} className="pcaprequestsdatagrid-header-row">
          <Typography variant="body2" className="pcaprequestsdatagrid-header-name">
            {h.name}:
          </Typography>
          <Typography variant="body2" className="pcaprequestsdatagrid-header-value">
            {h.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

/** Show query params if present. */
function QueryParamsList({ params }) {
  if (!params || !params.length) return null;

  return (
    <Box className="pcaprequestsdatagrid-queryparams">
      <Typography variant="subtitle2" className="pcaprequestsdatagrid-queryparams-title">
        Query params
      </Typography>
      <Paper variant="outlined" className="pcaprequestsdatagrid-queryparams-paper">
        {params.map((p, idx) => (
          <Typography key={idx} variant="body2" className="pcaprequestsdatagrid-queryparam">
            {p.name} = {p.value}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}

/** Map numeric HTTP status ranges to MUI chip intents. */
function statusChipColor(status) {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'default';
}

/**
 * Component: PcapRequestsDataGrid
 *
 * Architectural Role:
 * - Read-only preview grid for extracted HTTP requests.
 * - Opens a drawer with a structured request/response view and copy helpers.
 *
 * Responsibilities:
 * - Normalize incoming rows to guarantee a stable `id`.
 * - Provide quick-glance columns (method/status/url/authority/body snippet).
 * - Render a details panel showing request URI parts, headers, and response body.
 *
 * UX Notes:
 * - Body is shown raw; for large payloads only a preview appears in the grid,
 *   full content is visible in the drawer with a “Copy body” control.
 */
function PcapRequestsDataGrid({ rows }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(null);

  /** Clipboard helper for URL/body copy actions. */
  const copyToClipboard = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  }, []);

  /**
   * Ensure each row has a stable `id` for the DataGrid.
   * - Falls back to `_id` or the array index if needed.
   */
  const gridRows = (Array.isArray(rows) ? rows : []).map((item, index) => {
    const id = item.id != null ? item.id : item._id != null ? item._id : index;
    return {
      ...item,
      id,
    };
  });

  /** Column model: keep it compact and informative. */
  const columns = [
    {
      field: 'method',
      headerName: 'Method',
      width: 100,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      valueGetter: (_, row) => row?.response?.statusCode ?? '',
    },
    {
      field: 'url',
      headerName: 'URL',
      flex: 1,
      minWidth: 250,
      valueGetter: (_, row) => row?.uri?.full ?? '',
    },
    {
      field: 'authority',
      headerName: 'Authority',
      flex: 0.7,
      minWidth: 180,
      valueGetter: (_, row) => row?.uri?.authority ?? row?.connection?.authority ?? '',
    },
    {
      field: 'body',
      headerName: 'Body',
      flex: 0.8,
      minWidth: 200,
      valueGetter: (_, row) => (row?.response?.body ? String(row.response.body).slice(0, 80) : ''),
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
              setRequest(params.row);
              setOpen(true);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  // Drawer header conveniences.
  const status = request?.response?.statusCode;
  const reason = request?.response?.reasonPhrase;
  const url = request?.uri?.full;
  const method = request?.method;

  return (
    <>
      <DataGrid
        className="pcaprequestsdatagrid-grid"
        rows={gridRows}
        columns={columns}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        pageSizeOptions={[25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { page: 0, pageSize: 25 } },
        }}
      />

      <DrawerWrapper
        open={open}
        setOpen={setOpen}
        title={request ? `Request details - Id: ${String(request.id)}` : 'Request details'}
        loading={false}
      >
        {request && (
          <Box className="pcaprequestsdatagrid-drawer">
            {/* Drawer header: method/status chips + URL with copy */}
            <Box className="pcaprequestsdatagrid-header">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="pcaprequestsdatagrid-header-chips"
              >
                {method && (
                  <Chip label={method} size="small" className="pcaprequestsdatagrid-method-chip" />
                )}

                {typeof status === 'number' && (
                  <Chip
                    label={reason ? `${status} ${reason}` : status}
                    size="small"
                    color={statusChipColor(status)}
                  />
                )}
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="pcaprequestsdatagrid-header-urlrow"
              >
                <Typography variant="body2" className="pcaprequestsdatagrid-header-url" title={url}>
                  {url}
                </Typography>
                <Tooltip title="Copy URL">
                  <IconButton size="small" onClick={() => copyToClipboard(url)}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                className="pcaprequestsdatagrid-header-meta"
              >
                Authority: {request.uri?.authority || '—'} • Connection:{' '}
                {request.connection?.authority || '—'}
              </Typography>
            </Box>

            <Divider />

            {/* Request block */}
            <Box className="pcaprequestsdatagrid-section">
              <Typography variant="subtitle1" className="pcaprequestsdatagrid-section-title">
                Request
              </Typography>

              <LabelValueRow label="Method" value={method} />
              <LabelValueRow label="Scheme" value={request.uri?.scheme} />
              <LabelValueRow label="Authority" value={request.uri?.authority} />
              <LabelValueRow label="Path" value={request.uri?.path} />
              <LabelValueRow label="Query string" value={request.uri?.queryRaw} />

              <QueryParamsList params={request.uri?.params} />

              <Box className="pcaprequestsdatagrid-requestheaders">
                <Typography variant="subtitle2">Request headers</Typography>
                <HeadersList headers={request.requestHeaders} />
              </Box>
            </Box>

            <Divider />

            {/* Response block */}
            <Box className="pcaprequestsdatagrid-section">
              <Typography variant="subtitle1" className="pcaprequestsdatagrid-section-title">
                Response
              </Typography>

              <LabelValueRow
                label="Status"
                value={
                  typeof status === 'number'
                    ? reason
                      ? `${status} ${reason}`
                      : String(status)
                    : '—'
                }
              />

              <Box className="pcaprequestsdatagrid-responseheaders">
                <Typography variant="subtitle2">Response headers</Typography>
                <HeadersList headers={request.response?.responseHeaders} />
              </Box>

              <Box className="pcaprequestsdatagrid-bodysection">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  className="pcaprequestsdatagrid-bodyheader"
                >
                  <Typography variant="subtitle2">Body</Typography>
                  <Tooltip title="Copy body">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!request.response?.body}
                        onClick={() => copyToClipboard(request.response?.body)}
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                <Paper variant="outlined" className="pcaprequestsdatagrid-bodybox">
                  <Typography variant="body2" className="pcaprequestsdatagrid-bodytext">
                    {request.response?.body ? request.response.body : 'No body'}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Box>
        )}
      </DrawerWrapper>
    </>
  );
}

export default PcapRequestsDataGrid;
