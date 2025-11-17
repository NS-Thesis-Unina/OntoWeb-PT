import { Alert, Box, Button, Checkbox, CircularProgress, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Step, StepContent, StepLabel, Stepper, Typography, Zoom, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import "./analyze.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { formatWhen, getDomainAccurate } from "../../../../../libs/formatting";
import toolReactController from "../../../../../toolController";
import { getLock, subscribeLockChanges } from "../../../../../scanLock";
import techStackReactController from "../../../techstackController";
import ScanResults from "../components/scanResults/scanResults";
import Brightness1Icon from "@mui/icons-material/Brightness1";
import { enqueueSnackbar } from "notistack";

const steps = [
  {
    label: "Analyze the technology stack with the ontology",
    description: `Follow the steps to submit a techstack scan to the backend.
    The backend will run a resolver that maps detected technologies to the ontology
    and attempts to identify potential vulnerabilities.`,
  },
  {
    label: "Select a scan",
    description: `From the scans saved in local storage, choose the one you want to use
    as the source for the analysis.`,
  },
  {
    label: "Review the scan and submit to the tool",
    description: `Preview the selected scan, verify its details, and then submit it to the tool
    to start the ontology-based analysis and vulnerability detection.`,
  },
];

function AnalyzeTechstack() {
  const [scanLock, setScanLock] = useState(null);
  const [toolStatus, setToolStatus] = useState("checking");

  const [activeStep, setActiveStep] = useState(0);
  const [continueDisabled, setContinueDisabled] = useState(false);

  const [step1LoadingList, setStep1LoadingList] = useState(false);
  const [step1ScanList, setStep1ScanList] = useState([]);
  const [step1ScanSelected, setStep1ScanSelected] = useState(null);

  const [step3LoadingSend, setStep3LoadingSend] = useState(false);

  const [jobEvents, setJobEvents] = useState([]);
  const [openJobsDialog, setOpenJobsDialog] = useState(false);
  const subscribedJobIdsRef = useRef(new Set());

  // ---------------------- Scan Lock ----------------------
  useEffect(() => {
    let off = null;

    (async () => {
      try {
        const current = await getLock();
        setScanLock(current);
      } catch {
        /* ignore */
      }

      try {
        off = subscribeLockChanges((newVal) => {
          setScanLock(newVal ?? null);
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      try {
        off?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ---------------------- Tool Status & socket events ----------------------
  const computeStatus = (payload) =>
    payload?.ok && Object.values(payload.components ?? {}).every((c) => c === "up")
      ? "tool_on"
      : "tool_off";

  useEffect(() => {
    toolReactController.startPolling(5000);

    const off = toolReactController.onMessage({
      onToolUpdate: (payload) => setToolStatus(computeStatus(payload)),
      onJobEvent: (evt) => {
        // Collect any BullMQ job events (including 'techstack' queue)
        setJobEvents((prev) => [...prev, evt]);
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

  // ---------------------- Stepper controls ----------------------
  const handleNext = () => {
    switch (activeStep) {
      case 0: {
        loadScansFromLocalStorage();
        break;
      }
      case 2: {
        sendScan();
        break;
      }
      default: {
        // ignore
      }
    }
    setActiveStep((prev) => {
      if (prev !== 2) return prev + 1;
      return prev; // last step triggers send, do not advance
    });
  };

  const handleBack = () => {
    switch (activeStep) {
      case 1: {
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        setStep1LoadingList(false);
        break;
      }
      case 2: {
        // reset selection and reload list for convenience
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        setStep1LoadingList(false);
        loadScansFromLocalStorage();
        break;
      }
      default: {
        // ignore
      }
    }
    setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setContinueDisabled(false);
    setActiveStep(0);

    // Cleanup job subscriptions & dialog
    try {
      for (const id of subscribedJobIdsRef.current) {
        toolReactController.unsubscribeJob(String(id)).catch(() => {});
      }
      subscribedJobIdsRef.current.clear();
    } catch {
      /* ignore */
    }
    setJobEvents([]);
    setOpenJobsDialog(false);
  };

  // Button enable/disable based on status & selections
  useEffect(() => {
    if (toolStatus === "tool_on" && !scanLock) {
      switch (activeStep) {
        case 0:
          setContinueDisabled(false);
          break;
        case 1:
          setContinueDisabled(
            !(step1ScanSelected && step1ScanList.length > 0 && !step1LoadingList)
          );
          break;
        default:
          // step 2 (send) handled by button loading state
          break;
      }
    } else {
      setContinueDisabled(true);
    }
  }, [activeStep, toolStatus, scanLock, step1ScanSelected, step1ScanList, step1LoadingList]);

  // ---------------------- Step 1 - Scan List ----------------------
  const handleToggle = (value) => () => {
    setStep1ScanSelected(value);
  };

  function normalizeSnapshot(snap) {
    if (!snap) return null;
    if (snap.meta && snap.results) return snap;
    if (snap.results && snap.results.meta && snap.results.results) {
      return { meta: snap.results.meta, results: snap.results.results };
    }
    if (snap.results) return { meta: snap.meta || {}, results: snap.results };
    if (snap.technologies || snap.waf || snap.storage || snap.cookies || snap.raw) {
      return { meta: snap.meta || null, results: snap };
    }
    return null;
  }

  const loadScansFromLocalStorage = async () => {
    setStep1LoadingList(true);
    try {
      const locals = await techStackReactController.getLocalResults();
      const normalizedLocals = (Array.isArray(locals) ? locals : [])
        .map((s) => {
          const norm = normalizeSnapshot(s.results || s);
          const ts =
            norm?.meta?.timestamp ??
            (Number(String(s.key || "").replace("techstackResults_", "")) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .filter((x) => x.snap) // drop invalid
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setStep1ScanList(normalizedLocals);
      setStep1LoadingList(false);
    } catch (e) {
      console.log(e?.message || "Error loading scnas from storage.", {
        variant: "error",
      });
      setStep1LoadingList(false);
    }
  };

  // ---------------------- Step 3 - Send to tool ----------------------
  const subscribeJob = useCallback(async (jobId) => {
    const id = String(jobId || "");
    if (!id || subscribedJobIdsRef.current.has(id)) return;
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

  const sendScan = async () => {
    if (!step1ScanSelected?.snap) return;

    setStep3LoadingSend(true);
    try {
      const res = await toolReactController.analyzeTechstack(step1ScanSelected.snap.results);

      if (res?.accepted) {
        enqueueSnackbar(
          "Scan accepted by backend. Waiting for results from the worker...",
          { variant: "success" }
        );
        if (res?.jobId) {
          await subscribeJob(res.jobId);
        }
      } else {
        enqueueSnackbar(
          res?.error || "The backend did not accept the scan.",
          { variant: "warning" }
        );
      }
    } catch (e) {
      enqueueSnackbar(
        "Error while sending the scan (see console for details).",
        { variant: "error" }
      );
      console.log("Error sending techstack analyze:", e);
    } finally {
      setStep3LoadingSend(false);
      setOpenJobsDialog(true);
    }
  };

  // Build a compact summary per jobId
  const jobSummaries = useMemo(() => {
    const map = new Map();
    for (const e of jobEvents) {
      const id = String(e.jobId ?? e.data?.jobId ?? "");
      if (!id) continue;
      const prev =
        map.get(id) || {
          jobId: id,
          queue: e.queue || "techstack",
          lastEvent: null,
          completed: false,
          failed: false,
          raw: [],
        };
      prev.lastEvent = e.event || e.type || "event";
      prev.queue = e.queue || prev.queue || "techstack";
      prev.raw.push(e);
      if (e.event === "completed") prev.completed = true;
      if (e.event === "failed") prev.failed = true;
      map.set(id, prev);
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.jobId).localeCompare(String(b.jobId))
    );
  }, [jobEvents]);

  // ---------------------- Hybrid job tracking (websocket + REST fallback) ----------------------
  useEffect(() => {
    if (!openJobsDialog) return;

    let cancelled = false;

    const pollJobStatuses = async () => {
      const ids = Array.from(subscribedJobIdsRef.current || []);
      if (ids.length === 0) return;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await toolReactController.getJobResult("techstack", id);
            if (!res?.ok || !res.data) return;
            const state = res.data.state;
            const eventName =
              state === "completed" || state === "failed" ? state : "update";

            const syntheticEvent = {
              event: eventName,
              queue: "techstack",
              jobId: id,
              data: res.data,
            };

            setJobEvents((prev) => [...prev, syntheticEvent]);
          } catch {
            // best-effort
          }
        })
      );
    };

    // First immediate poll, then periodic polling
    pollJobStatuses().catch(() => {});

    const interval = setInterval(() => {
      if (cancelled) return;
      pollJobStatuses().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [openJobsDialog]);

  // ---------------------- Render ----------------------
  return (
    <div className="sendtechstack-div">
      {toolStatus === "tool_off" && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>The backend tool must be running to use this feature.</Typography>
        </Alert>
      )}

      {scanLock && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>
            A scan is currently running in another component
            {scanLock.label ? `: “${scanLock.label}”` : ""}.
            <br />
            Please finish or stop the scan before proceeding.
          </Typography>
        </Alert>
      )}

      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Analyze Techstack</strong> submits a saved technology-scan snapshot to your backend.
            The backend enqueues a background job (BullMQ via Redis) and emits status events over WebSockets.
          </Typography>
        </Zoom>
      </Paper>

      <Box className="content-box">
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label} className="step-full">
              <StepLabel
                optional={index === steps.length - 1 ? <Typography variant="caption">Last step</Typography> : null}
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
                          No scans available to select.
                        </Typography>
                      </Box>
                    )}

                    {!step1LoadingList &&
                      step1ScanList.length > 0 &&
                      step1ScanList.map((value) => {
                        const labelId = `checkbox-list-label-${value.ts || value.key}`;
                        const meta = value.snap?.meta || {};
                        const when = value.ts ? formatWhen(value.ts) : "n/a";
                        const dom = meta?.url ? getDomainAccurate(meta.url) : "n/a";
                        return (
                          <ListItem key={value.key || value.ts || labelId} disablePadding divider>
                            <ListItemButton role={undefined} onClick={handleToggle(value)} dense>
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
                                primary={`Date: ${when} | TabId: ${meta?.tabId ?? "n/a"} | Domain: ${dom}`}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                  </List>
                )}

                {activeStep === 2 && step1ScanSelected && (
                  <>
                    <ScanResults results={step1ScanSelected.snap} />

                    {/* Jobs dialog (opened after sending the scan) */}
                    <Dialog open={openJobsDialog} fullWidth>
                      <DialogTitle>Job Summaries</DialogTitle>
                      <DialogContent>
                        <Typography variant="body2" className="jobsummaries-description">
                          This dialog displays background jobs processed via BullMQ and Redis.
                          Each job shows its ID and completion status.
                        </Typography>
                        {jobSummaries.length > 0 ? (
                          jobSummaries.map((job, index) => (
                            <Paper key={index} className="jobsummaries-item">
                              <div className="item-div">
                                <Brightness1Icon
                                  color={job.completed ? "success" : job.failed ? "error" : "warning"}
                                />
                                <Typography variant="body2">
                                  <strong>Queue:</strong> {job.queue}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>|</strong>
                                </Typography>
                                <Typography variant="body2">
                                  <strong>JobId:</strong> {job.jobId}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>|</strong>
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Completed:</strong> {job.completed ? "true" : "false"}
                                </Typography>
                                {job.failed && (
                                  <>
                                    <Typography variant="body2">
                                      <strong>|</strong>
                                    </Typography>
                                    <Typography variant="body2">
                                      <strong>Failed:</strong> true
                                    </Typography>
                                  </>
                                )}
                              </div>
                            </Paper>
                          ))
                        ) : (
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
                    loading={activeStep === 2 && step3LoadingSend}
                  >
                    {index === steps.length - 1 ? "Send Scan" : "Continue"}
                  </Button>
                  <Button
                    disabled={index === 0 || (activeStep === 2 && step3LoadingSend) || toolStatus === "tool_off"}
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

export default AnalyzeTechstack;
