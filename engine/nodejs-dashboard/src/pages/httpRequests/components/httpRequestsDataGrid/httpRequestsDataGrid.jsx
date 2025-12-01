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
import DrawerWrapper from "../../../../components/drawerWrapper/drawerWrapper";
import "./httpRequestsDataGrid.css";
import { httpRequestsService } from "../../../../services";
import { enqueueSnackbar } from "notistack";

function LabelValueRow({ label, value }) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      className="httprequestsdatagrid-labelrow"
    >
      <Typography
        variant="body2"
        className="httprequestsdatagrid-labelrow-label"
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        className="httprequestsdatagrid-labelrow-value"
      >
        {value ?? "—"}
      </Typography>
    </Stack>
  );
}

function HeadersList({ headers }) {
  if (!headers || !headers.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No headers
      </Typography>
    );
  }

  return (
    <Paper variant="outlined" className="httprequestsdatagrid-headers">
      {headers.map((h, idx) => (
        <Box key={idx} className="httprequestsdatagrid-header-row">
          <Typography
            variant="body2"
            className="httprequestsdatagrid-header-name"
          >
            {h.name}:
          </Typography>
          <Typography
            variant="body2"
            className="httprequestsdatagrid-header-value"
          >
            {h.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

function QueryParamsList({ params }) {
  if (!params || !params.length) return null;

  return (
    <Box className="httprequestsdatagrid-queryparams">
      <Typography
        variant="subtitle2"
        className="httprequestsdatagrid-queryparams-title"
      >
        Query params
      </Typography>
      <Paper
        variant="outlined"
        className="httprequestsdatagrid-queryparams-paper"
      >
        {params.map((p, idx) => (
          <Typography
            key={idx}
            variant="body2"
            className="httprequestsdatagrid-queryparam"
          >
            {p.name} = {p.value}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}

function statusChipColor(status) {
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "info";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "default";
}

function HttpRequestsDataGrid({ rows, page, loading, onPageChange }) {
  const [open, setOpen] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [request, setRequest] = useState(null);

  const copyToClipboard = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRequest = async (id) => {
    try {
      setRequest(null);
      setLoadingRequest(true);
      const res = await httpRequestsService.getHttpRequestById(id);
      setRequest(res);
    } catch (error) {
      enqueueSnackbar("Error during retrieving request.", { variant: "error" });
      setRequest(null);
      setOpen(false);
    } finally {
      setLoadingRequest(false);
    }
  };

  const columns = [
    {
      field: "method",
      headerName: "Method",
      width: 100,
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      valueGetter: (_, row) => row?.response?.status ?? "",
    },
    {
      field: "url",
      headerName: "URL",
      flex: 1,
      minWidth: 250,
      valueGetter: (_, row) => row?.uri?.full ?? "",
    },
    {
      field: "authority",
      headerName: "Authority",
      flex: 0.7,
      minWidth: 180,
      valueGetter: (_, row) =>
        row?.connection?.authority ?? row?.uri?.authority ?? "",
    },
    {
      field: "graph",
      headerName: "Graph",
      flex: 0.8,
      minWidth: 200,
      valueGetter: (_, row) => row?.graph ?? "",
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
              fetchRequest(params.row.id);
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

  const status = request?.response?.status;
  const reason = request?.response?.reason;
  const url = request?.uri?.full;
  const method = request?.method;

  return (
    <>
      <DataGrid
        className="httprequestsdatagrid"
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
        title={request ? `Request details - Id: ${request.id}`: "Request details"}
        loading={loadingRequest}
      >
        {request && (
          <Box className="httprequestsdatagrid-drawer">
            <Box className="httprequestsdatagrid-header">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="httprequestsdatagrid-header-chips"
              >
                {method && (
                  <Chip
                    label={method}
                    size="small"
                    color="primary"
                    className="httprequestsdatagrid-method-chip"
                  />
                )}

                {typeof status === "number" && (
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
                className="httprequestsdatagrid-header-urlrow"
              >
                <Typography
                  variant="body2"
                  className="httprequestsdatagrid-header-url"
                  title={url}
                >
                  {url}
                </Typography>
                <Tooltip title="Copy URL">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(url)}
                  >
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                className="httprequestsdatagrid-header-meta"
              >
                Graph: {request.graph || "—"} • Connection:{" "}
                {request.connection?.authority || "—"}
              </Typography>
            </Box>

            <Divider />

            <Box className="httprequestsdatagrid-section">
              <Typography
                variant="subtitle1"
                className="httprequestsdatagrid-section-title"
              >
                Request
              </Typography>

              <LabelValueRow label="Method" value={method} />
              <LabelValueRow label="Scheme" value={request.uri?.scheme} />
              <LabelValueRow label="Authority" value={request.uri?.authority} />
              <LabelValueRow label="Path" value={request.uri?.path} />
              <LabelValueRow
                label="Query string"
                value={request.uri?.queryRaw}
              />

              <QueryParamsList params={request.uri?.params} />

              <Box className="httprequestsdatagrid-requestheaders">
                <Typography variant="subtitle2">Request headers</Typography>
                <HeadersList headers={request.requestHeaders} />
              </Box>
            </Box>

            <Divider />

            <Box className="httprequestsdatagrid-section">
              <Typography
                variant="subtitle1"
                className="httprequestsdatagrid-section-title"
              >
                Response
              </Typography>

              <LabelValueRow
                label="Status"
                value={
                  typeof status === "number"
                    ? reason
                      ? `${status} ${reason}`
                      : String(status)
                    : "—"
                }
              />

              <Box className="httprequestsdatagrid-responseheaders">
                <Typography variant="subtitle2">Response headers</Typography>
                <HeadersList headers={request.response?.headers} />
              </Box>

              <Box className="httprequestsdatagrid-bodysection">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  className="httprequestsdatagrid-bodyheader"
                >
                  <Typography variant="subtitle2">Body</Typography>
                  <Tooltip title="Copy body">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!request.response?.bodyBase64}
                        onClick={() =>
                          copyToClipboard(request.response?.bodyBase64)
                        }
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                <Paper
                  variant="outlined"
                  className="httprequestsdatagrid-bodybox"
                >
                  <Typography
                    variant="body2"
                    className="httprequestsdatagrid-bodytext"
                  >
                    {request.response?.bodyBase64
                      ? request.response.bodyBase64
                      : "No body"}
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

export default HttpRequestsDataGrid;
