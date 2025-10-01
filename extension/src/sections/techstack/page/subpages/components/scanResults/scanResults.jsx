import { Divider, Grid, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import "./scanResults.css";
import CollapsibleList from "../../../../../../components/collapsible/collapsibleList/collapsibleList";
import CollapsibleSecureHeaders from "../../../../components/collapsibleSecureHeaders/collapsibleSecureHeaders";
import CollapsibleDataGrid from "../../../../../../components/collapsible/collapsibleDataGrid/collapsibleDataGrid";
import Collapsible from "../../../../../../components/collapsible/collapsible";
import { chromeDark, chromeLight, Inspector } from "react-inspector";
import { useThemeMode } from "../../../../../../theme/themeModeProvider";
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import { useState } from "react";
import { formatWhen, getDomainAccurate } from "../../../../../../libs/formatting";

function ScanResults({results, loadSource, titleDisabled = false}){

  const { mode } = useThemeMode();

    const [allOpen, setAllOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const toggleAll = () => {
    setAllOpen(o => !o);
    setResetKey(k => k + 1);   // forza il remount delle sezioni
  };

  const cookiesColumns = [
    {field: "name", headerName: "Name"}, 
    {field: "value", headerName: "Value"}, 
    {field: "domain", headerName: "Domain"}, 
    {field: "httpOnly", headerName: "HttpOnly"}
  ];

  const storageColumns = [
    {field: "key", headerName: "Key"},
    {field: "value", headerName: "Value"}
  ]

  return(
    <Paper className="scanresults">
      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            {`Scan Results ${loadSource ? 
              loadSource === "session_by_tab" ? "(Loaded from Tab sessionStorage)" : 
                loadSource === "session" ? "(Loaded from sessionStorage)" :
                  loadSource === "local" ? "(Loaded from localStorage)" : ""
            : ""}`}
          </Typography>
        )}
        <div className="sr-options">
          <Tooltip title={allOpen ? "Collapse All":"Expand All"} >
            <IconButton variant="contained" size="small" onClick={toggleAll}>
              {allOpen ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
      {!titleDisabled && (<Divider orientation="horizontal" />)}

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

      <Grid container className="sr-mt10mb10">
        <Grid size={12}>
          <Typography className="sr-bold">URL</Typography>
        </Grid>
        <Grid size={12} className="sr-minw0">
          <Typography className="sr-wrap">
            {results.meta.url}
          </Typography>
        </Grid>
      </Grid>

      <CollapsibleList 
        key={`tech-${resetKey}`}
        defaultOpen={allOpen} 
        title={"Technologies"} 
        titleCount={results.results.technologies.length}
        list={(results?.results?.technologies ?? [])
          .map(t => (t && typeof t.name === 'string' ? t.name.trim() : ''))
          .filter(Boolean)
        }
      />

      <CollapsibleSecureHeaders
        key={`headers-${resetKey}`}
        defaultOpen={allOpen}
        secureHeaders={results.results.secureHeaders} 
      />

      <CollapsibleList 
        key={`wafs-${resetKey}`} 
        defaultOpen={allOpen}
        title={"WAFs"} 
        titleCount={results.results.waf.length}
        list={(results?.results?.waf ?? [])
          .map(t => (t && typeof t.name === 'string' ? t.name.trim() : ''))
          .filter(Boolean)
        }
      />

      <CollapsibleDataGrid
        key={`cookies-${resetKey}`}
        defaultOpen={allOpen}
        title={"Cookies"} 
        titleCount={results.results.cookies.length}
        columns={cookiesColumns} 
        rows={results.results.cookies} 
      />

      <CollapsibleDataGrid 
        key={`local-${resetKey}`}
        defaultOpen={allOpen}
        title={"LocalStorage"} 
        titleCount={results.results.storage.localStorage.length}
        columns={storageColumns} 
        rows={results.results.storage.localStorage} 
      />

      <CollapsibleDataGrid 
        key={`session-${resetKey}`}
        defaultOpen={allOpen}
        title={"SessionStorage"} 
        titleCount={results.results.storage.sessionStorage.length}
        columns={storageColumns} 
        rows={results.results.storage.sessionStorage} 
      />

      <Collapsible 
        key={`raw-${resetKey}`} 
        defaultOpen={allOpen} 
        title={"Raw"} 
      >
        <Inspector 
          data={results.results.raw} 
          theme={mode === "dark" ? chromeDark : chromeLight} 
          expandLevel={2} 
        />
      </Collapsible>
    </Paper>
  )
}

export default ScanResults;
