import { useState, useMemo } from "react";
import { Paper, Stack, TextField, Button, MenuItem } from "@mui/material";
import "./httpRequestsFilters.css";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"];

function normalizeFilters(obj = {}) {
  const result = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    result[key] = value == null ? "" : String(value).trim();
  });
  return result;
}

function areFiltersEqual(a, b) {
  const na = normalizeFilters(a);
  const nb = normalizeFilters(b);
  const keys = new Set([...Object.keys(na), ...Object.keys(nb)]);
  for (const key of keys) {
    if ((na[key] ?? "") !== (nb[key] ?? "")) {
      return false;
    }
  }
  return true;
}

function HttpRequestsFilters({ filters, onChange, onApply, onReset }) {
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const handleChange = (field) => (event) => {
    onChange({
      ...filters,
      [field]: event.target.value,
    });
  };

  const hasChanges = useMemo(
    () => !areFiltersEqual(filters, appliedFilters),
    [filters, appliedFilters]
  );

  const handleApplyClick = () => {
    onApply();
    setAppliedFilters(filters);
  };

  const handleResetClick = () => {
    const cleared = {};
    Object.keys(filters || {}).forEach((key) => {
      cleared[key] = "";
    });
    setAppliedFilters(cleared);
    onReset();
  };

  return (
    <Paper className="httprequests-filters" elevation={1}>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        alignItems="flex-end"
      >
        <TextField
          label="Method"
          size="small"
          select
          value={filters.method || ""}
          onChange={handleChange("method")}
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
          value={filters.scheme || ""}
          onChange={handleChange("scheme")}
          placeholder="https"
        />

        <TextField
          label="Authority"
          size="small"
          value={filters.authority || ""}
          onChange={handleChange("authority")}
          placeholder="www.example.com"
        />

        <TextField
          label="Path"
          size="small"
          value={filters.path || ""}
          onChange={handleChange("path")}
          placeholder="/index.html"
        />

        <TextField
          label="Full-text"
          size="small"
          value={filters.text || ""}
          onChange={handleChange("text")}
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
