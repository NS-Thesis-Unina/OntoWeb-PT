import './httpRequestsFilters.css';
import { useState, useMemo } from 'react';
import { Paper, Stack, TextField, Button, MenuItem } from '@mui/material';

/** Canonical set of HTTP methods for filtering. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];

/** Ensure all fields are string-trimmed for stable comparisons. */
function normalizeFilters(obj = {}) {
  const result = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    result[key] = value == null ? '' : String(value).trim();
  });
  return result;
}

/** Shallow equality with normalization to avoid false positives. */
function areFiltersEqual(a, b) {
  const na = normalizeFilters(a);
  const nb = normalizeFilters(b);
  const keys = new Set([...Object.keys(na), ...Object.keys(nb)]);
  for (const key of keys) {
    if ((na[key] ?? '') !== (nb[key] ?? '')) {
      return false;
    }
  }
  return true;
}

/**
 * Component: HttpRequestsFilters
 *
 * Architectural Role:
 * - Controlled filter toolbar for the HTTP Requests page.
 * - Emits changes to the parent and provides Apply/Reset actions.
 *
 * Responsibilities:
 * - Normalize and compare filter objects to detect pending changes.
 * - Keep track of the last "applied" snapshot to enable/disable Apply button.
 *
 * UX Notes:
 * - Inputs are compact and wrap gracefully on small screens.
 * - The "Apply" button is disabled until there are unapplied changes.
 */
function HttpRequestsFilters({ filters, onChange, onApply, onReset }) {
  // Snapshot of the last applied filters; used to toggle Apply button state.
  const [appliedFilters, setAppliedFilters] = useState(filters);

  // Curried change handler: propagates controlled updates to parent.
  const handleChange = (field) => (event) => {
    onChange({
      ...filters,
      [field]: event.target.value,
    });
  };

  // Determine whether the current filters differ from the last applied.
  const hasChanges = useMemo(
    () => !areFiltersEqual(filters, appliedFilters),
    [filters, appliedFilters]
  );

  // Apply: notify parent and update local snapshot.
  const handleApplyClick = () => {
    onApply();
    setAppliedFilters(filters);
  };

  // Reset: clear all fields and update local snapshot accordingly.
  const handleResetClick = () => {
    const cleared = {};
    Object.keys(filters || {}).forEach((key) => {
      cleared[key] = '';
    });
    setAppliedFilters(cleared);
    onReset();
  };

  return (
    <Paper className="httprequests-filters" elevation={1}>
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" alignItems="flex-end">
        <TextField
          label="Method"
          size="small"
          select
          value={filters.method || ''}
          onChange={handleChange('method')}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">All</MenuItem>
          {HTTP_METHODS.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Scheme"
          size="small"
          value={filters.scheme || ''}
          onChange={handleChange('scheme')}
          placeholder="https"
        />

        <TextField
          label="Authority"
          size="small"
          value={filters.authority || ''}
          onChange={handleChange('authority')}
          placeholder="www.example.com"
        />

        <TextField
          label="Path"
          size="small"
          value={filters.path || ''}
          onChange={handleChange('path')}
          placeholder="/index.html"
        />

        <TextField
          label="Full-text"
          size="small"
          value={filters.text || ''}
          onChange={handleChange('text')}
          placeholder="Search in request/response"
          sx={{ minWidth: 220 }}
        />

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            onClick={handleApplyClick}
            disabled={!hasChanges}
          >
            Apply
          </Button>
          <Button variant="text" size="small" onClick={handleResetClick}>
            Reset
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default HttpRequestsFilters;
