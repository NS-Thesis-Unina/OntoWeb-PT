import { Alert, Backdrop, Box, Button, Checkbox, CircularProgress, FormControlLabel, FormGroup, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Step, StepContent, StepLabel, Stepper, Typography, Zoom } from "@mui/material";
import "./sendToOntology.css";
import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";
import interceptorReactController from "../../../interceptorController";
import { formatWhen, prettyBytes } from "../../../../../libs/formatting";
import DataGridSelectableInterceptor from "../components/dataGridSelectableInterceptor/dataGridSelectableInterceptor";
import { makeBatchPayloads } from "./makeBatchPayloads";
import toolReactController from "../../../../../toolController";
import { getLock, subscribeLockChanges } from "../../../../../scanLock";

const steps = [
  {
    label: 'Send requests to the ontology',
    description: `Follow the steps below to submit requests to the ontology. 
    Choose a saved scan, pick a website from that scan, select the requests 
    you want, and then confirm to send them.`,
  },
  {
    label: 'Choose a scan',
    description:
      `From all scans saved in local storage, select the scan you want to 
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

function SendToOntologyInterceptor(){

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

  const [step3RequestsSelected, setStep3RequestsSelected] = useState([]);

  const [step4ConfirmRequestsSelected, setStep4ConfirmRequestsSelected] = useState([]);
  const [step4ActivateResolver, setStep4ActivateResolver] = useState(false);
  const [step4LoadingSendRequests, setStep4LoadingSendRequests] = useState(false);

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
      case 4: {
        sendRequests();
        break;
      }
      default: {
        //ignore
      }
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
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
      }
      case 3: {
        setStep3RequestsSelected([]);
        break;
      }
      case 4: {
        setStep3RequestsSelected([]);
        setStep4ConfirmRequestsSelected([]);
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
    setStep3RequestsSelected([]);
    setStep4ConfirmRequestsSelected([]);
    setStep4ActivateResolver(false);
    setContinueDisabled(false);
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
          if(step3RequestsSelected.length === 0){
            setContinueDisabled(true);
          }else{
            setContinueDisabled(false);
          }
          break;
        }
        case 4: {
          if(step4ConfirmRequestsSelected.length === 0){
            setContinueDisabled(true);
          }else{
            setContinueDisabled(false);
          }
        }
        default: {
          //ignore
        }
      }
    }else{
      setContinueDisabled(true);
    }
  },[activeStep, step1ScanSelected, step2WebSiteSelected, step3RequestsSelected, step4ConfirmRequestsSelected, toolStatus]); // (volendo puoi aggiungere scanLock qui)

  //Step 1 - Scan List
  const handleToggle = (value) => () => {
    setStep1ScanSelected(value);
  };

  function hasValidMeta(meta) {
    return meta && typeof meta === "object"
      && Number.isFinite(meta.startedAt)
      && Number.isFinite(meta.stoppedAt)
      && Number.isFinite(meta.totalEvents)
      && Number.isFinite(meta.pagesCount)
      && Number.isFinite(meta.totalBytes);
  }

  const loadScansFromLocalStorage = useCallback(async () => {
    setStep1LoadingList(true);
    try {
      const res = await interceptorReactController.listRuns();
      const list = Array.isArray(res?.runs) ? res.runs : [];

      const cleaned = list.filter(item =>
        item &&
        typeof item.key === "string" &&
        item.key !== "interceptorRun_lastKey" &&
        item.key.startsWith("interceptorRun_") &&
        hasValidMeta(item.meta)
      );

      const runsKeys = cleaned.map(v => v.key);

      await Promise.all(
        runsKeys.map(value => loadScanContentFromLocalStorage(value))
      );

      setStep1LoadingList(false);
    } catch (e) {
      console.log(e?.message || "Error loading runs from storage.", { variant: "error" });
      setStep1LoadingList(false);
    }
  }, []);

  const loadScanContentFromLocalStorage = async (keyId) => {
    try {
      const all = await browser.storage.local.get(keyId);
      const r = all?.[keyId] || null;
      if (!r) {
        console.log("Run not found in storage.");
      } else {
        setStep1ScanList((prevList) => [...prevList, r]);
      }
    } catch (e) {
      console.log(e?.message || "Error reading run from storage.");
    }
  };

  //Step 2
  const handleToggleWebSite = (value) => () => {
    setStep2WebSiteSelected(value);
  };

  const renderWebSiteList = () => {
    setStep2WebSiteList(Object.entries(step1ScanSelected.dataset));
    setStep2LoadingList(false)
  }

  //Step 4
  const onChangeActivateResolver = () => {
    setStep4ActivateResolver(!step4ActivateResolver);
  }

  const sendRequests = () => {
    console.log("ciao")
    setStep4LoadingSendRequests(true);
    const payloads = makeBatchPayloads(
      step4ConfirmRequestsSelected, 
      {graph: "http://example.com/graphs/http-requests"}, 
      { maxBytes: 2 * 1024 * 1024, safetyMargin: 600 * 1024 }
    );
    payloads.map(async (item) => {
      try{
        const res = await toolReactController.ingestHttp(item);
        console.log(res);
      }catch(e){
        console.log(e);
      }
    })
    setStep4LoadingSendRequests(false);
  }

  console.log("Scan lists", step1ScanList);
  console.log("Website List", step2WebSiteList);
  console.log("Website", step2WebSiteSelected);
  console.log("Requests", step3RequestsSelected);
  console.log("Confirm", step4ConfirmRequestsSelected);
  console.log("Activate Resolver", step4ActivateResolver);
  console.log("Tool Status", toolStatus);
  console.log(activeStep);

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
            <strong>Send to ontology</strong> lets you persist selected HTTP requests from your 
            saved scans into GraphDB (the ontology). You can also enable the resolver to perform a 
            basic, best-effort detection of potential vulnerabilities on the selected requests 
            before they are stored.
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
                          No scans available to select.
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
                              primary={`Started: ${formatWhen(value.startedAt)} | Stopped: ${formatWhen(value.stoppedAt)} | Pages: ${value.pagesCount} | Events: ${value.totalEvents} | Bytes: ${prettyBytes(value.totalBytes)}`}
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
                          No websites available to select.
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
                                <Typography className="label-bold-sm">Requests:</Typography>
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
                  <DataGridSelectableInterceptor items={step2WebSiteSelected[1]} setArray={setStep3RequestsSelected} />
                )}
                {activeStep === 4 && (
                  <>
                    <DataGridSelectableInterceptor items={step3RequestsSelected} setArray={setStep4ConfirmRequestsSelected} />
                    <FormGroup>
                      <FormControlLabel control={<Checkbox onChange={onChangeActivateResolver} value={step4ActivateResolver} />} label="Enable resolver to detect potential vulnerabilities." />
                    </FormGroup>
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
                    {index === steps.length - 1 ? 'Send Requests' : 'Continue'}
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
        {activeStep === steps.length && (
          <Paper square elevation={0} className="completion-box">
            <Typography>All steps completed - you&apos;re finished</Typography>
            <Button onClick={handleReset} className="btn">
              Reset
            </Button>
          </Paper>
        )}
      </Box>
    </div>
  );
}

export default SendToOntologyInterceptor;
