import { useEffect, useState } from "react";
import "./httpFindings.css";
import { Backdrop, CircularProgress, Paper, Typography, Zoom } from "@mui/material";
import { httpRequestsService } from "../../../services";
import HttpFindingsDataGrid from "./components/httpFindingsDataGrid/httpFindingsDataGrid";
import { enqueueSnackbar } from "notistack";

function HttpFindings() {
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

  const fetchFindings = async (offset, limit) => {
    try {
      setLoading(true);

      const res = await httpRequestsService.listHttpFindings({
        offset,
        limit
      });

      const items = Array.isArray(res.items)
        ? res.items.map((id) => ({ id }))
        : [];

      setRows(items);
      setPage(res.page);
      setParams({ limit: res.page.limit, offset: res.page.offset });
    } catch (error) {
      enqueueSnackbar("Error while loading HTTP findings.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings(params.offset, params.limit);
  }, []);

  const handlePageChange = (newOffset, newLimit) => {
    fetchFindings(newOffset, newLimit);
  };

  if (loading && rows.length === 0) {
    return (
      <Backdrop open={loading}>
        <CircularProgress />
      </Backdrop>
    );
  }

  return (
    <div className="httpFindings-div">
      <Typography className="title">HTTP Findings</Typography>

      <Zoom in={true}>
        <Paper className="description">
          This section lists the HTTP-related findings detected by the HTTP
          resolver and stored in GraphDB. Each finding represents a potential
          issue extracted from a specific HTTP request, such as CORS
          misconfigurations or weak transport settings. Open any row to inspect
          the full finding details and a summary of the related HTTP request.
        </Paper>
      </Zoom>

      <div className="httpFindings-grid">
        {rows.length > 0 ? (
          <HttpFindingsDataGrid
            rows={rows}
            page={page}
            loading={loading}
            onPageChange={handlePageChange}
          />
        ) : (
          <Typography variant="h1" textAlign="center">
            No findings to show.
          </Typography>
        )}
      </div>
    </div>
  );
}

export default HttpFindings;
