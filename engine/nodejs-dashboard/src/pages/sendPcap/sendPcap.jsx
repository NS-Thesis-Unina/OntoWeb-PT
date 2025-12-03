import './sendPcap.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
  Zoom,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { httpRequestsService, pcapService, healthService, socketService } from '../../services';
import PcapRequestsDataGrid from './components/pcapRequestsDataGrid/pcapRequestsDataGrid';
import PcapRequestsDataGridSelectable from './components/pcapRequestsDataGridSelectable/pcapRequestsDataGridSelectable';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Brightness1Icon from '@mui/icons-material/Brightness1';
import { enqueueSnackbar } from 'notistack';
import { makeBatchPayloads } from './makeBatchPayloads';

/** Stepper definition: labels + short descriptions for each stage. */
const steps = [
  {
    label: 'Upload PCAP file',
    description: 'Select the PCAP or PCAPNG file that contains the captured network traffic.',
  },
  {
    label: 'Upload SSL keys file',
    description:
      'Select the TLS key log file (for example sslkeys.log) used to decrypt HTTPS traffic.',
  },
  {
    label: 'Extract HTTP requests',
    description: 'Use the uploaded files to extract HTTP requests from the PCAP.',
  },
  {
    label: 'Preview extracted requests',
    description: 'Browse the extracted HTTP requests and check what has been decoded.',
  },
  {
    label: 'Select requests for ontology',
    description: 'Select the HTTP requests that you want to send to the ontology.',
  },
  {
    label: 'Confirm and send',
    description: 'Review the selected requests and send them to the ontology.',
  },
];

/**
 * Page: Send PCAP
 *
 * Architectural Role:
 * - Wizard-like workflow to import a PCAP/PCAPNG capture together with a TLS
 *   key log file, decrypt traffic, extract HTTP requests, preview/select them,
 *   and send the selected subset to the ontology (optionally enabling resolver jobs).
 *
 * Responsibilities:
 * - Manage stepper state (6 steps from upload to submission).
 * - Validate file types and enforce step prerequisites before continuing.
 * - Call the PCAP extraction endpoint and adapt results for preview/selection.
 * - Batch selected requests into safe payloads and ingest them via API.
 * - Subscribe to backend jobs over WebSocket and display completion summaries.
 * - Guard the flow with a health check to avoid sending while the tool is OFF.
 *
 * UX Notes:
 * - Errors are surfaced at the top as a dismissible Alert; on error, the view
 *   scrolls to the top for visibility.
 * - “Continue” button is disabled contextually per step and shows a “Checking tool...”
 *   state while the health check runs.
 * - A modal dialog presents job summaries after sending requests.
 *
 * Data Model:
 * - `requests`: raw extracted HTTP entries; used both for preview and selection.
 * - `selectedRequests`: subset chosen to be ingested.
 * - `jobEvents`: stream of job lifecycle events (completed/failed) from sockets/polling.
 *
 * Integration Points:
 * - healthService.getHealth / deriveToolStatus: gate progression.
 * - pcapService.extractHttpRequestsFromPcap: extraction.
 * - httpRequestsService.ingestHttpRequests / getHttpIngestResult: ingestion and polling.
 * - socketService.subscribeJob / onJobEvent / unsubscribeJob: WebSocket updates.
 */
