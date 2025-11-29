import { useEffect, useState } from "react";
import "./httpRequests.css";
import { Backdrop, CircularProgress, Paper, Typography } from "@mui/material";
import { httpRequestsService } from "../../services";
import HttpRequestsDataGrid from "./components/httpRequestsDataGrid/httpRequestsDataGrid";

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

  const fetchRequests = async (offset, limit) => {
    try {
      setLoading(true);
      const res = await httpRequestsService.listHttpRequests({
        offset,
        limit,
      });
      setRows(res.items || []);
      setPage(res.page);
      setParams({ limit: res.page.limit, offset: res.page.offset });
    } catch (error) {
      console.log(error);
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

      <Paper className="description">
        Questa è una descrizione della sezione http requests che mostra le
        richieste http salvate in graphdb.
      </Paper>

      <div className="httpRequests-grid">
        {rows.length > 0 && (
          <HttpRequestsDataGrid
            rows={rows}
            page={page}
            loading={loading}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}

export default HttpRequests;
