import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import {
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  useMediaQuery,
} from '@mui/material';

import HomeIcon from '@mui/icons-material/Home';
import HttpIcon from '@mui/icons-material/Http';
import BugReportIcon from '@mui/icons-material/BugReport';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ApiIcon from '@mui/icons-material/Api';
import Brightness1Icon from '@mui/icons-material/Brightness1';

import LogoDark from '/images/LogoDark.png';
import LogoLight from '/images/LogoLight.png';
import Icon from '/images/icon.png';

import './navigationWrapper.css';
import { useThemeMode } from '../../theme/themeModeProvider';
import DarkLightButton from '../darkLightButton/darkLightButton';

import { getHealth, deriveToolStatus } from '../../services/healthService';

function NavigationWrapper({ children }) {
  const { mode } = useThemeMode();
  const isUnder900 = useMediaQuery('(max-width:900px)');
  const navigate = useNavigate();
  const location = useLocation();

  const [toolStatus, setToolStatus] = useState('checking');

  const inFindings = location.pathname.startsWith('/findings');

  const isHttpFindings =
    location.pathname === '/findings' || location.pathname === '/findings/';
  const isAnalyzerFindings = location.pathname.startsWith('/findings/analyzer');
  const isTechstackFindings = location.pathname.startsWith('/findings/techstack');

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const health = await getHealth();

        if (cancelled) return;

        const status = deriveToolStatus(health);

        setToolStatus((prev) => (prev === status ? prev : status));
      } catch (err) {
        if (cancelled) return;
        setToolStatus((prev) => (prev === 'tool_off' ? prev : 'tool_off'));
      }
    }

    loadHealth();

    const id = setInterval(loadHealth, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="nw-div">
      <AppBar position="static">
        <Toolbar className="toolbar">
          <img
            className="logo logo-desktop"
            src={mode === 'dark' ? LogoLight : LogoDark}
            alt="Logo"
            onClick={() => navigate("/home")}
          />
          <img className="logo logo-mobile" src={Icon} alt="Icon" onClick={() => navigate("/home")} />

          <Divider className="divider" orientation="vertical" />

          <div className="buttons">
            {inFindings && (
              <Stack
                className="stack"
                direction="row"
                divider={<Divider className="divider" orientation="vertical" />}
              >
                <Button
                  className="button"
                  size="large"
                  disabled={isHttpFindings}
                  onClick={() => navigate('/findings')}
                >
                  Http Findings
                </Button>
                <Button
                  className="button"
                  size="large"
                  disabled={isAnalyzerFindings}
                  onClick={() => navigate('/findings/analyzer')}
                >
                  Analyzer Findings
                </Button>
                <Button
                  className="button"
                  size="large"
                  disabled={isTechstackFindings}
                  onClick={() => navigate('/findings/techstack')}
                >
                  Techstack Findings
                </Button>
              </Stack>
            )}

            <div className="options">
              <Chip
                label={
                  toolStatus === 'checking'
                    ? 'Tool Checking'
                    : toolStatus === 'tool_on'
                    ? 'Tool On'
                    : 'Tool Off'
                }
                icon={
                  toolStatus === 'checking' ? (
                    <CircularProgress size={16} className="checking-icon" />
                  ) : (
                    <Brightness1Icon />
                  )
                }
                color={
                  toolStatus === 'checking'
                    ? 'warning'
                    : toolStatus === 'tool_on'
                    ? 'success'
                    : 'error'
                }
                variant="outlined"
                className="toolstatus-chip"
              />
              <DarkLightButton size="normal" />
            </div>
          </div>
        </Toolbar>
      </AppBar>

      <div className="content-div">
        <Paper className="left-div">
          {!isUnder900 ? (
            <Stack
              className="stack"
              direction="column"
              divider={<Divider className="divider" orientation="horizontal" />}
            >
              <Button
                className="button"
                size="large"
                onClick={() => navigate('/home')}
              >
                <HomeIcon className="icon" fontSize="large" />
                Home
              </Button>

              <Button
                className="button"
                size="large"
                onClick={() => navigate('/http-requests')}
              >
                <HttpIcon className="icon" fontSize="large" />
                Requests
              </Button>

              <Button
                className="button"
                size="large"
                onClick={() => navigate('/findings')}
              >
                <BugReportIcon className="icon" fontSize="large" />
                Findings
              </Button>

              <Button
                className="button"
                size="large"
                onClick={() => navigate('/send-pcap')}
              >
                <SendIcon className="icon" fontSize="large" />
                Send PCAP
              </Button>

              <Button
                className="button"
                size="large"
                onClick={() => navigate('/server-status')}
              >
                <CheckCircleIcon className="icon" fontSize="large" />
                Tool Status
              </Button>

              <Button
                className="button"
                size="large"
                onClick={() => navigate('/openapi')}
              >
                <ApiIcon className="icon" fontSize="large" />
                OpenAPI
              </Button>
            </Stack>
          ) : (
            <Stack
              className="stack"
              direction="column"
              divider={<Divider className="divider" orientation="horizontal" />}
            >
              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/home')}
              >
                <HomeIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/http-requests')}
              >
                <HttpIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/findings')}
              >
                <BugReportIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/send-pcap')}
              >
                <SendIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/server-status')}
              >
                <CheckCircleIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/openapi')}
              >
                <ApiIcon fontSize="large" />
              </IconButton>
            </Stack>
          )}
          <Divider className="divider" orientation="horizontal" />
        </Paper>

        <div className="right-div">
          {children}
        </div>
      </div>
    </div>
  );
}

export default NavigationWrapper;
