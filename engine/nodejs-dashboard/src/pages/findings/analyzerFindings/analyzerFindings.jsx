import './analyzerFindings.css';
import { useEffect, useState } from 'react';
import { Backdrop, CircularProgress, Paper, Typography, Zoom } from '@mui/material';
import AnalyzerFindingsDataGrid from './components/analyzerFindingsDataGrid/analyzerFindingsDataGrid';
import { enqueueSnackbar } from 'notistack';
import { analyzerService } from '../../../services';

/**
 * Page: Analyzer Findings
 *
 * Architectural Role:
 * - Lists findings produced by the HTML Analyzer (DOM/page inspections).
 * - Manages pagination state, data fetching, and renders a details grid.
 *
 * Responsibilities:
 * - Fetch paginated IDs of analyzer findings and adapt them to DataGrid rows.
 * - Show first-load backdrop; keep grid visible on subsequent loads.
 * - Surface errors via snackbars.
 *
 * Data Flow:
 * - fetchFindings(offset, limit) -> analyzerService.listAnalyzerFindings -> rows/page.
 * - Pagination interactions trigger a re-fetch.
 */
function AnalyzerFindings() {
  /** Loading flag for list fetches. */
  const [loading, setLoading] = useState(false);

  /** Last-used paging params. */
  const [params, setParams] = useState({ limit: 100, offset: 0 });

  /** Server-provided pagination metadata. */
  const [page, setPage] = useState({
    limit: 100,
    offset: 0,
    total: 0,
    hasNext: false,
    hasPrev: false,
    nextOffset: 0,
    prevOffset: 0,
  });

  /** DataGrid rows (must expose an `id` field). */
  const [rows, setRows] = useState([]);

  /**
   * Fetch and normalize analyzer findings.
   * The API returns an array of IDs and target domain; adapt to DataGrid rows: { id, target }.
   */
  const fetchFindings = async (offset, limit) => {
    try {
      setLoading(true);

      const res = await analyzerService.listAnalyzerFindings({
        offset,
        limit,
      });

      const ids = Array.isArray(res.items) ? res.items : [];

      const items = await Promise.all(
        ids.map(async (id) => {
          try {
            const detail = await analyzerService.getAnalyzerFindingById(id);

            return {
              id,
              target: detail?.mainDomain ?? null,
            };
          } catch (err) {
            console.error('Error while loading analyzer finding detail', id, err);
            return {
              id,
              target: null,
            };
          }
        })
      );

      setRows(items);
      setPage(res.page);
      setParams({ limit: res.page.limit, offset: res.page.offset });
    } catch (error) {
      enqueueSnackbar('Error while loading analyzer findings.', {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  /** Initial load. */
  useEffect(() => {
    fetchFindings(params.offset, params.limit);
  }, []);

  /** Server-side pagination handler. */
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

      {/* Intro description with a soft entrance animation */}
      <Zoom in={true}>
        <Paper className="description">
          This section displays findings produced by the HTML analyzer over captured pages and DOM
          snapshots. Each entry points to suspicious markup or script patterns – for example inline
          event handlers, dangerous sinks or untrusted content that may lead to injection issues.
          Open any row to inspect the full finding details, including severity, OWASP mapping,
          analysis context and the exact HTML fragments that were flagged.
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
