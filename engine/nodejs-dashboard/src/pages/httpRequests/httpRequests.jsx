import { useEffect, useState } from "react";
import "./httpRequests.css";
import { Backdrop, CircularProgress, Paper, Typography, Zoom } from "@mui/material";
import { httpRequestsService } from "../../services";
import HttpRequestsDataGrid from "./components/httpRequestsDataGrid/httpRequestsDataGrid";
import HttpRequestsFilters from "./components/httpRequestsFilters/httpRequestsFilters";
import { enqueueSnackbar } from "notistack";

const initialFilters = {
  method: "",
  scheme: "",
  authority: "",
  path: "",
  headerName: "",
  headerValue: "",
  text: "",
};

function HttpRequests() {
  const [loading, setLoading] = useState(false);

  const [params, setParams] = useState({ limit: 100, offset: 0 });

  const [page, setPage] = useState({
    limit: 100,
    offset: 0,
    total: 0,
    hasNext: false,
    hasPrev: false,
    nextOffset: 0,
    prevOffset: 0,
  });

  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  var applyFilter = false; 

  const buildRequestParams = (offset, limit, filters = {}) => {
    const params = { offset, limit };

    Object.entries(filters).forEach(([key, value]) => {
      if (value == null) return;

      const trimmed = String(value).trim();
      if (trimmed !== "") {
        params[key] = trimmed;
      }
    });

    return params;
  };

  const fetchRequests = async (offset, limit, overrideFilters) => {
    try {
      setLoading(true);

      const finalFilters = {
        ...filters,
        ...(overrideFilters || {}),
      };

      const requestParams = buildRequestParams(offset, limit, finalFilters);

      const res = await httpRequestsService.listHttpRequests(requestParams);

      setRows(res.items || []);
      setPage(res.page);
      setParams({ limit: res.page.limit, offset: res.page.offset });
      setFilters(finalFilters);
      if(applyFilter){
        enqueueSnackbar("I filtri sono stati applicati correttamente.", { variant: "success" });
        applyFilter = false;
      }
    } catch (error) {
      enqueueSnackbar("Error while executing the request.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(params.offset, params.limit);
  }, []);

  const handlePageChange = (newOffset, newLimit) => {
    fetchRequests(newOffset, newLimit);
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleFiltersApply = () => {
    applyFilter = true;
    fetchRequests(0, params.limit);
  };

  const handleFiltersReset = () => {
    setFilters(initialFilters);
    fetchRequests(0, params.limit, initialFilters);
  };

  if (loading && rows.length === 0) {
    return (
      <Backdrop open={loading}>
        <CircularProgress />
      </Backdrop>
    );
  }

  return (
    <div className="httpRequests-div">
      <Typography className="title">Http Requests</Typography>

      <Zoom in={true}>
        <Paper className="description">
          This section displays the HTTP requests stored in GraphDB. 
          Use the filters above to narrow down the traffic by method, URL, headers, or free-text search, 
          and open any row to inspect the full request and response details.
        </Paper>
      </Zoom>
      
      <HttpRequestsFilters
        filters={filters}
        onChange={handleFiltersChange}
        onApply={handleFiltersApply}
        onReset={handleFiltersReset}
      />

      <div className="httpRequests-grid">
        {rows.length > 0 ? (
          <HttpRequestsDataGrid
            rows={rows}
            page={page}
            loading={loading}
            onPageChange={handlePageChange}
          />
        ): (<Typography variant="h1" textAlign={"center"}>No requests to show.</Typography>)}
      </div>
    </div>
  );
}

export default HttpRequests;
