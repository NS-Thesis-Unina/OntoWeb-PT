import { Divider, Grid, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import "./oneTimeScanResults.css";
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import { useEffect, useState } from "react";
import { formatWhen, getDomainAccurate } from "../../../../../../libs/formatting";
import CollapsibleDataGrid from "../../../../../../components/collapsible/collapsibleDataGrid/collapsibleDataGrid";
import CollapsibleList from "../../../../../../components/collapsible/collapsibleList/collapsibleList";

function OneTimeScanResults({results, loadSource, titleDisabled = false}){

  const SECTION_IDS = ["head", "body", "stats"];
  const [sections, setSections] = useState(
    Object.fromEntries(SECTION_IDS.map(id => [id, { open: false, key: 0 }]))
  );
  const [allOpen, setAllOpen] = useState(false);

  const toggleAll = () => {
    setSections(prev => {
      const nextOpen = !allOpen;
      const next = {};
      for (const id of SECTION_IDS) {
        next[id] = { open: nextOpen, key: prev[id].key + 1 };
      }
      return next;
    });
    setAllOpen(v => !v);
  };

  const toggleSection = (id) => {
    setSections(prev => ({
      ...prev,
      [id]: { open: !prev[id].open, key: prev[id].key + 1 }
    }));
  };

  useEffect(() => {
    const values = Object.values(sections).map(s => s.open);
    if (values.every(v => v === true)) setAllOpen(true);
    else if (values.every(v => v === false)) setAllOpen(false);
  }, [sections]);

  const secDefaults = (id) => ({ defaultOpen: sections[id].open });
  const secKey = (id, name) => `${id}-${name}-${sections[id].key}`;

  const headMetaColumns = [
    {field: "name", headerName: "Name"},
    {field: "content", headerName: "Content"}
  ]

  const headScriptsColumns = [
    {field: "inline", headerName: "Inline"},
    {field: "src", headerName: "Src"}
  ]

  const headLinksColumns = [
    {field: "rel", headerName: "Rel"},
    {field: "href", headerName: "Href"}
  ]

  const bodyFormsColumns = [
    { field: "method", headerName: "Method" },
    { field: "action", headerName: "Action" },
    { field: "inputs", headerName: "Inputs" }
  ]

  const bodyIFramesColumns = [
    { field: "title", headerName: "Title" },
    { field: "src", headerName: "Src" }
  ]

  const bodyLinksColumns = [
    { field: "text", headerName: "Text"},
    { field: "href", headerName: "Href"}
  ]

  const bodyListsColumns = [
    { field: "type", headerName: "Type"},
    { field: "items", headerName: "Items"}
  ]

  const bodyImagesColumns = [
    { field: "alt", headerName: "Alt"},
    { field: "src", headerName: "Src"}
  ]

  const bodyAudiosVideosColumns = [
    { field: "src", headerName: "Src" },
    { field: "controls", headerName: "Controls" }
  ]

  const headingsColumns = [
    { field: "level", headerName: "Level" },
    { field: "items", headerName: "Items" }
  ];

  return(
    <Paper className="ot-scanresults">
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

      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Head
          </Typography>
        )}
        <div className="sr-options">
          <Tooltip title={sections.head.open ? "Collapse Head" : "Expand Head"} >
            <IconButton variant="contained" size="small" onClick={() => toggleSection("head")}>
              {sections.head.open ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider orientation="horizontal" className="sr-mb5" />
      
      <Grid container className="sr-mt10mb10 sr-p5">
        <Grid size={12}>
          <Typography className="sr-bold">Title</Typography>
        </Grid>
        <Grid size={12} className="sr-minw0">
          <Typography className="sr-wrap">
            {results.results.head.title || "No title"}
          </Typography>
        </Grid>
      </Grid>

      <CollapsibleDataGrid
        key={secKey("head", "meta")}
        {...secDefaults("head")}
        columns={headMetaColumns}
        rows={(results.results.head.meta || []).map(item => ({
          name: item?.name ?? "undefined",
          content: item?.content ?? "undefined"
        }))}
        title={"Meta"}
        titleCount={results.results.head.meta.length}
      />

      <CollapsibleDataGrid
        key={secKey("head", "scripts")}
        {...secDefaults("head")}
        columns={headScriptsColumns}
        rows={(results.results.head.scripts || []).map(item => ({
          inline: item?.inline ?? "undefined",
          src: item?.src ?? "undefined"
        }))}
        title={"Scripts"}
        titleCount={results.results.head.scripts.length}
      />

      <CollapsibleDataGrid
        key={secKey("head", "links")}
        {...secDefaults("head")}
        columns={headLinksColumns}
        rows={(results.results.head.links || []).map(item => ({
          rel: item?.rel ?? "undefined",
          href: item?.href ?? "undefined"
        }))}
        title={"Links"}
        titleCount={results.results.head.links.length}
      />

      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Body
          </Typography>
        )}
        <div className="sr-options">
          <Tooltip title={sections.body.open ? "Collapse Body" : "Expand Body"} >
            <IconButton variant="contained" size="small" onClick={() => toggleSection("body")}>
              {sections.body.open ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider orientation="horizontal" className="sr-mb10" />

      <CollapsibleDataGrid
        key={secKey("body", "forms")}
        {...secDefaults("body")}
        columns={bodyFormsColumns}
        rows={results.results.body.forms}
        title={"Forms"}
        titleCount={results.results.body.forms.length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "iframes")}
        {...secDefaults("body")}
        columns={bodyIFramesColumns}
        rows={results.results.body.iframes}
        title={"iFrames"}
        titleCount={results.results.body.iframes.length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "links")}
        {...secDefaults("body")}
        columns={bodyLinksColumns}
        rows={results.results.body.links}
        title={"Links"}
        titleCount={results.results.body.links.length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "images")}
        {...secDefaults("body")}
        columns={bodyImagesColumns}
        rows={results.results.body.images}
        title={"Images"}
        titleCount={results.results.body.images.length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "audios")}
        {...secDefaults("body")}
        columns={bodyAudiosVideosColumns}
        rows={results.results.body.audios}
        title={"Audios"}
        titleCount={results.results.body.audios.length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "videos")}
        {...secDefaults("body")}
        columns={bodyAudiosVideosColumns}
        rows={results.results.body.videos}
        title={"Videos"}
        titleCount={results.results.body.videos.length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "headings")}
        {...secDefaults("body")}
        columns={headingsColumns}
        rows={(["h1","h2","h3","h4","h5","h6"]).map(level => ({
          level,
          items: Array.isArray(results.results.body.headings?.[level])
            ? results.results.body.headings[level].map((text, i) => ({ index: i + 1, text: String(text ?? "") }))
            : [],
        }))}
        title="Headings"
        titleCount={(["h1","h2","h3","h4","h5","h6"]).filter(l => (results.results.body.headings?.[l]?.length ?? 0) > 0).length}
      />

      <CollapsibleDataGrid
        key={secKey("body", "lists")}
        {...secDefaults("body")}
        columns={bodyListsColumns}
        rows={(results.results.body.lists ?? []).map(l => ({
          type: l?.type ?? "unknown",
          items: Array.isArray(l?.items)
            ? l.items.map((s, i) =>
                (s && typeof s === "object")
                  ? s
                  : { index: i + 1, text: String(s ?? "") }
              )
            : [],
        }))}
        title={"Lists"}
        titleCount={results.results.body.lists.length}
      />

      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Stats
          </Typography>
        )}
        <div className="sr-options">
          <Tooltip title={sections.stats.open ? "Collapse Stats" : "Expand Stats"} >
            <IconButton variant="contained" size="small" onClick={() => toggleSection("stats")}>
              {sections.stats.open ? <IndeterminateCheckBoxOutlinedIcon /> : <IndeterminateCheckBoxIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <Divider orientation="horizontal" className="sr-mb10" />

      <Grid container className="sr-mt10mb10 sr-p5">
        <Grid size={1}>
          <Typography className="sr-bold">Depth</Typography>
        </Grid>
        <Grid size={11} className="sr-minw0">
          <Typography className="sr-wrap">
            {results.results.stats.depth}
          </Typography>
        </Grid>
        <Grid size={2}>
          <Typography className="sr-bold">Total Elements</Typography>
        </Grid>
        <Grid size={10} className="sr-minw0">
          <Typography className="sr-wrap">
            {results.results.stats.totalElements}
          </Typography>
        </Grid>
      </Grid>

      <CollapsibleList
        key={secKey("stats", "tagcount")}
        {...secDefaults("stats")}
        title="TagCount"
        titleCount={Object.keys(results.results.stats.tagCount).length}
        list={Object.entries(results.results.stats.tagCount)
          .sort((a, b) => b[1] - a[1])
          .map(([tag, count]) => `${tag}: ${count}`)}
      />
      
    </Paper>
  )
}

export default OneTimeScanResults;
