import { useEffect, useState } from "react";
import "./techstackFindings.css";
import { Backdrop, CircularProgress, Paper, Typography, Zoom } from "@mui/material";
import TechstackFindingsDataGrid from "./components/techstackFindingsDataGrid/techstackFindingsDataGrid";
import { enqueueSnackbar } from "notistack";
import { techstackService } from "../../../services";

function TechstackFindings() {
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

      const res = await techstackService.listTechstackFindings({
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
      enqueueSnackbar("Error while loading techstack findings.", {
        variant: "error",
      });
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
    <div className="techstackFindings-div">
      <Typography className="title">Techstack Findings</Typography>

      <Zoom in={true}>
        <Paper className="description">
          This section lists findings produced by the tech stack resolver. Each
          entry represents evidence collected from technologies, security headers,
          and cookies, such as missing Secure/HttpOnly flags or weak session
          handling. Open any row to inspect the full finding details and the
          underlying evidence.
        </Paper>
      </Zoom>

      <div className="techstackFindings-grid">
        {rows.length > 0 ? (
          <TechstackFindingsDataGrid
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

export default TechstackFindings;
