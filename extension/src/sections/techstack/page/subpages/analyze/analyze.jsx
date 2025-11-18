import './analyze.css';
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
import { formatWhen, getDomainAccurate } from '../../../../../libs/formatting';
import toolReactController from '../../../../../toolController';
import { getLock, subscribeLockChanges } from '../../../../../scanLock';
import techStackReactController from '../../../techstackController';
import ScanResults from '../components/scanResults/scanResults';
import Brightness1Icon from '@mui/icons-material/Brightness1';
import { enqueueSnackbar } from 'notistack';

/**
 * Stepper definition: UI metadata only
 */
const steps = [
  {
    label: 'Analyze the technology stack with the ontology',
    description: `Follow the steps to submit a techstack scan to the backend.
    The backend will run a resolver that maps detected technologies to the ontology
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
 * **AnalyzeTechstack**
 *
 * Architectural Role:
 *   React UI → TechstackReactController → Background → Analyzer/Resolver Backend
 *
 * Purpose:
 *   This component guides the user through a multi-step process:
 *     1. Load local TechStack scan snapshots
 *     2. Select one snapshot to analyze
 *     3. Preview results and submit the snapshot to the backend tool
 *
 * Backend Integration:
 *   - Uses toolReactController to:
 *       • Check tool health
 *       • Poll tool status
 *       • Send scans to backend
 *       • Subscribe to BullMQ job events (via WebSocket)
 *       • Poll job results as fallback
 *
 * Scan Lock Integration:
 *   - Uses scanLock to prevent interference if another scan is running
 *
 * Responsibilities:
 *   - Multi-step vertical stepper UI
 *   - Loading, displaying and selecting TechStack snapshots from storage
 *   - Sending selected snapshot to backend resolver
 *   - Receiving job events and displaying job summaries
 *   - Managing job subscriptions (WebSocket + REST fallback)
 *
 * The component contains *no* parsing or scanning logic.
 * It only orchestrates UI + controllers + backend flow.
 */
function AnalyzeTechstack() {
  /**
   * ---------------------------------------------------------
   * Locks / Tool Status
   * ---------------------------------------------------------
   */

  // Prevent action when another scan is running
  const [scanLock, setScanLock] = useState(null);

  // "tool_on" | "tool_off" | "checking"
  const [toolStatus, setToolStatus] = useState('checking');

  /**
   * ---------------------------------------------------------
   * Stepper State
   * ---------------------------------------------------------
   */

  const [activeStep, setActiveStep] = useState(0);
  const [continueDisabled, setContinueDisabled] = useState(false);

  /**
   * Step 1 → load snapshots
   */
  const [step1LoadingList, setStep1LoadingList] = useState(false);
  const [step1ScanList, setStep1ScanList] = useState([]);
  const [step1ScanSelected, setStep1ScanSelected] = useState(null);

  /**
   * Step 3 → sending snapshot to backend
   */
  const [step3LoadingSend, setStep3LoadingSend] = useState(false);

  /**
   * Job tracking (BullMQ events)
   */
  const [jobEvents, setJobEvents] = useState([]);
  const [openJobsDialog, setOpenJobsDialog] = useState(false);

  // Track which job IDs we have subscribed to (avoid duplicate subscriptions)
  const subscribedJobIdsRef = useRef(new Set());

  /**
   * ---------------------------------------------------------
   * Scan Lock Subscription
   * ---------------------------------------------------------
   */
  useEffect(() => {
    let off = null;

    (async () => {
      // Initial lock state
      try {
        setScanLock(await getLock());
      } catch {}

      // Subscribe to lock changes
      try {
        off = subscribeLockChanges((n) => {
          setScanLock(n ?? null);
        });
      } catch {}
    })();

    return () => {
      try {
        off?.();
      } catch {}
    };
  }, []);

  /**
   * ---------------------------------------------------------
   * Tool (backend) Status and WebSocket–Job Events
   * ---------------------------------------------------------
   */

  // Compute UI status from backend health payload
  const computeStatus = (payload) =>
    payload?.ok && Object.values(payload.components ?? {}).every((c) => c === 'up')
      ? 'tool_on'
      : 'tool_off';

  useEffect(() => {
    // Start polling tool health every 5 seconds
    toolReactController.startPolling(5000);

    // Subscribe to live messages (WebSocket)
    const off = toolReactController.onMessage({
      onToolUpdate: (payload) => setToolStatus(computeStatus(payload)),
      onJobEvent: (evt) => {
        // Push any BullMQ event in chronological sequence
        setJobEvents((prev) => [...prev, evt]);
      },
    });

    // Initial health check
    toolReactController
      .getHealth()
      .then((data) => setToolStatus(computeStatus(data)))
      .catch(() => setToolStatus('tool_off'));

    return () => {
      off?.();
      toolReactController.stopPolling();
    };
  }, []);

  /**
   * ---------------------------------------------------------
   * Stepper Navigation
   * ---------------------------------------------------------
   */

  const handleNext = () => {
    switch (activeStep) {
      case 0:
        // Step 1 → load snapshots
        loadScansFromLocalStorage();
        break;

      case 2:
        // Step 3 → send scan
        sendScan();
        break;

      default:
        break;
    }

    // Advance unless last step (send)
    setActiveStep((prev) => (prev !== 2 ? prev + 1 : prev));
  };

  const handleBack = () => {
    switch (activeStep) {
      case 1:
        // Reset lists when going back from step 1
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        setStep1LoadingList(false);
        break;

      case 2:
        // Reset & reload to allow new selection
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

  /**
   * Reset full workflow (after job dialog closes)
   */
  const handleReset = () => {
    setContinueDisabled(false);
    setActiveStep(0);

    // Clear job subscriptions
    try {
      for (const id of subscribedJobIdsRef.current) {
        toolReactController.unsubscribeJob(String(id)).catch(() => {});
      }
      subscribedJobIdsRef.current.clear();
    } catch {}

    setJobEvents([]);
    setOpenJobsDialog(false);
  };

  /**
   * ---------------------------------------------------------
   * Continue Button Logic
   * ---------------------------------------------------------
   */
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

        default:
          break;
      }
    } else {
      setContinueDisabled(true);
    }
  }, [activeStep, toolStatus, scanLock, step1ScanSelected, step1ScanList, step1LoadingList]);

  /**
   * ---------------------------------------------------------
   * Step 1 — Snapshot Selection
   * ---------------------------------------------------------
   */

  const handleToggle = (value) => () => {
    setStep1ScanSelected(value);
  };

  // Normalize snapshot shapes (same as archive component)
  function normalizeSnapshot(snap) {
    if (!snap) return null;
    if (snap.meta && snap.results) return snap;
    if (snap.results && snap.results.meta && snap.results.results)
      return { meta: snap.results.meta, results: snap.results.results };
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
            (Number(String(s.key || '').replace('techstackResults_', '')) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .filter((x) => x.snap) // Remove invalid
        .sort((a, b) => (b.ts || 0) - (a.ts || 0)); // Newest first

      setStep1ScanList(normalizedLocals);
      setStep1LoadingList(false);
    } catch {
      setStep1LoadingList(false);
    }
  };

  /**
   * ---------------------------------------------------------
   * Step 3 — Send Scan to Backend
   * ---------------------------------------------------------
   */

  // Subscribe a jobId only once
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
      const res = await toolReactController.analyzeTechstack(step1ScanSelected.snap.results);

      if (res?.accepted) {
        enqueueSnackbar('Scan accepted by backend. Waiting for results from the worker...', {
          variant: 'success',
        });

        if (res.jobId) {
          await subscribeJob(res.jobId);
        }
      } else {
        enqueueSnackbar(res?.error || 'The backend did not accept the scan.', {
          variant: 'warning',
        });
      }
    } catch (e) {
      enqueueSnackbar('Error while sending the scan.', {
        variant: 'error',
      });
    } finally {
      setStep3LoadingSend(false);
      setOpenJobsDialog(true);
    }
  };

  /**
   * ---------------------------------------------------------
   * Job Summaries (Build from Events)
   * ---------------------------------------------------------
   */

  const jobSummaries = useMemo(() => {
    const map = new Map();

    for (const e of jobEvents) {
      const id = String(e.jobId ?? e.data?.jobId ?? '');
      if (!id) continue;

      const prev = map.get(id) || {
        jobId: id,
        queue: e.queue || 'techstack',
        lastEvent: null,
        completed: false,
        failed: false,
        raw: [],
      };

      prev.lastEvent = e.event || e.type || 'event';
      prev.queue = e.queue || prev.queue;

      prev.raw.push(e);

      if (e.event === 'completed') prev.completed = true;
      if (e.event === 'failed') prev.failed = true;

      map.set(id, prev);
    }

    return Array.from(map.values()).sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)));
  }, [jobEvents]);

  /**
   * ---------------------------------------------------------
   * REST Fallback: Poll Job Statuses When Dialog Is Open
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!openJobsDialog) return;

    let cancelled = false;

    const pollJobStatuses = async () => {
      const ids = Array.from(subscribedJobIdsRef.current || []);
      if (ids.length === 0) return;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await toolReactController.getJobResult('techstack', id);
            if (!res?.ok || !res.data) return;

            const state = res.data.state;
            const eventName = state === 'completed' || state === 'failed' ? state : 'update';

            const syntheticEvent = {
              event: eventName,
              queue: 'techstack',
              jobId: id,
              data: res.data,
            };

            setJobEvents((prev) => [...prev, syntheticEvent]);
          } catch {}
        })
      );
    };

    // Immediate poll + periodic poll
    pollJobStatuses().catch(() => {});
    const interval = setInterval(() => {
      if (!cancelled) pollJobStatuses().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [openJobsDialog]);

  /**
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */
  return (
    <div className="sendtechstack-div">
      {/* ---------------- Tool Offline Warning ---------------- */}
      {toolStatus === 'tool_off' && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>The backend tool must be running to use this feature.</Typography>
        </Alert>
      )}

      {/* ---------------- Scan Lock Warning ---------------- */}
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

      {/* ---------------- Description ---------------- */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Analyze Techstack</strong> submits a saved technology-scan snapshot to your
            backend. The backend enqueues a background job (BullMQ via Redis) and emits status
            events over WebSockets.
          </Typography>
        </Zoom>
      </Paper>

      {/* ---------------- Stepper ---------------- */}
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

                {/** ---------------- Step 1 — List saved snapshots ---------------- */}
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
                        const when = value.ts ? formatWhen(value.ts) : 'n/a';
                        const dom = meta?.url ? getDomainAccurate(meta.url) : 'n/a';

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
                                primary={`Date: ${when} | TabId: ${
                                  meta?.tabId ?? 'n/a'
                                } | Domain: ${dom}`}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                  </List>
                )}

                {/** ---------------- Step 2 → Preview and Jobs Dialog ---------------- */}
                {activeStep === 2 && step1ScanSelected && (
                  <>
                    <ScanResults results={step1ScanSelected.snap} />

                    {/* ---------------- Job Summaries Dialog ---------------- */}
                    <Dialog open={openJobsDialog} fullWidth>
                      <DialogTitle>Job Summaries</DialogTitle>

                      <DialogContent>
                        <Typography variant="body2" className="jobsummaries-description">
                          This dialog displays background jobs processed via BullMQ and Redis. Each
                          job shows its ID and its completion status.
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

                {/** ---------------- Navigation Buttons ---------------- */}
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

export default AnalyzeTechstack;
