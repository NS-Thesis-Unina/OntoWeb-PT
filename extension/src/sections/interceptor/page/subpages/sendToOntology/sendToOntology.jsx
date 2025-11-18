import './sendToOntology.css';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import browser from 'webextension-polyfill';

import interceptorReactController from '../../../interceptorController';
import { formatWhen, prettyBytes } from '../../../../../libs/formatting';

import DataGridSelectableInterceptor from '../components/dataGridSelectableInterceptor/dataGridSelectableInterceptor';
import { makeBatchPayloads } from './makeBatchPayloads';

import toolReactController from '../../../../../toolController';
import { getLock, subscribeLockChanges } from '../../../../../scanLock';

import { enqueueSnackbar } from 'notistack';
import Brightness1Icon from '@mui/icons-material/Brightness1';

/* ========================================================================
 * Stepper configuration (UI text only)
 * ======================================================================== */
const steps = [
  {
    label: 'Send requests to the ontology',
    description: `Follow the steps below to submit requests to the ontology. 
    Choose a saved scan, pick a website from that scan, select the requests 
    you want, and then confirm to send them.`,
  },
  {
    label: 'Choose a scan',
    description: `From all scans saved in local storage, select the scan you want to 
      use as the source of requests.`,
  },
  {
    label: 'Choose a website',
    description: `From the selected scan, choose the crawled website whose 
    requests you want to submit to the ontology.`,
  },
  {
    label: 'Select requests',
    description: `From the data grid, select the specific HTTP requests you 
    want to include. If you also want to run a vulnerability check, enable the 
    resolver option.`,
  },
  {
    label: 'Confirm and send',
    description: `Review your selection and confirm. If the resolver is enabled, 
    the system will attempt to detect potential vulnerabilities before inserting 
    the requests into GraphDB.`,
  },
];

/**
 * **SendToOntologyInterceptor**
 *
 * Architectural Role:
 *   Interceptor → Ontology Integration UI → SendToOntologyInterceptor (this component)
 *
 * Purpose:
 *   Provides a multi-step workflow to extract HTTP requests from stored Interceptor scans
 *   and send them to the Ontology backend (GraphDB), optionally passing through the
 *   resolver engine for vulnerability detection.
 *
 * Responsibilities:
 *   - Fetch and show all available stored scans (runtime capture sessions)
 *   - Let users select:
 *        1. A scan
 *        2. A website/page within that scan
 *        3. Specific requests inside that website
 *        4. Whether to enable the resolver
 *   - Prepare batch payloads for ingestion using `makeBatchPayloads`
 *   - Trigger ingestion via the Tool Controller backend
 *   - Track background jobs (BullMQ + Redis) both via websocket events and REST polling
 *   - Provide UI feedback for submission progress and job completion state
 *
 * Interactions:
 *   - interceptorReactController (to access stored scans)
 *   - toolReactController:
 *        → health checks
 *        → ingestHttp
 *        → subscribeJob / unsubscribeJob
 *        → getJobResult
 *        → websocket-based job event listener
 *   - browser.storage.local → fetching stored scan datasets
 *   - scanLock system → Ensures that no other scanning component is active
 *   - DataGridSelectableInterceptor → request selection UI
 *
 * Important Notes:
 *   - This is one of the most orchestrated components: it mixes background polling,
 *     websocket events, async local storage reads, multi-step UX, lock checking,
 *     job lifecycle listening, and batch ingestion.
 *   - The resolver (optional) spawns additional job events. Jobs may emit both
 *     websocket-based incremental events AND require fallback REST polling.
 *   - UI must stay robust even if some job event sources fail or arrive late.
 */
