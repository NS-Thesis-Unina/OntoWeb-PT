import { Alert, Box, Button, Checkbox, CircularProgress, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Step, StepContent, StepLabel, Stepper, Typography, Zoom, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import "./runtimeScan.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatWhen } from "../../../../../../../libs/formatting";
import toolReactController from "../../../../../../../toolController";
import { getLock, subscribeLockChanges } from "../../../../../../../scanLock";
import { enqueueSnackbar } from "notistack";
import Brightness1Icon from "@mui/icons-material/Brightness1";
import analyzerReactController from "../../../../../analyzerController";
import OneTimeScanResults from "../../../components/oneTimeScanResults/oneTimeScanResults";
import Collapsible from "../../../../../../../components/collapsible/collapsible";

const steps = [
  {
    label: "Analyze runtime scan pages with the ontology",
    description: `Follow the steps to submit a page snapshot, taken from an analyzer runtime scan, to the backend.
    The backend will run a resolver that maps detected HTML elements and scripts to the ontology
    and attempts to identify potential vulnerabilities.`,
  },
  {
    label: "Select a runtime scan",
    description: `From the analyzer runtime scans saved in local storage, choose the run you want to use
    as the source for the analysis.`,
  },
  {
    label: "Select a crawled page",
    description: `From the selected runtime scan, choose the crawled page (URL) whose snapshot
    you want to analyze with the ontology.`,
  },
  {
    label: "Select a page snapshot",
    description: `From the available snapshots for the chosen page, select the specific snapshot
    you want to review and send to the analyzer.`,
  },
  {
    label: "Review the snapshot and submit to the tool",
    description: `Preview the selected snapshot, verify its details, and then submit it to the tool
    to start the ontology-based analysis and vulnerability detection.`,
  },
];

function SendRuntimeScanAnalyzer(){

  const [scanLock, setScanLock] = useState(null);

  const [toolStatus, setToolStatus] = useState("checking");

  const [activeStep, setActiveStep] = useState(0);
  const [continueDisabled, setContinueDisabled] = useState(false);

  const [step1ScanSelected, setStep1ScanSelected] = useState(null);
  const [step1ScanList, setStep1ScanList] = useState([]);
  const [step1LoadingList, setStep1LoadingList] = useState(true);

  const [step2WebSiteList, setStep2WebSiteList] = useState([]);
  const [step2WebSiteSelected, setStep2WebSiteSelected] = useState(null);
  const [step2LoadingList, setStep2LoadingList] = useState(true);

  const [step3WebSiteScanList, setStep3WebSiteScanList] = useState([]);
  const [step3WebSiteScanSelected, setStep3WebSiteScanSelected] = useState(null);
  const [step3LoadingList, setStep3LoadingList] = useState(true);

  const [step4LoadingSendRequests, setStep4LoadingSendRequests] = useState(false);
  const [step4JobEvents, setStep4JobEvents] = useState([]);
  const subscribedJobIdsRef = useRef(new Set());
  const [openJobsDialog, setOpenJobsDialog] = useState(false);

  //Scan Lock
  useEffect(() => {
    let off = null;

    (async () => {
      try {
        const current = await getLock();
        setScanLock(current);
      } catch { /* ignore */ }

      try {
        off = subscribeLockChanges((newVal) => {
          setScanLock(newVal ?? null);
        });
      } catch { /* ignore */ }
    })();

    return () => {
      try { off?.(); } catch { /* ignore */ }
    };
  }, []);

  //Tool Status
  const computeStatus = (payload) =>
    payload?.ok && Object.values(payload.components ?? {}).every((c) => c === "up")
      ? "tool_on"
      : "tool_off";

  useEffect(() => {
    toolReactController.startPolling(5000);

    const off = toolReactController.onMessage({
      onToolUpdate: (payload) => setToolStatus(computeStatus(payload)),
      onJobEvent: (evt) => {
        setStep4JobEvents((prev) => [...prev, evt]);
      },
    });

    toolReactController
      .getHealth()
      .then((data) => setToolStatus(computeStatus(data)))
      .catch(() => setToolStatus("tool_off"));

    return () => {
      off?.();
      toolReactController.stopPolling();
    };
  }, []);

  //Stepper
  const handleNext = () => {
    switch(activeStep){
      case 0: {
        loadScansFromLocalStorage();
        break;
      }
      case 1: {
        renderWebSiteList();
        break;
      }
      case 2: {
        renderWebSiteScanList();
        break;
      }
      case 4: {
        sendRequests();
        break;
      }
      default: {
        //ignore
      }
    }
    setActiveStep((prevActiveStep) => {
      if (prevActiveStep !== 4) {
        return prevActiveStep + 1;
      } else{
        return prevActiveStep;
      }
    });
  };

  const handleBack = () => {
    switch(activeStep){
      case 1: {
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        break;
      }
      case 2: {
        setStep2WebSiteList([]);
        setStep2WebSiteSelected(null);
        break;
      }
      case 3: {
        setStep3WebSiteScanList([]);
        setStep3WebSiteScanSelected(null);
        break;
      }
      case 4: {
        setStep3WebSiteScanSelected(null);
        try {
          for (const id of subscribedJobIdsRef.current) {
            toolReactController.unsubscribeJob(String(id)).catch(() => {});
          }
          subscribedJobIdsRef.current.clear();
        } catch { /* ignore */ }
        break;
      }
      default: {
        //ignore
      }
    }
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setStep1ScanList([]);
    setStep1ScanSelected(null);
    setStep2WebSiteList([]);
    setStep2WebSiteSelected(null);
    setContinueDisabled(false);
    setStep4JobEvents([]);
    try {
      for (const id of subscribedJobIdsRef.current) {
        toolReactController.unsubscribeJob(String(id)).catch(() => {});
      }
      subscribedJobIdsRef.current.clear();
    } catch { /* ignore */ }
    setOpenJobsDialog(false);
    setActiveStep(0);
  };

  useEffect(() => {
    if(toolStatus === "tool_on" && !scanLock){
      switch(activeStep){
        case 0: {
          setContinueDisabled(false);
          break;
        }
        case 1: {
          if(step1LoadingList || !step1ScanSelected || step1ScanList.length === 0 ){
            setContinueDisabled(true);
          }else{
            setContinueDisabled(false);
          }
          break;
        }
        case 2: {
          if(step2LoadingList || !step2WebSiteSelected || step2WebSiteList.length === 0){
            setContinueDisabled(true);
          }else{
            setContinueDisabled(false);
          }
          break;
        }
        case 3: {
          if(step3LoadingList || !step3WebSiteScanSelected || step3WebSiteScanList.length === 0){
            setContinueDisabled(true);
          }else{
            setContinueDisabled(false);
          }
          break;
        }
        case 4: {
          if(!step3WebSiteScanSelected || step4LoadingSendRequests){
            setContinueDisabled(true);
          }else{
            setContinueDisabled(false);
          }
          break;
        }
        default: {
          //ignore
        }
      }
    }else{
      setContinueDisabled(true);
    }
  },[activeStep, step1LoadingList, step1ScanSelected, step1ScanList, step2WebSiteList, step2WebSiteSelected, step2LoadingList, step3WebSiteScanList, step3WebSiteScanSelected, step3LoadingList, step4LoadingSendRequests, toolStatus, scanLock]);

  //Step 1 - Scan List
  const handleToggle = (value) => () => {
    setStep1ScanSelected(value);
  };

  const loadScansFromLocalStorage = useCallback(async () => {
    setStep1LoadingList(true);
    try {
      const list = await analyzerReactController.getAllRuntimeResults();
      setStep1ScanList(Array.isArray(list) ? list : []);

      setStep1LoadingList(false);
    } catch (e) {
      console.log(e?.message || "Error loading runs from storage.", { variant: "error" });
      setStep1LoadingList(false);
    }
  }, []);

  //Step 2
  const handleToggleWebSite = (value) => () => {
    setStep2WebSiteSelected(value);
  };

  const renderWebSiteList = () => {
    setStep2WebSiteList(Object.entries(step1ScanSelected.run.dataset));
    setStep2LoadingList(false)
  }

  //Step 3
  const handleToggleWebSiteScan = (value) => () => {
    setStep3WebSiteScanSelected(value);
  };

  const renderWebSiteScanList = () => {
    setStep3LoadingList(true);
    setStep3WebSiteScanList(step2WebSiteSelected[1]);
    setStep3LoadingList(false);
  }

  //Step 4

  const subscribeJob = useCallback(async (jobId) => {
    const id = String(jobId);
    if (subscribedJobIdsRef.current.has(id)) return;
    subscribedJobIdsRef.current.add(id);
    try {
      const r = await toolReactController.subscribeJob(id);
      if (!r?.ok) {
        console.warn("subscribeJob failed", r);
      }
    } catch (e) {
      console.warn("subscribeJob error", e);
    }
  }, []);

  const sendRequests = async () => {
    if (!step3WebSiteScanSelected) return;
    
    setStep4LoadingSendRequests(true);
    try {
      const { meta, results, html } = step3WebSiteScanSelected;

      const res = await toolReactController.analyzeOneTimeScan({
        url: meta.url,
        html,
        forms: results.body.forms,
        iframes: results.body.iframes,
        scripts: (results.head.scripts || []).map(({ inline, src }) => ({
          code: inline || null,
          src: src || null,
        })),
      });

      if (res?.accepted) {
        enqueueSnackbar("Scan accepted by backend. Waiting for results from the worker...", { variant: "success" });
        if (res?.jobId) {
          await subscribeJob(res.jobId);
        }
      } else {
        enqueueSnackbar(res?.error || "The backend did not accept the scan.", { variant: "warning" });
      }
    } catch (e) {
      enqueueSnackbar("Error while sending the scan (see console for details).", { variant: "error" });
      console.log("Error sending analyzer one-time scan:", e);
    } finally {
      setStep4LoadingSendRequests(false);
      setOpenJobsDialog(true);
    }
  };

  const jobSummaries = useMemo(() => {
    const map = new Map();
    for (const e of step4JobEvents) {
      const id = String(e.jobId ?? e.data?.jobId ?? "");
      if (!id) continue;
      const prev = map.get(id) || { jobId: id, queue: e.queue, lastEvent: null, completed: false, failed: false, raw: [] };
      prev.lastEvent = e.event || e.type || "event";
      prev.queue = e.queue || prev.queue || "http";
      prev.raw.push(e);
      if (e.event === "completed") prev.completed = true;
      if (e.event === "failed") prev.failed = true;
      map.set(id, prev);
    }
    return Array.from(map.values()).sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)));
  }, [step4JobEvents]);

  return (
    <div className="sendinterceptor-div">

      {toolStatus === "tool_off" && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>The backend tool must be running to use this feature.</Typography>
        </Alert>
      )}

      {scanLock && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>
            A scan is currently running in another component:
            {scanLock.label ? `: “${scanLock.label}”` : ""}.
            <br />
            Please finish or stop the scan before proceeding.
          </Typography>
        </Alert>
      )}

      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Analyzer Runtime Scan</strong> submits a page snapshot taken from a saved runtime scan
            (HTML, scripts, forms, iframes) to your backend analyzer. The backend enqueues a background job
            (BullMQ via Redis) and emits status events over WebSockets.
          </Typography>
        </Zoom>
      </Paper>

      <Box className="content-box">
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label} className="step-full">
              <StepLabel
                optional={
                  index === steps.length - 1 ? (
                    <Typography variant="caption">Last step</Typography>
                  ) : null
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography>{step.description}</Typography>
                {activeStep === 1 && (
                  <List className="full-list">
                    {step1LoadingList && (
                      <Box className="centered-loading">
                        <CircularProgress />
                      </Box>
                    )}

                    {!step1LoadingList && step1ScanList.length === 0 && (
                      <Box className="empty-box">
                        <Typography variant="body2" color="text.secondary" align="center">
                          No runtime scans available to select.
                        </Typography>
                      </Box>
                    )}

                    {!step1LoadingList && step1ScanList.length > 0 && step1ScanList.map((value) => {
                      const labelId = `checkbox-list-label-${value.startedAt}`;
                      return (
                        <ListItem
                          key={value.startedAt}
                          disablePadding
                          divider
                        >
                          <ListItemButton
                            role={undefined}
                            onClick={handleToggle(value)}
                            dense
                          >
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={step1ScanSelected === value}
                                tabIndex={-1}
                                disableRipple
                              />
                            </ListItemIcon>
                            <ListItemText
                              id={labelId}
                              primary={`Started: ${formatWhen(value.run.startedAt)} | Stopped: ${formatWhen(value.run.stoppedAt)} | Pages: ${value.run.pagesCount} | Scans: ${value.run.totalScans}`}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>

                )}
                {activeStep === 2 && (
                  <List className="full-list">
                    {step2LoadingList && (
                      <Box className="centered-loading">
                        <CircularProgress />
                      </Box>
                    )}

                    {!step2LoadingList && step2WebSiteList.length === 0 && (
                      <Box className="empty-box">
                        <Typography variant="body2" color="text.secondary" align="center">
                          No crawled pages available to select.
                        </Typography>
                      </Box>
                    )}

                    {!step2LoadingList && step2WebSiteList.length > 0 && step2WebSiteList.map((value) => {

                      return (
                        <ListItem
                          key={value[0]}
                          disablePadding
                          divider
                        >
                          <ListItemButton role={undefined} onClick={handleToggleWebSite(value)} dense>
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={step2WebSiteSelected === value}
                                tabIndex={-1}
                                disableRipple
                              />
                            </ListItemIcon>
                            <Stack>
                              <Stack className="row-align-start">
                                <Typography className="label-bold">Page:</Typography>
                                <Typography className="text-wrap-flex">
                                  {value[0]}
                                </Typography>
                              </Stack>
                              <Stack className="row">
                                <Typography className="label-bold-sm">Scans:</Typography>
                                <Typography>{value[1].length}</Typography>
                              </Stack>
                            </Stack>
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
                {activeStep === 3 && (
                  <List className="full-list">
                    {step3LoadingList && (
                      <Box className="centered-loading">
                        <CircularProgress />
                      </Box>
                    )}

                    {!step3LoadingList && step3WebSiteScanList.length === 0 && (
                      <Box className="empty-box">
                        <Typography variant="body2" color="text.secondary" align="center">
                          No page snapshots available to select for the chosen URL.
                        </Typography>
                      </Box>
                    )}

                    {!step3LoadingList && step3WebSiteScanList.length > 0 && step3WebSiteScanList.map((value, index) => {

                      return (
                        <ListItem
                          key={index}
                          disablePadding
                          divider
                        >
                          <ListItemButton role={undefined} onClick={handleToggleWebSiteScan(value)} dense>
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={step3WebSiteScanSelected === value}
                                tabIndex={-1}
                                disableRipple
                              />
                            </ListItemIcon>
                            <Collapsible defaultOpen={false} title={`Page: ${value.meta.url} | TabID: ${value.meta.tabId}`}>
                              <OneTimeScanResults key={index} results={value} titleDisabled/>
                            </Collapsible>
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
                {activeStep === 4 && step3WebSiteScanSelected && (
                  <>
                    <OneTimeScanResults results={step3WebSiteScanSelected} titleDisabled />
                    <Dialog open={openJobsDialog} fullWidth>
                      <DialogTitle>
                        Job Summaries
                      </DialogTitle>
                      <DialogContent>
                        <Typography variant="body2" className="jobsummaries-description">
                          This dialog displays background jobs processed via BullMQ and Redis.
                          Each job shows its ID and completion status.
                        </Typography>
                        {jobSummaries.length > 0 ? (
                          jobSummaries.map((job, index) => (
                            <Paper key={index} className="jobsummaries-item">
                              <div className="item-div">
                                <Brightness1Icon color={job.completed ? "success" : "error"} />
                                <Typography variant="body2">
                                  <strong>Queue:</strong> {job.queue}
                                </Typography>
                                <strong>|</strong>
                                <Typography variant="body2">
                                  <strong>JobId:</strong> {job.jobId}
                                </Typography>
                                <strong>|</strong>
                                <Typography variant="body2">
                                  <strong>Completed:</strong> {job.completed ? "true" : "false"}
                                </Typography>
                              </div>
                            </Paper>
                          )))
                          :
                          (
                            <div className="jobsummaries-loading-div">
                              <CircularProgress />
                            </div>
                          )}
                      </DialogContent>
                      <DialogActions>
                        <Button variant="contained" onClick={handleReset}>
                          OK
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </>
                )}
                <Box className="actions">
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    className="btn"
                    disabled={continueDisabled}
                    loading={activeStep === 4 && step4LoadingSendRequests}
                  >
                    {index === steps.length - 1 ? 'Send Scan' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0 || (activeStep === 4 && step4LoadingSendRequests) || toolStatus === "tool_off"}
                    onClick={handleBack}
                    className="btn"
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>
    </div>
  );
}

export default SendRuntimeScanAnalyzer;
