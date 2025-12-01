import { useEffect, useState } from "react";
import "./analyzerFindings.css";
import { Backdrop, CircularProgress, Paper, Typography, Zoom } from "@mui/material";
import AnalyzerFindingsDataGrid from "./components/analyzerFindingsDataGrid/analyzerFindingsDataGrid";
import { enqueueSnackbar } from "notistack";
import { analyzerService } from "../../../services";

function AnalyzerFindings() {
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

      const res = await analyzerService.listAnalyzerFindings({
        offset,
        limit,
      });

      const items = Array.isArray(res.items)
        ? res.items.map((id) => ({ id }))
        : [];

      setRows(items);
      setPage(res.page);
      setParams({ limit: res.page.limit, offset: res.page.offset });
    } catch (error) {
      enqueueSnackbar("Error while loading analyzer findings.", {
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
    <div className="analyzerFindings-div">
      <Typography className="title">Analyzer Findings</Typography>

      <Zoom in={true}>
        <Paper className="description">
          This section lists findings produced by the HTML analyzer. Each entry
          highlights suspicious patterns in markup or scripts, such as inline
          event handlers or potentially injectable content. Open any row to
          inspect the full finding details, the analysis context, and the HTML
          fragments associated with it.
        </Paper>
      </Zoom>

      <div className="analyzerFindings-grid">
        {rows.length > 0 ? (
          <AnalyzerFindingsDataGrid
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

export default AnalyzerFindings;