function SendToOntologyInterceptor() {
  /* --------------------------------------------------------------------
   * LOCK STATE
   * Prevents concurrent scan or ontology operations when Interceptor
   * Runtime or Analyzer is running.
   * -------------------------------------------------------------------- */
  const [scanLock, setScanLock] = useState(null);

  /* --------------------------------------------------------------------
   * TOOL STATUS
   * Backend tool (GraphDB integration + resolver engine) may be offline.
   * We poll and listen for websocket updates.
   * -------------------------------------------------------------------- */
  const [toolStatus, setToolStatus] = useState('checking');

  /* --------------------------------------------------------------------
   * STEPPER STATE
   * Controls whole UX flow from step 0 → 4
   * -------------------------------------------------------------------- */
  const [activeStep, setActiveStep] = useState(0);
  const [continueDisabled, setContinueDisabled] = useState(false);

  /* --------------------------------------------------------------------
   * STEP 1 — Scan selection
   * -------------------------------------------------------------------- */
  const [step1ScanSelected, setStep1ScanSelected] = useState(null);
  const [step1ScanList, setStep1ScanList] = useState([]);
  const [step1LoadingList, setStep1LoadingList] = useState(true);

  /* --------------------------------------------------------------------
   * STEP 2 — Website selection (page domain inside scan)
   * -------------------------------------------------------------------- */
  const [step2WebSiteList, setStep2WebSiteList] = useState([]);
  const [step2WebSiteSelected, setStep2WebSiteSelected] = useState(null);
  const [step2LoadingList, setStep2LoadingList] = useState(true);

  /* --------------------------------------------------------------------
   * STEP 3 — Request selection
   * -------------------------------------------------------------------- */
  const [step3RequestsSelected, setStep3RequestsSelected] = useState([]);

  /* --------------------------------------------------------------------
   * STEP 4 — Confirmation & sending
   * -------------------------------------------------------------------- */
  const [step4ConfirmRequestsSelected, setStep4ConfirmRequestsSelected] = useState([]);
  const [step4ActivateResolver, setStep4ActivateResolver] = useState(false);
  const [step4LoadingSendRequests, setStep4LoadingSendRequests] = useState(false);

  /* --------------------------------------------------------------------
   * JOB TRACKING
   * Tracks BullMQ job events emitted via websocket and polling fallback.
   * -------------------------------------------------------------------- */
  const [step4JobEvents, setStep4JobEvents] = useState([]);

  /** Stores job IDs already subscribed via websocket to avoid duplicates. */
  const subscribedJobIdsRef = useRef(new Set());

  /** Controls visibility of Job Summaries dialog. */
  const [openJobsDialog, setOpenJobsDialog] = useState(false);

  /* ========================================================================
   * GLOBAL SCAN LOCK LISTENER
   * ======================================================================== */
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

  /* ========================================================================
   * TOOL STATUS LISTENER (health check + websocket)
   * ======================================================================== */

  /** Calculate tool status from health payload */
  const computeStatus = (payload) =>
    payload?.ok && Object.values(payload.components ?? {}).every((c) => c === 'up')
      ? 'tool_on'
      : 'tool_off';

  useEffect(() => {
    toolReactController.startPolling(5000);

    // Subscribe to tool websocket events
    const off = toolReactController.onMessage({
      onToolUpdate: (payload) => setToolStatus(computeStatus(payload)),

      // Every job event is appended into event buffer
      onJobEvent: (evt) => {
        setStep4JobEvents((prev) => [...prev, evt]);
      },
    });

    // Initial health check via REST
    toolReactController
      .getHealth()
      .then((data) => setToolStatus(computeStatus(data)))
      .catch(() => setToolStatus('tool_off'));

    return () => {
      off?.();
      toolReactController.stopPolling();
    };
  }, []);

  /* ========================================================================
   * STEPPER NAVIGATION HANDLERS
   * ======================================================================== */

  const handleNext = () => {
    switch (activeStep) {
      case 0:
        loadScansFromLocalStorage();
        break;
      case 1:
        renderWebSiteList();
        break;
      case 4:
        sendRequests();
        break;
    }

    setActiveStep((prev) => (prev !== 4 ? prev + 1 : prev));
  };

  const handleBack = () => {
    switch (activeStep) {
      case 1:
        setStep1ScanList([]);
        setStep1ScanSelected(null);
        break;

      case 2:
        setStep2WebSiteList([]);
        setStep2WebSiteSelected(null);
        break;

      case 3:
        setStep3RequestsSelected([]);
        break;

      case 4:
        // Reset job tracking
        setStep3RequestsSelected([]);
        setStep4ConfirmRequestsSelected([]);
        setStep4JobEvents([]);

        try {
          for (const id of subscribedJobIdsRef.current) {
            toolReactController.unsubscribeJob(String(id)).catch(() => {});
          }
          subscribedJobIdsRef.current.clear();
        } catch {}
        break;
    }

    setActiveStep((prev) => prev - 1);
  };

  /** Reset whole wizard (after job dialog OK) */
  const handleReset = () => {
    setStep1ScanList([]);
    setStep1ScanSelected(null);
    setStep2WebSiteList([]);
    setStep2WebSiteSelected(null);
    setStep3RequestsSelected([]);
    setStep4ConfirmRequestsSelected([]);
    setStep4ActivateResolver(false);
    setContinueDisabled(false);
    setStep4JobEvents([]);

    try {
      for (const id of subscribedJobIdsRef.current) {
        toolReactController.unsubscribeJob(String(id)).catch(() => {});
      }
      subscribedJobIdsRef.current.clear();
    } catch {}

    setOpenJobsDialog(false);
    setActiveStep(0);
  };

  /* ========================================================================
   * AUTO-DISABLE LOGIC PER STEP
   * Determines whether Stepper "Continue" button is disabled.
   * ======================================================================== */
  useEffect(() => {
    if (toolStatus === 'tool_on' && !scanLock) {
      switch (activeStep) {
        case 0:
          setContinueDisabled(false);
          break;

        case 1:
          setContinueDisabled(step1LoadingList || !step1ScanSelected || step1ScanList.length === 0);
          break;

        case 2:
          setContinueDisabled(
            step2LoadingList || !step2WebSiteSelected || step2WebSiteList.length === 0
          );
          break;

        case 3:
          setContinueDisabled(step3RequestsSelected.length === 0);
          break;

        case 4:
          setContinueDisabled(
            step4ConfirmRequestsSelected.length === 0 || step4LoadingSendRequests
          );
          break;
      }
    } else {
      setContinueDisabled(true);
    }
  }, [
    activeStep,
    step1ScanSelected,
    step2WebSiteSelected,
    step3RequestsSelected,
    step4ConfirmRequestsSelected,
    step1LoadingList,
    step2LoadingList,
    step4LoadingSendRequests,
    toolStatus,
    scanLock,
  ]);

  /* ========================================================================
   * STEP 1 — SCAN LIST
   * ======================================================================== */

  const handleToggle = (value) => () => {
    setStep1ScanSelected(value);
  };

  function hasValidMeta(meta) {
    return (
      meta &&
      typeof meta === 'object' &&
      Number.isFinite(meta.startedAt) &&
      Number.isFinite(meta.stoppedAt) &&
      Number.isFinite(meta.totalEvents) &&
      Number.isFinite(meta.pagesCount) &&
      Number.isFinite(meta.totalBytes)
    );
  }

  /**
   * Loads all stored scans from local storage and filters by validity.
   * Then loads each scan's full data for display.
   */
  const loadScansFromLocalStorage = useCallback(async () => {
    setStep1LoadingList(true);
    try {
      const res = await interceptorReactController.listRuns();
      const list = Array.isArray(res?.runs) ? res.runs : [];

      // Filter out sentinel + malformed entries
      const cleaned = list.filter(
        (item) =>
          item &&
          typeof item.key === 'string' &&
          item.key !== 'interceptorRun_lastKey' &&
          item.key.startsWith('interceptorRun_') &&
          hasValidMeta(item.meta)
      );

      // Load each run's content from storage
      const runsKeys = cleaned.map((v) => v.key);
      await Promise.all(runsKeys.map((key) => loadScanContentFromLocalStorage(key)));

      setStep1LoadingList(false);
    } catch (e) {
      console.log(e?.message || 'Error loading runs from storage.');
      setStep1LoadingList(false);
    }
  }, []);

  /**
   * Load a single scan dataset from local storage.
   */
  const loadScanContentFromLocalStorage = async (keyId) => {
    try {
      const all = await browser.storage.local.get(keyId);
      const r = all?.[keyId] || null;

      if (!r) {
        console.log('Run not found in storage.');
      } else {
        setStep1ScanList((prev) => [...prev, r]);
      }
    } catch (e) {
      console.log(e?.message || 'Error reading run from storage.');
    }
  };

  /* ========================================================================
   * STEP 2 — WEBSITE SELECTION
   * ======================================================================== */

  const handleToggleWebSite = (value) => () => {
    setStep2WebSiteSelected(value);
  };

  /** Extracts page → events list from selected scan */
  const renderWebSiteList = () => {
    setStep2WebSiteList(Object.entries(step1ScanSelected.dataset));
    setStep2LoadingList(false);
  };

  /* ========================================================================
   * STEP 4 — CONFIRMATION & RESOLVER OPTION
   * ======================================================================== */

  const onChangeActivateResolver = () => {
    setStep4ActivateResolver(!step4ActivateResolver);
  };

  /* ========================================================================
   * JOB SUBSCRIPTION HANDLING
   * Prevents double-subscription for the same jobId.
   * ======================================================================== */
  const subscribeJob = useCallback(async (jobId) => {
    const id = String(jobId);
    if (subscribedJobIdsRef.current.has(id)) return;

    subscribedJobIdsRef.current.add(id);
    try {
      const r = await toolReactController.subscribeJob(id);
      if (!r?.ok) console.warn('subscribeJob failed', r);
    } catch (e) {
      console.warn('subscribeJob error', e);
    }
  }, []);

  /* ========================================================================
   * SEND REQUESTS
   * Handles the main ingestion flow:
   *   - prepare payloads
   *   - call ingestHttp in parallel
   *   - collect jobIds for websocket/polling
   *   - notify user
   * ======================================================================== */
  const sendRequests = async () => {
    setStep4LoadingSendRequests(true);
    try {
      const payloads = makeBatchPayloads(
        step4ConfirmRequestsSelected,
        { graph: 'http://example.com/graphs/http-requests' },
        { maxBytes: 2 * 1024 * 1024, safetyMargin: 600 * 1024 }
      );

      let ok = 0;
      let total = 0;

      const results = await Promise.all(
        payloads.map(async (item) => {
          try {
            const res = await toolReactController.ingestHttp({
              ...item,
              activateResolver: step4ActivateResolver,
            });

            // Subscribe both ingestion and resolver jobs
            if (res?.resRequest?.accepted && res?.resRequest?.jobId)
              subscribeJob(res.resRequest.jobId);

            if (res?.resResolver?.accepted && res?.resResolver?.jobId)
              subscribeJob(res.resResolver.jobId);

            return res;
          } catch (e) {
            enqueueSnackbar('Error while sending the request (check the console for details).', {
              variant: 'error',
            });
            console.log('Error while sending the request:', e);
            return { accepted: false, error: String(e?.message || e) };
          }
        })
      );

      // Count accepted jobs
      ok = results.filter((r) => r?.resRequest?.accepted).length;
      total = results.length;

      if (step4ActivateResolver) {
        ok += results.filter((r) => r?.resResolver?.accepted).length;
        total += results.length;
      }

      enqueueSnackbar(
        `Requests accepted by the backend: ${ok}/${total}. Waiting for results from the worker...`,
        { variant: ok > 0 ? 'success' : 'warning' }
      );
    } finally {
      setStep4LoadingSendRequests(false);
      setOpenJobsDialog(true);
    }
  };

  /* ========================================================================
   * JOB SUMMARIES
   * Merges all raw events by jobId → produce compact summaries.
   * ======================================================================== */
  const jobSummaries = useMemo(() => {
    const map = new Map();

    for (const e of step4JobEvents) {
      const id = String(e.jobId ?? e.data?.jobId ?? '');
      if (!id) continue;

      const prev = map.get(id) || {
        jobId: id,
        queue: e.queue || 'http',
        lastEvent: null,
        completed: false,
        failed: false,
        raw: [],
      };

      prev.lastEvent = e.event || e.type || 'event';
      prev.queue = e.queue || prev.queue || 'http';
      prev.raw.push(e);

      if (e.event === 'completed') prev.completed = true;
      if (e.event === 'failed') prev.failed = true;

      map.set(id, prev);
    }

    return Array.from(map.values()).sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)));
  }, [step4JobEvents]);

  /* ========================================================================
   * HYBRID JOB TRACKING (WEBSOCKET + PERIODIC REST POLLING)
   * Polling is only active while Job Summary dialog is open.
   * ======================================================================== */
  useEffect(() => {
    if (!openJobsDialog) return;

    let cancelled = false;

    const pollJobStatuses = async () => {
      const ids = Array.from(subscribedJobIdsRef.current);
      if (ids.length === 0) return;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await toolReactController.getJobResult('http', id);
            if (!res?.ok || !res.data) return;

            const state = res.data.state;
            const eventName = state === 'completed' || state === 'failed' ? state : 'update';

            const syntheticEvent = {
              event: eventName,
              queue: 'http',
              jobId: id,
              data: res.data,
            };

            setStep4JobEvents((prev) => [...prev, syntheticEvent]);

            if (state === 'completed' || state === 'failed') {
              subscribedJobIdsRef.current.delete(id);
            }
          } catch {
            /* best-effort */
          }
        })
      );

      if (subscribedJobIdsRef.current.size === 0) {
        cancelled = true;
        clearInterval(interval);
        return;
      }
    };

    // Initial immediate poll
    pollJobStatuses().catch(() => {});

    // Periodic polling every 3 seconds
    const interval = setInterval(() => {
      if (!cancelled) pollJobStatuses().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [openJobsDialog]);

  /* ========================================================================
   * RENDER
   * ======================================================================== */
  return (
    <div className="sendinterceptor-div">
      {/* Backend tool offline alert */}
      {toolStatus === 'tool_off' && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>The backend tool must be running to use this feature.</Typography>
        </Alert>
      )}

      {/* Lock alert (runtime scan still running) */}
      {scanLock && (
        <Alert variant="filled" severity="warning" className="alert-block">
          <Typography>
            A scan is currently running in another component:
            {scanLock.label ? `: “${scanLock.label}”` : ''}.
            <br />
            Please finish or stop the scan before proceeding.
          </Typography>
        </Alert>
      )}

      {/* Intro description */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Send to ontology</strong> lets you persist selected HTTP requests from your
            saved scans into GraphDB (the ontology). You can also enable the resolver to perform a
            basic, best-effort detection of potential vulnerabilities on the selected requests
            before they are stored.
          </Typography>
        </Zoom>
      </Paper>

      {/* ========================= STEPPER ========================= */}
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

                {/* ------------------------------------------------------------------
                 * STEP 1 — Scan Selection
                 * ------------------------------------------------------------------ */}
                {activeStep === 1 && (
                  <List className="full-list">
                    {/* Loading spinner */}
                    {step1LoadingList && (
                      <Box className="centered-loading">
                        <CircularProgress />
                      </Box>
                    )}

                    {/* No scans */}
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
                        const labelId = `checkbox-list-label-${value.startedAt}`;
                        return (
                          <ListItem key={value.startedAt} disablePadding divider>
                            <ListItemButton onClick={handleToggle(value)} dense>
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
                                primary={`Started: ${formatWhen(
                                  value.startedAt
                                )} | Stopped: ${formatWhen(value.stoppedAt)} | Pages: ${
                                  value.pagesCount
                                } | Events: ${value.totalEvents} | Bytes: ${prettyBytes(
                                  value.totalBytes
                                )}`}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                  </List>
                )}

                {/* ------------------------------------------------------------------
                 * STEP 2 — Website selection
                 * ------------------------------------------------------------------ */}
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
                          No websites available to select.
                        </Typography>
                      </Box>
                    )}

                    {!step2LoadingList &&
                      step2WebSiteList.length > 0 &&
                      step2WebSiteList.map((value) => (
                        <ListItem key={value[0]} disablePadding divider>
                          <ListItemButton onClick={handleToggleWebSite(value)} dense>
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
                                <Typography className="text-wrap-flex">{value[0]}</Typography>
                              </Stack>

                              <Stack className="row">
                                <Typography className="label-bold-sm">Requests:</Typography>
                                <Typography>{value[1].length}</Typography>
                              </Stack>
                            </Stack>
                          </ListItemButton>
                        </ListItem>
                      ))}
                  </List>
                )}

                {/* ------------------------------------------------------------------
                 * STEP 3 — Request selection (DataGrid)
                 * ------------------------------------------------------------------ */}
                {activeStep === 3 && (
                  <DataGridSelectableInterceptor
                    items={step2WebSiteSelected[1]}
                    setArray={setStep3RequestsSelected}
                  />
                )}

                {/* ------------------------------------------------------------------
                 * STEP 4 — Confirmation, resolver option, job summary dialog
                 * ------------------------------------------------------------------ */}
                {activeStep === 4 && (
                  <>
                    {/* Selected requests displayed again (user may exclude some) */}
                    <DataGridSelectableInterceptor
                      items={step3RequestsSelected}
                      setArray={setStep4ConfirmRequestsSelected}
                    />

                    {/* Resolver checkbox */}
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            onChange={onChangeActivateResolver}
                            value={step4ActivateResolver}
                          />
                        }
                        label="Enable resolver to detect potential vulnerabilities."
                      />
                    </FormGroup>

                    {/* JOB SUMMARY DIALOG */}
                    <Dialog open={openJobsDialog} fullWidth>
                      <DialogTitle>Job Summaries</DialogTitle>

                      <DialogContent>
                        <Typography variant="body2" className="jobsummaries-description">
                          This dialog displays a list of background jobs processed via BullMQ and
                          Redis. Each job shows its ID and whether it has been successfully
                          completed or not.
                        </Typography>

                        {/* Job List */}
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

                                <strong>|</strong>

                                <Typography variant="body2">
                                  <strong>JobId:</strong> {job.jobId}
                                </Typography>

                                <strong>|</strong>

                                <Typography variant="body2">
                                  <strong>Completed:</strong> {job.completed ? 'true' : 'false'}
                                </Typography>

                                {job.failed && (
                                  <>
                                    <strong>|</strong>
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

                {/* ------------------------------------------------------------------
                 * STEPPER ACTIONS
                 * ------------------------------------------------------------------ */}
                <Box className="actions">
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    className="btn"
                    disabled={continueDisabled}
                    loading={activeStep === 4 && step4LoadingSendRequests}
                  >
                    {index === steps.length - 1 ? 'Send Requests' : 'Continue'}
                  </Button>

                  <Button
                    disabled={
                      index === 0 ||
                      (activeStep === 4 && step4LoadingSendRequests) ||
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

export default SendToOntologyInterceptor;
