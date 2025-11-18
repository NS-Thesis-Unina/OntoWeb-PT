import './scanResults.css';
import { Divider, Grid, IconButton, Paper, Tooltip, Typography } from '@mui/material';

import CollapsibleList from '../../../../../../components/collapsible/collapsibleList/collapsibleList';
import CollapsibleSecureHeaders from '../collapsibleSecureHeaders/collapsibleSecureHeaders';
import CollapsibleDataGrid from '../../../../../../components/collapsible/collapsibleDataGrid/collapsibleDataGrid';
import Collapsible from '../../../../../../components/collapsible/collapsible';

import { chromeDark, chromeLight, Inspector } from 'react-inspector';
import { useThemeMode } from '../../../../../../theme/themeModeProvider';

import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import DeleteIcon from '@mui/icons-material/Delete';

import { useState } from 'react';
import { formatWhen, getDomainAccurate } from '../../../../../../libs/formatting';
import DownloadJsonButton from '../../../../../../components/downloadJsonButton/downloadJsonButton';
import DeleteScanDialog from '../../../../../../components/deleteScanDialog/deleteScanDialog';

/**
 * **ScanResults Component**
 *
 * Displays the full results of a Technology Stack scan (TechStackEngine).
 *
 * Architectural Role:
 *   TechStack Section
 *     → Scan / Analyze / Archive views
 *       → <ScanResults />
 *
 * Responsibilities:
 * - Render structured scan metadata (timestamp, domain, tabId, URL)
 * - Render grouped result categories:
 *      • Technologies
 *      • Secure Headers
 *      • WAF detections
 *      • Cookies
 *      • LocalStorage
 *      • SessionStorage
 *      • Raw data inspector
 *
 * - Provide UI utilities:
 *      • Expand/Collapse all collapsible sections
 *      • JSON export button
 *      • Optional delete-scan action with confirmation dialog
 *      • Render source information (session/local)
 *
 * Behavior Notes:
 * - `allOpen` toggles *all* collapsible components via a reset key used
 *   to force re-rendering of Collapsible instances.
 * - Supports three loading origins for display:
 *      "session_by_tab" → Loaded from tab sessionStorage
 *      "session"        → Loaded from global sessionStorage
 *      "local"          → Loaded from localStorage archive
 *
 * Props:
 *   - results (object): Complete scan result { meta, results }
 *   - loadSource (string): Indicates where the scan result was retrieved
 *   - titleDisabled (boolean): Hide/show the title bar
 *   - deleteDisable (boolean): Hide/show the delete icon
 *   - deleteScan (function): Callback for deletion
 */
