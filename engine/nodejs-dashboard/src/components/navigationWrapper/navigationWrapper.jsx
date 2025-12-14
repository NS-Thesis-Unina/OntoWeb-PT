import './navigationWrapper.css';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import {
  Chip,
  CircularProgress,
  Divider,
  Drawer,
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
import { useThemeMode } from '../../theme/themeModeProvider';
import DarkLightButton from '../darkLightButton/darkLightButton';
import LayersIcon from '@mui/icons-material/Layers';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';

import { getHealth, deriveToolStatus } from '../../services/healthService';

/**
 * **Layout Component: NavigationWrapper**
 *
 * Purpose:
 *   Top-level shell for the app. Renders:
 *   - A fixed AppBar with brand, section tabs (contextual when inside Findings),
 *     a live tool status chip, and the dark/light toggle.
 *   - A persistent left-side navigation rail (buttons on desktop, icons on mobile).
 *   - The routed page content in the right pane.
 *
 * Data flow:
 *   - Polls `/health` every 3s and derives a consolidated tool status
 *     ("tool_on" | "checking" | "tool_off") for the status chip.
 *   - Uses `useLocation()` to detect when the user is inside Findings and
 *     to compute which sub-tab should be disabled (active).
 *
 * Responsiveness:
 *   - `useMediaQuery('(max-width:900px)')` switches the left rail between
 *     full-labeled buttons and compact icon-only buttons.
 *   - `useMediaQuery('(max-width:650px)')` switches the left rail between
 *     compact icon-only buttons and top-left menu.
 *
 * Accessibility:
 *   - The brand logo is clickable and navigates to `/home`.
 *   - Disabled states reflect current route to avoid redundant navigations.
 */
function NavigationWrapper({ children }) {
  const { mode } = useThemeMode();
  const isUnder900 = useMediaQuery('(max-width:900px)');
  const isUnder650 = useMediaQuery('(max-width:650px)');
  const navigate = useNavigate();
  const location = useLocation();

  /** Consolidated tool status shown in the chip (poll-based). */
  const [toolStatus, setToolStatus] = useState('checking');

  /** True if current route is under `/findings` → shows Findings sub-tabs in AppBar. */
  const inFindings = location.pathname.startsWith('/findings');

  // Sub-tab route checks (used to disable the active tab)
  const isTechstackFindings =
    location.pathname === '/findings' || location.pathname === '/findings/';
  const isAnalyzerFindings = location.pathname.startsWith('/findings/analyzer');
  const isHttpFindings = location.pathname.startsWith('/findings/http');

  const [openDrawer, setOpenDrawer] = useState(false);

  /**
   * Poll health status every 3s and derive a simple high-level status label.
   * Keeps state stable by avoiding unnecessary updates if status doesn't change.
   */
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
        // If unreachable or error, mark as off
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

  const handleCloseDrawer = () => {
    setOpenDrawer(false);
  };

  const handleOpenDrawer = () => {
    setOpenDrawer(true);
  };

  const drawerNavigate = (path) => {
    navigate(path);
    setOpenDrawer(false);
  };

  return (
    <div className="nw-div">
      {/* ======= TOP APP BAR (brand, context tabs, tool status, theme toggle) ======= */}
      <AppBar position="static">
        <Toolbar className="toolbar">
          {/* Brand: switch logo depending on theme; acts as Home navigation */}
          <img
            className="logo logo-desktop"
            src={mode === 'dark' ? LogoLight : LogoDark}
            alt="Logo"
            onClick={() => navigate('/home')}
          />
          <IconButton className="menu" size="large" onClick={handleOpenDrawer}>
            <MenuIcon />
          </IconButton>
          <img
            className="logo logo-mobile"
            src={Icon}
            alt="Icon"
            onClick={() => navigate('/home')}
          />

          <Divider className="divider" orientation="vertical" />

          <div className="buttons">
            {/* Findings sub-nav appears only when user is inside /findings */}
            {inFindings && (
              <Stack
                className="stack"
                direction="row"
                divider={<Divider className="divider" orientation="vertical" />}
              >
                <Button
                  className="button"
                  size="large"
                  disabled={isTechstackFindings}
                  onClick={() => navigate('/findings')}
                >
                  <LayersIcon />
                  {!isUnder650 && 'Techstack Findings'}
                </Button>
                <Button
                  className="button"
                  size="large"
                  disabled={isAnalyzerFindings}
                  onClick={() => navigate('/findings/analyzer')}
                >
                  <AnalyticsIcon />
                  {!isUnder650 && 'Analyzer Findings'}
                </Button>
                <Button
                  className="button"
                  size="large"
                  disabled={isHttpFindings}
                  onClick={() => navigate('/findings/http')}
                >
                  <PodcastsIcon />
                  {!isUnder650 && 'Http Findings'}
                </Button>
              </Stack>
            )}

            {/* Status chip + theme toggle live at the far end */}
            <div className="options">
              <Chip
                label={
                  !isUnder650 &&
                  (toolStatus === 'checking'
                    ? 'Tool Checking'
                    : toolStatus === 'tool_on'
                    ? 'Tool On'
                    : 'Tool Off')
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

      {/* ======= PAGE LAYOUT: left navigation rail + routed content ======= */}
      <div className="content-div">
        <Paper className="left-div">
          {/* Desktop: full buttons with labels */}
          {!isUnder900 ? (
            <Stack
              className="stack"
              direction="column"
              divider={<Divider className="divider" orientation="horizontal" />}
            >
              <Button className="button" size="large" onClick={() => navigate('/home')}>
                <HomeIcon className="icon" fontSize="large" />
                Home
              </Button>

              <Button className="button" size="large" onClick={() => navigate('/http-requests')}>
                <HttpIcon className="icon" fontSize="large" />
                Requests
              </Button>

              <Button className="button" size="large" onClick={() => navigate('/findings')}>
                <BugReportIcon className="icon" fontSize="large" />
                Findings
              </Button>

              <Button className="button" size="large" onClick={() => navigate('/send-pcap')}>
                <SendIcon className="icon" fontSize="large" />
                Send PCAP
              </Button>

              <Button className="button" size="large" onClick={() => navigate('/server-status')}>
                <CheckCircleIcon className="icon" fontSize="large" />
                Tool Status
              </Button>

              <Button className="button" size="large" onClick={() => navigate('/openapi')}>
                <ApiIcon className="icon" fontSize="large" />
                OpenAPI
              </Button>
            </Stack>
          ) : !isUnder650 ? (
            // Middle: compact icon-only rail
            <Stack
              className="stack"
              direction="column"
              divider={<Divider className="divider" orientation="horizontal" />}
            >
              <IconButton className="button" size="large" onClick={() => navigate('/home')}>
                <HomeIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/http-requests')}
              >
                <HttpIcon fontSize="large" />
              </IconButton>

              <IconButton className="button" size="large" onClick={() => navigate('/findings')}>
                <BugReportIcon fontSize="large" />
              </IconButton>

              <IconButton className="button" size="large" onClick={() => navigate('/send-pcap')}>
                <SendIcon fontSize="large" />
              </IconButton>

              <IconButton
                className="button"
                size="large"
                onClick={() => navigate('/server-status')}
              >
                <CheckCircleIcon fontSize="large" />
              </IconButton>

              <IconButton className="button" size="large" onClick={() => navigate('/openapi')}>
                <ApiIcon fontSize="large" />
              </IconButton>
            </Stack>
          ) : (
            //Mobile: top-left menu
            <Drawer open={openDrawer}>
              <Stack
                className="stack"
                direction="column"
                style={{ minWidth: '100vw', display: 'flex' }}
                divider={<Divider className="divider" orientation="horizontal" />}
              >
                <Button className="button-drawer-close" size="large" onClick={handleCloseDrawer}>
                  <ChevronLeftIcon className="icon-drawer" fontSize="large" />
                </Button>
                <Divider className="divider" />
                <Button
                  className="button-drawer"
                  size="large"
                  onClick={() => drawerNavigate('/home')}
                >
                  <HomeIcon className="icon-drawer" fontSize="large" />
                  Home
                </Button>

                <Button
                  className="button-drawer"
                  size="large"
                  onClick={() => drawerNavigate('/http-requests')}
                >
                  <HttpIcon className="icon-drawer" fontSize="large" />
                  Requests
                </Button>

                <Button
                  className="button-drawer"
                  size="large"
                  onClick={() => drawerNavigate('/findings')}
                >
                  <BugReportIcon className="icon-drawer" fontSize="large" />
                  Findings
                </Button>

                <Button
                  className="button-drawer"
                  size="large"
                  onClick={() => drawerNavigate('/send-pcap')}
                >
                  <SendIcon className="icon-drawer" fontSize="large" />
                  Send PCAP
                </Button>

                <Button
                  className="button-drawer"
                  size="large"
                  onClick={() => drawerNavigate('/server-status')}
                >
                  <CheckCircleIcon className="icon-drawer" fontSize="large" />
                  Tool Status
                </Button>

                <Button
                  className="button-drawer"
                  size="large"
                  onClick={() => drawerNavigate('/openapi')}
                >
                  <ApiIcon className="icon-drawer" fontSize="large" />
                  OpenAPI
                </Button>
                <Divider className="divider" />
              </Stack>
            </Drawer>
          )}
          <Divider className="divider" orientation="horizontal" />
        </Paper>

        {/* Routed page content */}
        <div className="right-div">{children}</div>
      </div>
    </div>
  );
}

export default NavigationWrapper;
