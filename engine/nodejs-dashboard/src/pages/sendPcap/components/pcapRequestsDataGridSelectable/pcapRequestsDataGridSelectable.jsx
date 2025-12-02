import { useState, useCallback, useMemo, useEffect } from "react";
import "./pcapRequestsDataGridSelectable.css";

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

function LabelValueRow({ label, value }) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      className="pcaprequestsdatagridselectable-labelrow"
    >
      <Typography
        variant="body2"
        className="pcaprequestsdatagridselectable-labelrow-label"
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        className="pcaprequestsdatagridselectable-labelrow-value"
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
    <Paper
      variant="outlined"
      className="pcaprequestsdatagridselectable-headers"
    >
      {headers.map((h, idx) => (
        <Box
          key={idx}
          className="pcaprequestsdatagridselectable-header-row"
        >
          <Typography
            variant="body2"
            className="pcaprequestsdatagridselectable-header-name"
          >
            {h.name}:
          </Typography>
          <Typography
            variant="body2"
            className="pcaprequestsdatagridselectable-header-value"
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
    <Box className="pcaprequestsdatagridselectable-queryparams">
      <Typography
        variant="subtitle2"
        className="pcaprequestsdatagridselectable-queryparams-title"
      >
        Query params
      </Typography>
      <Paper
        variant="outlined"
        className="pcaprequestsdatagridselectable-queryparams-paper"
      >
        {params.map((p, idx) => (
          <Typography
            key={idx}
            variant="body2"
            className="pcaprequestsdatagridselectable-queryparam"
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

function PcapRequestsDataGridSelectable({ rows, onSelectionChange }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(null);

  const [rowSelectionModel, setRowSelectionModel] = useState({
    type: "include",
    ids: new Set(),
  });

  const copyToClipboard = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const gridRows = useMemo(
    () =>
      (Array.isArray(rows) ? rows : []).map((item, index) => {
        const id =
          item.id != null
            ? item.id
            : item._id != null
            ? item._id
            : index;
        return {
          ...item,
          id,
        };
      }),
    [rows]
  );

  const idToOriginal = useMemo(() => {
    const map = new Map();
    gridRows.forEach((row) => {
      map.set(row.id, row);
    });
    return map;
  }, [gridRows]);

  const allRowIds = useMemo(
    () => gridRows.map((r) => r.id),
    [gridRows]
  );

  const getSelectedIdsFromModel = useCallback(
    (model) => {
      if (!model || !model.ids) return [];

      if (model.type === "include") {
        return Array.from(model.ids);
      }

      const excluded = model.ids;
      return allRowIds.filter((id) => !excluded.has(id));
    },
    [allRowIds]
  );

  useEffect(() => {
    if (!onSelectionChange) return;

    const ids = getSelectedIdsFromModel(rowSelectionModel);
    const selected = ids
      .map((id) => idToOriginal.get(id))
      .filter(Boolean);

    onSelectionChange(selected);
  }, [rowSelectionModel, getSelectedIdsFromModel, idToOriginal, onSelectionChange]);

  const handleSelectionChange = (model) => {
    setRowSelectionModel(model);

    if (!onSelectionChange) {
      return;
    }

    const ids = getSelectedIdsFromModel(model);
    const selected = ids
      .map((id) => idToOriginal.get(id))
      .filter(Boolean);

    onSelectionChange(selected);
  };

  const status = request?.response?.statusCode;
  const reason = request?.response?.reasonPhrase;
  const url = request?.uri?.full;
  const method = request?.method;

  return (
    <>
      <DataGrid
        className="pcaprequestsdatagridselectable-grid"
        rows={gridRows}
        columns={[
          {
            field: "method",
            headerName: "Method",
            width: 100,
          },
          {
            field: "status",
            headerName: "Status",
            width: 110,
            valueGetter: (_, row) => row?.response?.statusCode ?? "",
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
              row?.uri?.authority ?? row?.connection?.authority ?? "",
          },
          {
            field: "body",
            headerName: "Body",
            flex: 0.8,
            minWidth: 200,
            valueGetter: (_, row) =>
              row?.response?.body
                ? String(row.response.body).slice(0, 80)
                : "",
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
                    setRequest(params.row);
                    setOpen(true);
                  }}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          },
        ]}
        getRowId={(row) => row.id}
        checkboxSelection
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={handleSelectionChange}
        disableRowSelectionOnClick={false}
        pageSizeOptions={[25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { page: 0, pageSize: 25 } },
        }}
        onCellClick={(params, event) => {
          event.defaultMuiPrevented = true;
        }}
      />

      <DrawerWrapper
        open={open}
        setOpen={setOpen}
        title={
          request
            ? `Request details - Id: ${String(request.id)}`
            : "Request details"
        }
        loading={false}
      >
        {request && (
          <Box className="pcaprequestsdatagridselectable-drawer">
            <Box className="pcaprequestsdatagridselectable-header">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="pcaprequestsdatagridselectable-header-chips"
              >
                {method && (
                  <Chip
                    label={method}
                    size="small"
                    className="pcaprequestsdatagridselectable-method-chip"
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
                className="pcaprequestsdatagridselectable-header-urlrow"
              >
                <Typography
                  variant="body2"
                  className="pcaprequestsdatagridselectable-header-url"
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
                className="pcaprequestsdatagridselectable-header-meta"
              >
                Authority: {request.uri?.authority || "—"} • Connection:{" "}
                {request.connection?.authority || "—"}
              </Typography>
            </Box>

            <Divider />

            <Box className="pcaprequestsdatagridselectable-section">
              <Typography
                variant="subtitle1"
                className="pcaprequestsdatagridselectable-section-title"
              >
                Request
              </Typography>

              <LabelValueRow label="Method" value={method} />
              <LabelValueRow
                label="Scheme"
                value={request.uri?.scheme}
              />
              <LabelValueRow
                label="Authority"
                value={request.uri?.authority}
              />
              <LabelValueRow
                label="Path"
                value={request.uri?.path}
              />
              <LabelValueRow
                label="Query string"
                value={request.uri?.queryRaw}
              />

              <QueryParamsList params={request.uri?.params} />

              <Box className="pcaprequestsdatagridselectable-requestheaders">
                <Typography variant="subtitle2">
                  Request headers
                </Typography>
                <HeadersList headers={request.requestHeaders} />
              </Box>
            </Box>

            <Divider />

            <Box className="pcaprequestsdatagridselectable-section">
              <Typography
                variant="subtitle1"
                className="pcaprequestsdatagridselectable-section-title"
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

              <Box className="pcaprequestsdatagridselectable-responseheaders">
                <Typography variant="subtitle2">
                  Response headers
                </Typography>
                <HeadersList
                  headers={request.response?.responseHeaders}
                />
              </Box>

              <Box className="pcaprequestsdatagridselectable-bodysection">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  className="pcaprequestsdatagridselectable-bodyheader"
                >
                  <Typography variant="subtitle2">Body</Typography>
                  <Tooltip title="Copy body">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!request.response?.body}
                        onClick={() =>
                          copyToClipboard(request.response?.body)
                        }
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                <Paper
                  variant="outlined"
                  className="pcaprequestsdatagridselectable-bodybox"
                >
                  <Typography
                    variant="body2"
                    className="pcaprequestsdatagridselectable-bodytext"
                  >
                    {request.response?.body
                      ? request.response.body
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

export default PcapRequestsDataGridSelectable;