function ScanResults({
  results,
  loadSource,
  titleDisabled = false,
  deleteDisable = true,
  deleteScan,
}) {
  const { mode } = useThemeMode();

  // ---------------------------------------------------------------------------
  // Expand / Collapse All State
  // ---------------------------------------------------------------------------

  const [allOpen, setAllOpen] = useState(false);

  /**
   * resetKey forces Collapsible components to remount,
   * ensuring they react to a global allOpen toggle.
   */
  const [resetKey, setResetKey] = useState(0);

  const toggleAll = () => {
    setAllOpen((o) => !o);
    setResetKey((k) => k + 1);
  };

  // ---------------------------------------------------------------------------
  // Delete dialog open/close state
  // ---------------------------------------------------------------------------

  const [openDeleteScan, setOpenDeleteScan] = useState(false);

  // ---------------------------------------------------------------------------
  // DataGrid Column Definitions
  // ---------------------------------------------------------------------------

  const cookiesColumns = [
    { field: 'name', headerName: 'Name' },
    { field: 'value', headerName: 'Value' },
    { field: 'domain', headerName: 'Domain' },
    { field: 'httpOnly', headerName: 'HttpOnly' },
  ];

  const storageColumns = [
    { field: 'key', headerName: 'Key' },
    { field: 'value', headerName: 'Value' },
  ];

  // ---------------------------------------------------------------------------
  // Component Render
  // ---------------------------------------------------------------------------

  return (
    <Paper className="scanresults">
      {/* ------------------------------------------------------------
          TITLE BAR (optional)
         ------------------------------------------------------------ */}
      <div className="title">
        {!titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            {`Scan Results ${
              loadSource
                ? loadSource === 'session_by_tab'
                  ? '(Loaded from Tab sessionStorage)'
                  : loadSource === 'session'
                  ? '(Loaded from sessionStorage)'
                  : loadSource === 'local'
                  ? '(Loaded from localStorage)'
                  : ''
                : ''
            }`}
          </Typography>
        )}

        {/* Right-side actions (Delete, JSON Download, Expand/Collapse All) */}
        <div className="sr-options">
          {!deleteDisable && (
            <Tooltip title={'Delete Scan'}>
              <IconButton variant="contained" size="small" onClick={() => setOpenDeleteScan(true)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Export JSON */}
          {results && (
            <DownloadJsonButton
              data={results}
              filename={`techstackResults_${results.meta.timestamp}`}
            />
          )}

          {/* Expand / Collapse All Sections */}
          <Tooltip title={allOpen ? 'Collapse All' : 'Expand All'}>
            <IconButton variant="contained" size="small" onClick={toggleAll}>
              {allOpen ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {!titleDisabled && <Divider orientation="horizontal" />}

      {/* ------------------------------------------------------------
          Delete dialog (confirmation UI)
         ------------------------------------------------------------ */}
      <DeleteScanDialog open={openDeleteScan} setOpen={setOpenDeleteScan} deleteFn={deleteScan} />

      {/* ------------------------------------------------------------
          METADATA (Date, Domain, TabId)
         ------------------------------------------------------------ */}
      <Grid container className="sr-mt10">
        <Grid size={4}>
          <Typography className="sr-bold">Date</Typography>
        </Grid>
        <Grid size={4}>
          <Typography className="sr-bold">Domain</Typography>
        </Grid>
        <Grid size={4}>
          <Typography className="sr-bold">TabID</Typography>
        </Grid>

        <Grid size={4}>
          <Typography>{results?.meta?.date || formatWhen(results?.meta?.timestamp)}</Typography>
        </Grid>
        <Grid size={4}>
          <Typography>{results?.meta?.domain || getDomainAccurate(results?.meta?.url)}</Typography>
        </Grid>
        <Grid size={4}>
          <Typography>{results?.meta?.tabId}</Typography>
        </Grid>
      </Grid>

      {/* URL */}
      <Grid container className="sr-mt10mb10">
        <Grid size={12}>
          <Typography className="sr-bold">URL</Typography>
        </Grid>
        <Grid size={12} className="sr-minw0">
          <Typography className="sr-wrap">{results.meta.url}</Typography>
        </Grid>
      </Grid>

      {/* ------------------------------------------------------------
          TECHNOLOGIES
         ------------------------------------------------------------ */}
      <CollapsibleList
        key={`tech-${resetKey}`}
        defaultOpen={allOpen}
        title={'Technologies'}
        titleCount={results.results.technologies.length}
        list={(results?.results?.technologies ?? [])
          .map((t) => {
            const name = (t?.name ?? '').trim();
            const version = String(t?.version ?? '').trim();
            if (!name) return '';
            return version ? `${name} - ${version}` : name;
          })
          .filter(Boolean)}
      />

      {/* SECURE HEADERS */}
      <CollapsibleSecureHeaders
        key={`headers-${resetKey}`}
        defaultOpen={allOpen}
        secureHeaders={results.results.secureHeaders}
      />

      {/* WAF DETECTIONS */}
      <CollapsibleList
        key={`wafs-${resetKey}`}
        defaultOpen={allOpen}
        title={'WAFs'}
        titleCount={results.results.waf.length}
        list={(results?.results?.waf ?? [])
          .map((t) => (t && typeof t.name === 'string' ? t.name.trim() : ''))
          .filter(Boolean)}
      />

      {/* COOKIES */}
      <CollapsibleDataGrid
        key={`cookies-${resetKey}`}
        defaultOpen={allOpen}
        title={'Cookies'}
        titleCount={results.results.cookies.length}
        columns={cookiesColumns}
        rows={results.results.cookies}
      />

      {/* LOCALSTORAGE */}
      <CollapsibleDataGrid
        key={`local-${resetKey}`}
        defaultOpen={allOpen}
        title={'LocalStorage'}
        titleCount={results.results.storage.localStorage.length}
        columns={storageColumns}
        rows={results.results.storage.localStorage}
      />

      {/* SESSIONSTORAGE */}
      <CollapsibleDataGrid
        key={`session-${resetKey}`}
        defaultOpen={allOpen}
        title={'SessionStorage'}
        titleCount={results.results.storage.sessionStorage.length}
        columns={storageColumns}
        rows={results.results.storage.sessionStorage}
      />

      {/* RAW JSON Inspector */}
      <Collapsible key={`raw-${resetKey}`} defaultOpen={allOpen} title={'Raw'}>
        <Inspector
          data={results.results.raw}
          theme={mode === 'dark' ? chromeDark : chromeLight}
          expandLevel={2}
        />
      </Collapsible>
    </Paper>
  );
}

export default ScanResults;