function SendPcap() {
  /** Stepper active step index (0..5). */
  const [activeStep, setActiveStep] = useState(0);

  /** Uploaded files references. */
  const [pcapFile, setPcapFile] = useState(null);
  const [sslKeysFile, setSslKeysFile] = useState(null);

  /** Extracted and selected HTTP requests. */
  const [requests, setRequests] = useState([]);
  const [selectedRequests, setSelectedRequests] = useState([]);

  /** Async flags for extraction and submission. */
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  /** User-facing error message for the whole wizard. */
  const [errorMessage, setErrorMessage] = useState('');

  /** Health check flag. */
  const [checkingTool, setCheckingTool] = useState(false);

  /** Whether to trigger the resolver after sending requests. */
  const [activateResolver, setActivateResolver] = useState(false);

  /** Job monitoring state and dialog control. */
  const [jobEvents, setJobEvents] = useState([]);
  const subscribedJobIdsRef = useRef(new Set());
  const [openJobsDialog, setOpenJobsDialog] = useState(false);

  /**
   * UX helper: when an error appears, scroll to the top of the content container
   * so the user sees the alert immediately.
   */
  useEffect(() => {
    if (!errorMessage) return;

    try {
      const container = document.querySelector('.nw-div .content-div .right-div');

      if (container) {
        container.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      } else {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    } catch {
      // ignore scrolling errors
    }
  }, [errorMessage]);

  /**
   * Validate filename by extension.
   * @param {File} file - The file to validate.
   * @param {string[]} allowedExts - Allowed file suffixes (lowercased, including dot).
   */
  const hasValidExtension = (file, allowedExts) => {
    if (!file || !file.name) return false;
    const name = file.name.toLowerCase();
    return allowedExts.some((ext) => name.endsWith(ext));
  };

  /** Handle PCAP file input changes (pcap/pcapng only). */
  const handlePcapChange = (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      setPcapFile(null);
      return;
    }

    if (!hasValidExtension(file, ['.pcap', '.pcapng'])) {
      setPcapFile(null);
      setErrorMessage('Invalid file type. Please select a .pcap or .pcapng file.');
      return;
    }

    setPcapFile(file || null);
    setErrorMessage('');
  };

  /** Handle TLS key log file input changes (log/txt only). */
  const handleSslKeysChange = (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      setSslKeysFile(null);
      return;
    }

    if (!hasValidExtension(file, ['.log', '.txt'])) {
      setSslKeysFile(null);
      setErrorMessage('Invalid file type. Please select a .log or .txt file.');
      return;
    }

    setSslKeysFile(file || null);
    setErrorMessage('');
  };

  /**
   * Health gate: check service readiness before allowing the user to proceed.
   * If the tool is OFF/unreachable, show an actionable error.
   */
  const checkToolBeforeContinue = async () => {
    setErrorMessage('');
    setCheckingTool(true);

    try {
      const health = await healthService.getHealth();
      const status = healthService.deriveToolStatus(health);

      if (status === 'tool_off') {
        setErrorMessage('The analysis tool is currently OFF. Please enable it before continuing.');
        return false;
      }

      return true;
    } catch (err) {
      console.error(err);
      setErrorMessage(
        'The analysis tool is unreachable or OFF. Please enable it before continuing.'
      );
      return false;
    } finally {
      setCheckingTool(false);
    }
  };

  /**
   * Step 3 action: send files to backend and extract HTTP requests.
   * Guards required inputs and surfaces server-side errors.
   */
  const extractRequests = async () => {
    setErrorMessage('');

    if (!pcapFile) {
      setErrorMessage('Please select a PCAP file before continuing.');
      setActiveStep(0);
      return;
    }

    if (!sslKeysFile) {
      setErrorMessage('Please select an SSL keys file before continuing.');
      setActiveStep(1);
      return;
    }

    try {
      setLoadingExtract(true);
      const data = await pcapService.extractHttpRequestsFromPcap(pcapFile, sslKeysFile);

      const safeArray = Array.isArray(data) ? data : [];
      setRequests(safeArray);
      setSelectedRequests([]);

      if (safeArray.length === 0) {
        setErrorMessage('No HTTP requests were extracted from the PCAP.');
      }

      // Jump to "Preview extracted requests".
      setActiveStep(3);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to extract HTTP requests from PCAP.';
      setErrorMessage(message);
    } finally {
      setLoadingExtract(false);
    }
  };

  /**
   * Normalize PCAP extraction output into raw items compatible with ingestion.
   * Converts header arrays to name:value objects and preserves base64 bodies if present.
   */
  const mapPcapItemsToRawItems = (items) => {
    return (Array.isArray(items) ? items : []).map((r, idx) => {
      const id = r.id ?? `pcap-${idx}`;

      const url = r?.uri?.full || '';
      const reqHeadersArray = Array.isArray(r?.requestHeaders) ? r.requestHeaders : [];
      const resHeadersArray = Array.isArray(r?.response?.responseHeaders)
        ? r.response.responseHeaders
        : [];

      const reqHeadersObj = {};
      for (const h of reqHeadersArray) {
        if (!h || typeof h.name !== 'string') continue;
        reqHeadersObj[h.name] = h.value ?? '';
      }

      const resHeadersObj = {};
      for (const h of resHeadersArray) {
        if (!h || typeof h.name !== 'string') continue;
        resHeadersObj[h.name] = h.value ?? '';
      }

      return {
        id,
        request: {
          method: r.method,
          url,
          headers: reqHeadersObj,
          body: undefined,
          bodyEncoding: undefined,
        },
        response: r.response
          ? {
              status: r.response.statusCode,
              statusText: r.response.reasonPhrase,
              headers: resHeadersObj,
              body: r.response.body,
              bodyEncoding: typeof r.response.body === 'string' ? 'base64' : undefined,
            }
          : {},
        meta: {
          pageUrl: url,
        },
      };
    });
  };

  /**
   * Subscribe to push events for job lifecycle (completed/failed).
   * Returns an unsubscribe cleanup; also guards against double unsubscription errors.
   */
  useEffect(() => {
    const off = socketService.onJobEvent((evt) => {
      setJobEvents((prev) => [...prev, evt]);
    });

    return () => {
      try {
        off?.();
      } catch {
        // swallow teardown exceptions
      }
    };
  }, []);

  /**
   * Idempotent job subscription: avoid re-subscribing to the same job ID.
   */
  const subscribeJob = useCallback(async (jobId) => {
    const id = String(jobId);
    if (!id) return;
    if (subscribedJobIdsRef.current.has(id)) return;

    subscribedJobIdsRef.current.add(id);
    try {
      await socketService.subscribeJob(id);
    } catch (e) {
      console.warn('subscribeJob error', e);
    }
  }, []);

  /**
   * Final step action: batch selected requests and ingest them.
   * - Constructs safe payloads with `makeBatchPayloads` (payload cap + safety margin).
   * - Sends to the API, optionally enabling a resolver job per batch.
   * - Subscribes to job IDs and opens the job summary dialog.
   */
  const sendRequestsToOntology = async () => {
    setErrorMessage('');

    if (!selectedRequests || selectedRequests.length === 0) {
      setErrorMessage('Please select at least one request before sending.');
      setActiveStep(4);
      return;
    }

    try {
      setLoadingSend(true);

      const rawItems = mapPcapItemsToRawItems(selectedRequests);

      const payloads = makeBatchPayloads(
        rawItems,
        {
          graph:
            import.meta.env.VITE_CONNECT_HTTP_REQUESTS_NAME_GRAPH ||
            'http://localhost/graphs/http-requests',
        },
        {
          maxBytes: 10 * 1024 * 1024,
          safetyMargin: 600 * 1024,
        }
      );

      if (!payloads.length) {
        setErrorMessage('No valid HTTP requests to send.');
        return;
      }

      let ok = 0;
      let total = 0;

      const results = await Promise.all(
        payloads.map(async (batch) => {
          try {
            const res = await httpRequestsService.ingestHttpRequests({
              ...batch,
              activateResolver,
            });

            if (res?.resRequest?.accepted && res?.resRequest?.jobId) {
              subscribeJob(res.resRequest.jobId);
            }

            if (res?.resResolver?.accepted && res?.resResolver?.jobId) {
              subscribeJob(res.resResolver.jobId);
            }

            return res;
          } catch (e) {
            enqueueSnackbar('Error while sending the request (check the console for details).', {
              variant: 'error',
            });
            console.error('Error while sending the request:', e);
            return { error: String(e?.message || e) };
          }
        })
      );

      // Count accepted requests and (optionally) resolver jobs.
      ok = results.filter((r) => r?.resRequest?.accepted).length;
      total = results.length;

      if (activateResolver) {
        ok += results.filter((r) => r?.resResolver?.accepted).length;
        total += results.length;
      }

      enqueueSnackbar(
        `Requests accepted by the backend: ${ok}/${total}. Waiting for results from the worker...`,
        { variant: ok > 0 ? 'success' : 'warning' }
      );

      setOpenJobsDialog(true);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to send HTTP requests to ontology.';
      setErrorMessage(message);
    } finally {
      setLoadingSend(false);
    }
  };

  /**
   * Global “Continue” dispatcher:
   * - Gates progression through health check.
   * - Triggers extraction on step 2, ingestion on step 5.
   * - Otherwise advances one step forward.
   */
  const handleNext = async () => {
    const canContinue = await checkToolBeforeContinue();
    if (!canContinue) {
      return;
    }

    if (activeStep === 2) {
      await extractRequests();
      return;
    }

    if (activeStep === 5) {
      await sendRequestsToOntology();
      return;
    }

    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  /**
   * Back button handler: prevents navigation while an operation is running.
   */
  const handleBack = () => {
    if (loadingExtract || loadingSend || checkingTool) {
      return;
    }

    setErrorMessage('');
    setActiveStep((prev) => (prev > 0 ? prev - 1 : prev));
  };

  /**
   * Compute whether “Continue” should be disabled given the current step state.
   * Prevents accidental progression without required inputs or while busy.
   */
  const isContinueDisabled = () => {
    if (checkingTool) {
      return true;
    }
    if (activeStep === 0) {
      return !pcapFile;
    }
    if (activeStep === 1) {
      return !sslKeysFile;
    }
    if (activeStep === 2) {
      return loadingExtract;
    }
    if (activeStep === 3) {
      return requests.length === 0;
    }
    if (activeStep === 4) {
      return requests.length === 0 || selectedRequests.length === 0;
    }
    if (activeStep === 5) {
      return selectedRequests.length === 0 || loadingSend;
    }
    return false;
  };

  const continueDisabled = isContinueDisabled();

  /**
   * Reduce jobEvents into compact per-job summaries for the dialog.
   * - Tracks last event and success/failure flags.
   * - Keeps a raw event trail in case future UI needs more details.
   */
  const jobSummaries = useMemo(() => {
    const map = new Map();

    for (const e of jobEvents) {
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
  }, [jobEvents]);

  /**
   * While the job dialog is open, poll job statuses to complement
   * WebSocket updates (acts as a fallback if sockets drop).
   */
  useEffect(() => {
    if (!openJobsDialog) return;

    let cancelled = false;

    const pollJobStatuses = async () => {
      const ids = Array.from(subscribedJobIdsRef.current);
      if (ids.length === 0) return;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await httpRequestsService.getHttpIngestResult(id);
            if (!res) return;

            const state = res.state;
            const eventName = state === 'completed' || state === 'failed' ? state : 'update';

            const syntheticEvent = {
              event: eventName,
              queue: 'http',
              jobId: id,
              data: res,
            };

            setJobEvents((prev) => [...prev, syntheticEvent]);

            if (state === 'completed' || state === 'failed') {
              subscribedJobIdsRef.current.delete(id);
            }
          } catch {
            // swallow polling errors
          }
        })
      );

      if (subscribedJobIdsRef.current.size === 0) {
        cancelled = true;
        clearInterval(interval);
      }
    };

    // Initial tick + interval polling
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
   * Reset dialog state and teardown job subscriptions; then reset the wizard.
   */
  const handleCloseJobsDialog = () => {
    setOpenJobsDialog(false);
    setJobEvents([]);
    try {
      for (const id of subscribedJobIdsRef.current) {
        socketService.unsubscribeJob(id).catch?.(() => {});
      }
    } catch {
      // ignore unsubscribe errors
    }
    subscribedJobIdsRef.current.clear();

    // Reset the wizard back to step 0 and clear all local state.
    setActiveStep(0);
    setPcapFile(null);
    setSslKeysFile(null);
    setRequests([]);
    setSelectedRequests([]);
    setActivateResolver(false);
    setErrorMessage('');
    setLoadingExtract(false);
    setLoadingSend(false);
    setCheckingTool(false);
  };

  return (
    <div className="sendPcap-div">
      <Typography className="sendPcap-title">Send PCAP</Typography>

      {/* Introductory description with a smooth entrance animation */}
      <Zoom in={true}>
        <Paper className="sendPcap-description">
          <Typography variant="body2">
            This guided workflow lets you upload a PCAP capture and its TLS key log file, decrypt
            the traffic, and reconstruct HTTP requests and responses. You can inspect each
            interaction in detail, select the ones that matter, and send them to the ontology for
            storage and further analysis, optionally triggering the resolver to detect potential
            vulnerabilities.
          </Typography>
        </Paper>
      </Zoom>

      {/* Global error alert (sticky area at the top) */}
      {errorMessage && (
        <Box className="sendPcap-alert">
          <Alert severity="error" onClose={() => setErrorMessage('')} variant="filled">
            {errorMessage}
          </Alert>
        </Box>
      )}

      {/* Vertical stepper hosting all the stages of the flow */}
      <Box className="sendPcap-content">
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label} className="sendPcap-step">
              <StepLabel>{step.label}</StepLabel>

              <StepContent>
                <Typography className="sendPcap-step-description">{step.description}</Typography>

                {/* Step 0: upload PCAP */}
                {index === 0 && (
                  <Box className="sendPcap-file-row">
                    <input
                      id="pcap-upload-input"
                      type="file"
                      accept=".pcap,.pcapng"
                      onChange={handlePcapChange}
                      className="sendPcap-file-input"
                    />

                    <label htmlFor="pcap-upload-input">
                      <Button
                        variant="contained"
                        size="small"
                        component="span"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setErrorMessage('')}
                      >
                        Upload file
                      </Button>
                    </label>

                    {pcapFile && (
                      <Typography variant="body2" className="sendPcap-file-name">
                        Selected file: {pcapFile.name}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Step 1: upload TLS key log */}
                {index === 1 && (
                  <Box className="sendPcap-file-row">
                    <input
                      id="sslkeys-upload-input"
                      type="file"
                      accept=".log,.txt"
                      onChange={handleSslKeysChange}
                      className="sendPcap-file-input"
                    />

                    <label htmlFor="sslkeys-upload-input">
                      <Button
                        variant="contained"
                        size="small"
                        component="span"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setErrorMessage('')}
                      >
                        Upload file
                      </Button>
                    </label>

                    {sslKeysFile && (
                      <Typography variant="body2" className="sendPcap-file-name">
                        Selected file: {sslKeysFile.name}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Step 2: extraction trigger */}
                {index === 2 && (
                  <Box className="sendPcap-extract">
                    {loadingExtract ? (
                      <Box className="sendPcap-loading">
                        <CircularProgress size={24} />
                        <Typography variant="body2" className="sendPcap-loading-text">
                          Extracting HTTP requests from PCAP...
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2">
                        When you press <strong>Continue</strong>, the PCAP and SSL key files will be
                        sent to the backend and the HTTP requests will be extracted.
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Step 3: preview results */}
                {index === 3 && (
                  <>
                    {requests && requests.length > 0 ? (
                      <Box className="sendPcap-grid">
                        <PcapRequestsDataGrid rows={requests} />
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" className="sendPcap-empty">
                        No HTTP requests are available. Please extract them again from the PCAP.
                      </Typography>
                    )}
                  </>
                )}

                {/* Step 4: selectable list */}
                {index === 4 && (
                  <Box className="sendPcap-grid">
                    {requests && requests.length > 0 ? (
                      <PcapRequestsDataGridSelectable
                        rows={requests}
                        onSelectionChange={setSelectedRequests}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary" className="sendPcap-empty">
                        No HTTP requests are available. Please extract them again from the PCAP.
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Step 5: confirmation + resolver option + submit */}
                {index === 5 && (
                  <>
                    {selectedRequests && selectedRequests.length > 0 ? (
                      <Box className="sendPcap-grid">
                        <PcapRequestsDataGrid rows={selectedRequests} />
                        <FormGroup sx={{ mt: 2 }}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={activateResolver}
                                onChange={(e) => setActivateResolver(e.target.checked)}
                              />
                            }
                            label="Enable resolver to detect potential vulnerabilities."
                          />
                        </FormGroup>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" className="sendPcap-empty">
                        No requests selected. Go back and select at least one request.
                      </Typography>
                    )}

                    {/* Inline progress while sending */}
                    {loadingSend && (
                      <Box className="sendPcap-loading sendPcap-loading-inline">
                        <CircularProgress size={20} />
                        <Typography variant="body2" className="sendPcap-loading-text">
                          Sending selected requests...
                        </Typography>
                      </Box>
                    )}

                    {/* Job summaries dialog with live updates */}
                    <Dialog open={openJobsDialog} fullWidth>
                      <DialogTitle>Job Summaries</DialogTitle>

                      <DialogContent>
                        <Typography variant="body2" className="jobsummaries-description">
                          This dialog displays a list of background jobs processed via BullMQ and
                          Redis. Each job shows its ID and whether it has been successfully
                          completed or not.
                        </Typography>

                        {jobSummaries.length > 0 ? (
                          jobSummaries.map((job, idx) => (
                            <Paper key={idx} className="jobsummaries-item" sx={{ p: 1, mt: 1 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Brightness1Icon
                                  color={
                                    job.completed ? 'success' : job.failed ? 'error' : 'warning'
                                  }
                                />
                                <Typography variant="body2">
                                  <strong>Queue:</strong> {job.queue}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>JobId:</strong> {job.jobId}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Completed:</strong> {job.completed ? 'true' : 'false'}
                                </Typography>
                                {job.failed && (
                                  <Typography variant="body2">
                                    <strong>Failed:</strong> true
                                  </Typography>
                                )}
                              </Box>
                            </Paper>
                          ))
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              py: 3,
                            }}
                          >
                            <CircularProgress />
                          </Box>
                        )}
                      </DialogContent>

                      <DialogActions>
                        <Button variant="contained" onClick={handleCloseJobsDialog}>
                          OK
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </>
                )}

                {/* Step actions */}
                <Box className="sendPcap-actions">
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={continueDisabled}
                    className="sendPcap-btn"
                  >
                    {index === steps.length - 1
                      ? 'Send requests'
                      : checkingTool
                      ? 'Checking tool...'
                      : 'Continue'}
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    disabled={index === 0 || loadingExtract || loadingSend || checkingTool}
                    className="sendPcap-btn"
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

export default SendPcap;
