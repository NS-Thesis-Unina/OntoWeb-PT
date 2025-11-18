import './oneTimeScan.css';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
  Zoom,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { formatWhen, getDomainAccurate } from '../../../../../../../libs/formatting';
import { getLock, subscribeLockChanges } from '../../../../../../../scanLock';
import Brightness1Icon from '@mui/icons-material/Brightness1';
import { enqueueSnackbar } from 'notistack';
import toolReactController from '../../../../../../../toolController';
import analyzerReactController from '../../../../../analyzerController';
import OneTimeScanResults from '../../../components/oneTimeScanResults/oneTimeScanResults';

/* ========================================================================== */
/* Wizard Step Definition                                                     */
/* ========================================================================== */

const steps = [
  {
    label: 'Analyze the HTML elements and scripts with the ontology',
    description: `Follow the steps to submit an analyzer one-time scan to the backend.
    The backend will run a resolver that maps detected HTML elements and scripts to the ontology
    and attempts to identify potential vulnerabilities.`,
  },
  {
    label: 'Select a scan',
    description: `From the scans saved in local storage, choose the one you want to use
    as the source for the analysis.`,
  },
  {
    label: 'Review the scan and submit to the tool',
    description: `Preview the selected scan, verify its details, and then submit it to the tool
    to start the ontology-based analysis and vulnerability detection.`,
  },
];

/**
 * **SendOneTimeScanAnalyzer**
 *
 * Architectural Role:
 *   Analyzer → Analyze → One-Time Scan → Submission Wizard
 *
 * Purpose:
 *   Guides the user through a 3-step wizard to:
 *     1. Load previously saved One-Time scan snapshots from local storage
 *     2. Select a specific scan to analyze with the ontology backend
 *     3. Review the snapshot and send it to the backend analyzer
 *
 * Backend Flow:
 *   • Submission triggers a BullMQ background job in the “analyzer” queue
 *   • Job updates are received via WebSockets   (onJobEvent)
 *   • A REST fallback periodically polls job states if WS events are missed
 *
 * Responsibilities:
 *   • Check backend tool health (polling + socket)
 *   • Enforce global scan lock (other components may be running scans)
 *   • Load and normalize local one-time snapshots
 *   • Manage step navigation and UI state
 *   • Display a final dialog summarizing queued/completed jobs
 *
 * UX Notes:
 *   • Step 1 loads local scans
 *   • Step 2 previews selected scan
 *   • Step 3 sends the scan and shows job summaries
 *   • "Continue" is dynamically disabled based on tool availability/lock state
 */
