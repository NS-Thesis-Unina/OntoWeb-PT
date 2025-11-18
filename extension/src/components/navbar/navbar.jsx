import './navbar.css';
import { useLocation, useNavigate } from 'react-router-dom';
import LogoDark from '/images/logo/LogoDark.png';
import LogoLight from '/images/logo/LogoLight.png';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import DarkLightButton from '../darkLightButton/darkLightButton';
import { useThemeMode } from '../../theme/themeModeProvider';
import { selectedSection } from '../../libs/navigation';
import { useEffect, useState } from 'react';
import toolReactController from '../../toolController';
import { Chip, CircularProgress } from '@mui/material';
import Brightness1Icon from '@mui/icons-material/Brightness1';

/**
 * **Navbar Component**
 *
 * This component renders the top-level navigation bar for the entire
 * extension UI. It provides:
 *
 * - Global navigation between Home, TechStack, Analyzer, and Interceptor.
 * - A dynamic logo that adapts to the current theme (light/dark).
 * - A live status indicator for the backend “Tool” service (engine cluster).
 * - A dark/light mode toggle button.
 *
 * Architectural Notes:
 * - The navbar queries the backend status using `toolReactController`, which
 *   communicates with the background script. It uses periodic polling (5 sec).
 * - `selectedSection()` disables the button of the section currently selected.
 * - The “Tool On / Tool Off / Checking” chip helps users detect whether engines
 *   (Analyzer, Resolver, Ingest, TechStack scanner, etc.) are operational.
 *
 * This component is mounted globally by <App /> and remains persistent across
 * all routes.
 *
 * @returns {JSX.Element}
 */
function Navbar() {
  const { mode } = useThemeMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Internal status of the backend tool (engine cluster)
  const [toolStatus, setToolStatus] = useState('checking');

  /**
   * Interprets the backend health payload returned by toolReactController.
   * All components must be “up” for the tool to be considered healthy.
   */
  const computeStatus = (payload) =>
    payload?.ok && Object.values(payload.components ?? {}).every((c) => c === 'up')
      ? 'tool_on'
      : 'tool_off';

  /**
   * On mount:
   * - Start polling backend health every 5 seconds.
   * - Listen to realtime update events from background.
   * - Run an immediate health check.
   *
   * On unmount:
   * - Stop polling and detach listeners.
   */
  useEffect(() => {
    toolReactController.startPolling(5000);

    const off = toolReactController.onMessage({
      onToolUpdate: (payload) => {
        setToolStatus(computeStatus(payload));
      },
    });

    toolReactController
      .getHealth()
      .then((data) => setToolStatus(computeStatus(data)))
      .catch(() => setToolStatus('tool_off'));

    return () => {
      off?.();
      toolReactController.stopPolling();
    };
  }, []);

  return (
    <Paper className="navbar-paper">
      {/* LOGO AREA */}
      <div className="logo-div">
        <img src={mode === 'dark' ? LogoLight : LogoDark} alt="OntoWeb-PT" />
      </div>

      {/* NAVIGATION BUTTONS */}
      <div className="buttons-div">
        <Button disabled={selectedSection(pathname, 'home')} onClick={() => navigate('/home')}>
          Home
        </Button>

        <Divider orientation="vertical" />

        <Button
          disabled={selectedSection(pathname, 'techstack')}
          onClick={() => navigate('/techstack')}
        >
          Technology Stack
        </Button>

        <Divider orientation="vertical" />

        <Button
          disabled={selectedSection(pathname, 'analyzer')}
          onClick={() => navigate('/analyzer')}
        >
          Analyzer
        </Button>

        <Divider orientation="vertical" />

        <Button
          disabled={selectedSection(pathname, 'interceptor')}
          onClick={() => navigate('/interceptor')}
        >
          Interceptor
        </Button>
      </div>

      {/* TOOL STATUS + THEME TOGGLE */}
      <div className="options-div">
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
            toolStatus === 'checking' ? 'warning' : toolStatus === 'tool_on' ? 'success' : 'error'
          }
          variant="outlined"
          className="toolstatus-chip"
        />

        {/* Light/Dark mode toggle */}
        <DarkLightButton />
      </div>
    </Paper>
  );
}

export default Navbar;
