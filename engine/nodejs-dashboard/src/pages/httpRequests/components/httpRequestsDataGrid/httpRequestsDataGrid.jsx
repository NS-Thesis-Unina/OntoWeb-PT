import { Box, IconButton, Tooltip } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import "./httpRequestsDataGrid.css";

function HttpRequestsDataGrid({ rows, page, loading, onPageChange }) {
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
      valueGetter: (_, row) => (row?.response?.status ?? ""),
    },
    {
      field: "url",
      headerName: "URL",
      flex: 1,
      minWidth: 250,
      valueGetter: (_, row) => (row?.uri?.full ?? ""),
    },
    {
      field: "authority",
      headerName: "Authority",
      flex: 0.7,
      minWidth: 180,
      valueGetter: (_, row) =>
        row?.connection?.authority ??
        row?.uri?.authority ??
        "",
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
        <Tooltip title="Mostra dettagli">
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              // per ora non mostra nulla: qui metterai dialog/drawer
              // console.log("Dettagli richiesta:", params.row);
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

  return (
      <DataGrid
        className="httprequestsdatagrid"
        sx={{
          width:"100%",
          height: "100%"
        }}
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
  );
}

export default HttpRequestsDataGrid;