function SendOneTimeScanAnalyzer() {
  /* ------------------------------------------------------------------------ */
  /* Global scan-lock (prevents conflicting scans across components)          */
  /* ------------------------------------------------------------------------ */
  const [scanLock, setScanLock] = useState(null);

  /* Tool backend health status */
  const [toolStatus, setToolStatus] = useState('checking');

  /* Wizard internal state */
  const [activeStep, setActiveStep] = useState(0);
  const [continueDisabled, setContinueDisabled] = useState(false);

  /* Step 1 — Load scans */
  const [step1LoadingList, setStep1LoadingList] = useState(false);
  const [step1ScanList, setStep1ScanList] = useState([]);
  const [step1ScanSelected, setStep1ScanSelected] = useState(null);

  /* Step 3 — Send scan */
  const [step3LoadingSend, setStep3LoadingSend] = useState(false);

  /* Background job tracking (WS + REST fallback) */
  const [jobEvents, setJobEvents] = useState([]);
  const [openJobsDialog, setOpenJobsDialog] = useState(false);
  const subscribedJobIdsRef = useRef(new Set());

  /* ======================================================================== */
  /* Scan Lock — listen for global scan activity                              */
  /* ======================================================================== */

  useEffect(() => {
    let off = null;

    (async () => {
      /* Initial lock read */
      try {
        const current = await getLock();
        setScanLock(current);
      } catch {}

      /* Subscribe to lock changes */
      try {
        off = subscribeLockChanges((newVal) => {
          setScanLock(newVal ?? null);
        });
      } catch {}
    })();

    return () => {
      try {
        off?.();
      } catch {}
    };
  }, []);

  /* ======================================================================== */
  /* Tool Backend — health status + websocket events                          */
  /* ======================================================================== */

  // Evaluate backend availability
  const computeStatus = (payload) =>
    payload?.ok && Object.values(payload.components ?? {}).every((c) => c === 'up')
      ? 'tool_on'
      : 'tool_off';

  useEffect(() => {
    toolReactController.startPolling(5000);

    /* Subscribe to WebSocket messages */
    const off = toolReactController.onMessage({
      onToolUpdate: (payload) => setToolStatus(computeStatus(payload)),

      onJobEvent: (evt) => {
        // Collect all job events from BullMQ
        setJobEvents((prev) => [...prev, evt]);
      },
    });

    /* Initial health check */
    toolReactController
      .getHealth()
      .then((data) => setToolStatus(computeStatus(data)))
      .catch(() => setToolStatus('tool_off'));

    return () => {
      off?.();
      toolReactController.stopPolling();
    };
  }, []);

  /* ======================================================================== */
  /* Stepper Navigation                                                       */
  /* ======================================================================== */

  const handleNext = () => {
    switch (activeStep) {
      case 0:
        loadScansFromLocalStorage();
        break;
      case 2:
        sendScan();
        break;
      default:
        break;
    }

    setActiveStep((prev) => {
      if (prev !== 2) return prev + 1;
      return prev; // final step → stay here
    });
  };

  const handleBack = () => {
    switch (activeStep) {
      case 1:
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        setStep1LoadingList(false);
        break;

      case 2:
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        setStep1LoadingList(false);
        loadScansFromLocalStorage();
        break;

      default:
        break;
    }

    setActiveStep((prev) => prev - 1);
  };

  /* Reset wizard and unsubscribe jobs */
  const handleReset = () => {
    setContinueDisabled(false);
    setActiveStep(0);

    try {
      for (const id of subscribedJobIdsRef.current) {
        toolReactController.unsubscribeJob(String(id)).catch(() => {});
      }
      subscribedJobIdsRef.current.clear();
    } catch {}

    setJobEvents([]);
    setOpenJobsDialog(false);
  };

  /* ======================================================================== */
  /* Continue button enable/disable logic                                     */
  /* ======================================================================== */

  useEffect(() => {
    if (toolStatus === 'tool_on' && !scanLock) {
      switch (activeStep) {
        case 0:
          setContinueDisabled(false);
          break;

        case 1:
          setContinueDisabled(
            !(step1ScanSelected && step1ScanList.length > 0 && !step1LoadingList)
          );
          break;

        // step 2 is handled during submission
      }
    } else {
      setContinueDisabled(true);
    }
  }, [activeStep, toolStatus, scanLock, step1ScanSelected, step1ScanList, step1LoadingList]);

  /* ======================================================================== */
  /* Step 1 — Load One-Time Scans from local storage                          */
  /* ======================================================================== */

  const handleToggle = (value) => () => {
    setStep1ScanSelected(value);
  };

  // Normalize older formats to { meta, results }
  function normalizeSnapshot(snap) {
    if (!snap) return null;
    if (snap.meta && snap.results) return snap;
    if (snap.results?.meta && snap.results?.results) {
      return {
        meta: snap.results.meta,
        results: snap.results.results,
      };
    }
    if (snap.results) return { meta: snap.meta || {}, results: snap.results };
    return null;
  }

  const loadScansFromLocalStorage = async () => {
    setStep1LoadingList(true);
    try {
      const locals = await analyzerReactController.getLocalScanResults();

      const normalized = (Array.isArray(locals) ? locals : [])
        .map((s) => {
          const norm = normalizeSnapshot(s.results || s);
          const ts =
            norm?.meta?.timestamp ??
            (Number(String(s.key || '').replace('analyzerResults_', '')) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .filter((x) => x.snap)
        .sort((a, b) => b.ts - a.ts);

      setStep1ScanList(normalized);
    } catch (e) {
      console.log('Error loading scans:', e);
    }

    setStep1LoadingList(false);
  };

  /* ======================================================================== */
  /* Step 3 — Submit Scan to Backend                                          */
  /* ======================================================================== */

  // Subscribe to BullMQ job
  const subscribeJob = useCallback(async (jobId) => {
    const id = String(jobId || '');
    if (!id || subscribedJobIdsRef.current.has(id)) return;

    subscribedJobIdsRef.current.add(id);

    try {
      const r = await toolReactController.subscribeJob(id);
      if (!r?.ok) console.warn('subscribeJob failed', r);
    } catch (e) {
      console.warn('subscribeJob error', e);
    }
  }, []);

  const sendScan = async () => {
    if (!step1ScanSelected?.snap) return;

    setStep3LoadingSend(true);
    try {
      const { meta, results, html } = step1ScanSelected.snap;

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
        enqueueSnackbar('Scan accepted by backend. Waiting for results...', { variant: 'success' });
        if (res?.jobId) await subscribeJob(res.jobId);
      } else {
        enqueueSnackbar(res?.error || 'Backend did not accept the scan.', { variant: 'warning' });
      }
    } catch (e) {
      enqueueSnackbar('Error sending the scan.', {
        variant: 'error',
      });
      console.log('Error sending scan:', e);
    } finally {
      setStep3LoadingSend(false);
      setOpenJobsDialog(true);
    }
  };

  /* ======================================================================== */
  /* Job Summary — aggregate events by jobId                                  */
  /* ======================================================================== */

  const jobSummaries = useMemo(() => {
    const map = new Map();

    for (const e of jobEvents) {
      const id = String(e.jobId ?? e.data?.jobId ?? '');
      if (!id) continue;

      const summary = map.get(id) || {
        jobId: id,
        queue: e.queue || 'analyzer',
        lastEvent: null,
        completed: false,
        failed: false,
        raw: [],
      };

      summary.lastEvent = e.event || e.type || 'event';
      summary.queue = e.queue || summary.queue;
      summary.raw.push(e);

      if (e.event === 'completed') summary.completed = true;
      if (e.event === 'failed') summary.failed = true;

      map.set(id, summary);
    }

    return [...map.values()].sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)));
  }, [jobEvents]);

  /* ======================================================================== */
  /* Hybrid Job Tracking: WS + REST Polling                                   */
  /* ======================================================================== */

  useEffect(() => {
    if (!openJobsDialog) return;

    let cancelled = false;

    const pollJobStatuses = async () => {
      const ids = [...(subscribedJobIdsRef.current || [])];
      if (ids.length === 0) return;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await toolReactController.getJobResult('analyzer', id);
            if (!res?.ok || !res.data) return;

            const state = res.data.state;
            const eventName = state === 'completed' || state === 'failed' ? state : 'update';

            const evt = {
              event: eventName,
              queue: 'analyzer',
              jobId: id,
              data: res.data,
            };

            setJobEvents((prev) => [...prev, evt]);

            if (state === 'completed' || state === 'failed') {
              subscribedJobIdsRef.current.delete(id);
            }
          } catch {}
        })
      );
    };

    pollJobStatuses().catch(() => {});

    const interval = setInterval(() => {
      if (!cancelled) pollJobStatuses().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [openJobsDialog]);

  /* ======================================================================== */
  /* Render                                                                   */
  /* ======================================================================== */

  return (
    <div className="sendanalyzerots-div">
      {/* ------------------------------------------------------------- */}
      {/* Warning: backend tool offline                                */}
      {/* ------------------------------------------------------------- */}
      {toolStatus === 'tool_off' && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>The backend tool must be running to use this feature.</Typography>
        </Alert>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Warning: global scan lock active                              */}
      {/* ------------------------------------------------------------- */}
      {scanLock && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>
            A scan is currently running in another component
            {scanLock.label ? `: “${scanLock.label}”` : ''}.
            <br />
            Please finish or stop the scan before proceeding.
          </Typography>
        </Alert>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Intro description                                             */}
      {/* ------------------------------------------------------------- */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Analyzer One-Time Scan</strong> submits a saved analyzer snapshot (HTML,
            scripts, forms, iframes) to your backend. The backend enqueues a background job (BullMQ
            + Redis) and emits status events via WebSockets.
          </Typography>
        </Zoom>
      </Paper>

      {/* ------------------------------------------------------------- */}
      {/* Stepper UI                                                    */}
      {/* ------------------------------------------------------------- */}
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

                {/* ------------------------------------------------- */}
                {/* Step 1: Scan selection                           */}
                {/* ------------------------------------------------- */}
                {activeStep === 1 && (
                  <List className="full-list">
                    {/* Loading state */}
                    {step1LoadingList && (
                      <Box className="centered-loading">
                        <CircularProgress />
                      </Box>
                    )}

                    {/* No scans found */}
                    {!step1LoadingList && step1ScanList.length === 0 && (
                      <Box className="empty-box">
                        <Typography variant="body2" color="text.secondary" align="center">
                          No scans available to select.
                        </Typography>
                      </Box>
                    )}

                    {/* Scan list */}
                    {!step1LoadingList &&
                      step1ScanList.length > 0 &&
                      step1ScanList.map((value) => {
                        const labelId = `scan-${value.key || value.ts}`;
                        const meta = value.snap?.meta || {};

                        return (
                          <ListItem key={value.key || value.ts || labelId} disablePadding divider>
                            <ListItemButton role={undefined} onClick={handleToggle(value)} dense>
                              <ListItemIcon>
                                <Checkbox
                                  edge="start"
                                  checked={step1ScanSelected === value}
                                  disableRipple
                                />
                              </ListItemIcon>

                              <ListItemText
                                id={labelId}
                                primary={`Date: ${formatWhen(value.ts)} | TabId: ${
                                  meta.tabId ?? 'n/a'
                                } | Domain: ${meta.url ? getDomainAccurate(meta.url) : 'n/a'}`}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                  </List>
                )}

                {/* ------------------------------------------------- */}
                {/* Step 2: Preview + Job Dialog                    */}
                {/* ------------------------------------------------- */}
                {activeStep === 2 && step1ScanSelected && (
                  <>
                    <OneTimeScanResults results={step1ScanSelected.snap} />

                    {/* Job Summary Dialog */}
                    <Dialog open={openJobsDialog} fullWidth>
                      <DialogTitle>Job Summaries</DialogTitle>
                      <DialogContent>
                        <Typography variant="body2" className="jobsummaries-description">
                          This dialog displays background jobs processed via BullMQ and Redis. Each
                          job shows its ID and completion status.
                        </Typography>

                        {jobSummaries.length > 0 ? (
                          jobSummaries.map((job, index) => (
                            <Paper key={index} className="jobsummaries-item">
                              <div className="item-div">
                                <Brightness1Icon
                                  color={
                                    job.completed ? 'success' : job.failed ? 'error' : 'warning'
                                  }
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
                                  <strong>Completed:</strong> {job.completed ? 'true' : 'false'}
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

                {/* ------------------------------------------------- */}
                {/* Navigation Buttons                                */}
                {/* ------------------------------------------------- */}
                <Box className="actions">
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    className="btn"
                    disabled={continueDisabled}
                    loading={activeStep === 2 && step3LoadingSend}
                  >
                    {index === steps.length - 1 ? 'Send Scan' : 'Continue'}
                  </Button>

                  <Button
                    disabled={
                      index === 0 ||
                      (activeStep === 2 && step3LoadingSend) ||
                      toolStatus === 'tool_off'
                    }
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

export default SendOneTimeScanAnalyzer;
