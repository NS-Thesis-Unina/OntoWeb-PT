import { Divider, Grid, Paper, Typography } from "@mui/material";
import "./runtimeScanResults.css";

function RuntimeScanResults({results, titleDisabled = false}){

  console.log(results)

  return(
    <Paper className="irt-scanresults">
      <div className="title">
        { !titleDisabled && (
          <Typography className="sr-bold sr-mb5 title">
            Runtime Scan Results
          </Typography>
        )}
      </div>
      {!titleDisabled && (<Divider orientation="horizontal" />)}
      <Paper className="rts-status-paper">
        <Grid container className="grid-container">
          <Grid size={3}>
            <strong>Started at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Stopped at</strong>
          </Grid>
          <Grid size={3}>
            <strong>Total events</strong>
          </Grid>
          <Grid size={3}>
            <strong>Unique Pages</strong>
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {new Date(results.run.startedAt).toLocaleString()}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {new Date(results.run.stoppedAt).toLocaleString()}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.pagesCount}
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.totalEvents}
          </Grid>
          <Grid size={12} sx={{marginTop: "5px"}}>
            <strong>Total bytes</strong>
          </Grid>
          <Grid size={3} className="grid-newline-items">
            {results.run.totalBytes}
          </Grid>
        </Grid>
      </Paper>
      {/*
        Object.entries(results.run.dataset).map(([url, scans]) => (
            <Collapsible key={url} defaultOpen={false} title={url}>
            {Array.isArray(scans) && scans.map((scan, index) => (
              <Collapsible key={index} title={`Navigate ${index+1}`} defaultOpen={false}>
                <OneTimeScanResults titleDisabled results={scan} />
              </Collapsible>
            ))}
            </Collapsible>
        )
      )*/}
    </Paper>
  )
}

export default RuntimeScanResults;
