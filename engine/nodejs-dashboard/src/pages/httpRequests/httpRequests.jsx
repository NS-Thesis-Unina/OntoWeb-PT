import './httpRequests.css';
import { useEffect, useState } from 'react';
import { Backdrop, CircularProgress, Paper, Typography, Zoom } from '@mui/material';
import { httpRequestsService } from '../../services';
import HttpRequestsDataGrid from './components/httpRequestsDataGrid/httpRequestsDataGrid';
import HttpRequestsFilters from './components/httpRequestsFilters/httpRequestsFilters';
import { enqueueSnackbar } from 'notistack';

/** Default empty filter set (strings for controlled inputs). */
const initialFilters = {
  method: '',
  scheme: '',
  authority: '',
  path: '',
  headerName: '',
  headerValue: '',
  text: '',
};

/**
 * Page: HTTP Requests
 *
 * Architectural Role:
 * - Presents a searchable, paginated view of all HTTP requests ingested into the ontology.
 * - Orchestrates data fetching, filter management, pagination state and list rendering.
 *
 * Responsibilities:
 * - Build query params from UI filters and pagination.
 * - Fetch rows from the backend and display them in a data grid.
 * - Manage loading states and user feedback (snackbars).
 *
 * UX Notes:
 * - Shows a blocking Backdrop only during the very first load (when no rows yet).
 * - Subsequent loads keep the grid visible while the spinner is active.
 *
 * Data Flow:
 * - Filters -> buildRequestParams -> httpRequestsService.listHttpRequests(params) -> rows/page.
 * - Pagination changes trigger a re-fetch with updated offset/limit.
 *
 * Implementation Note:
 * - `applyFilter` is a function-scoped variable toggled before fetch to show a "filters applied"
 *   snackbar. Consider using `useRef` or state if the logic grows, to avoid surprises across re-renders.
 */
function HttpRequests() {
  /** Global loading flag (first load shows Backdrop). */
  const [loading, setLoading] = useState(false);

  /** Current request params used for last fetch (limit/offset only). */
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

  /** Table rows to display. */
  const [rows, setRows] = useState([]);
  /** Current filters bound to the UI. */
  const [filters, setFilters] = useState(initialFilters);

  // Flag used to show a "filters applied" snackbar after a fetch.
  // NOTE: kept as a local variable by design; see Implementation Note above.
  var applyFilter = false;

  /**
   * Build querystring-ready params from paging and filters.
   * Trims string values and removes empty entries.
   */
  const buildRequestParams = (offset, limit, filters = {}) => {
    const params = { offset, limit };

    Object.entries(filters).forEach(([key, value]) => {
      if (value == null) return;

      const trimmed = String(value).trim();
      if (trimmed !== '') {
        params[key] = trimmed;
      }
    });

    return params;
  };

  /**
   * Fetch request list with given offset/limit and optional filter override.
   * Updates rows, page metadata, current params and local filters.
   */
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

      if (applyFilter) {
        enqueueSnackbar('I filtri sono stati applicati correttamente.', { variant: 'success' });
        applyFilter = false;
      }
    } catch (error) {
      enqueueSnackbar('Error while executing the request.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /** Initial load on mount. */
  useEffect(() => {
    fetchRequests(params.offset, params.limit);
  }, []);

  /** Server-side pagination handler. */
  const handlePageChange = (newOffset, newLimit) => {
    fetchRequests(newOffset, newLimit);
  };

  /** Controlled filter updates from child component. */
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  /** Apply the current filters and reset paging to the first page. */
  const handleFiltersApply = () => {
    applyFilter = true;
    fetchRequests(0, params.limit);
  };

  /** Reset all filters and reload from the first page. */
  const handleFiltersReset = () => {
    setFilters(initialFilters);
    fetchRequests(0, params.limit, initialFilters);
  };

  // First render: show blocking loader while bootstrapping.
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

      {/* Intro card with brief usage guidance */}
      <Zoom in={true}>
        <Paper className="description">
          This section gives you a searchable view of all HTTP requests stored in GraphDB after
          being ingested into the ontology. Use the filters above to narrow the traffic by method,
          scheme, authority, path, or full-text search across request and response data. Open any
          row to inspect the full request/response pair in detail, including URL breakdown, headers,
          query parameters, and the stored body payload.
        </Paper>
      </Zoom>

      {/* Filters toolbar (controlled) */}
      <HttpRequestsFilters
        filters={filters}
        onChange={handleFiltersChange}
        onApply={handleFiltersApply}
        onReset={handleFiltersReset}
      />

      {/* Results grid with server-side pagination */}
      <div className="httpRequests-grid">
        {rows.length > 0 ? (
          <HttpRequestsDataGrid
            rows={rows}
            page={page}
            loading={loading}
            onPageChange={handlePageChange}
          />
        ) : (
          <Typography variant="h1" textAlign={'center'}>
            No requests to show.
          </Typography>
        )}
      </div>
    </div>
  );
}

export default HttpRequests;
