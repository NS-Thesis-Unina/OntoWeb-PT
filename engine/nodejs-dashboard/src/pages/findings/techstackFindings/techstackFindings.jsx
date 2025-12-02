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
          This section shows all findings produced by the Techstack resolver after analysing detected
          technologies, WAF signatures, security headers and cookies. Each entry represents a consolidated
          issue, often enriched with CPE/CVE information when known vulnerabilities are involved. Open any
          row to review the rule that fired, the affected technology, its severity and the concrete
          evidence that led to the finding.
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
