import './toolStatus.css';
import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  Paper,
} from '@mui/material';
import { io } from 'socket.io-client';
import StatusCard from './components/statusCard/statusCard';
import { getHealth, deriveToolStatus } from '../../services/healthService';

/**
 * **Page: ToolStatus**
 *
 * Purpose:
 *   A live operational overview of the OntoWeb-PT backend. It aggregates:
 *   - Periodic health checks from the REST API (`/health`).
 *   - WebSocket connectivity state (root namespace).
 *   - A streaming log feed ("/logs" namespace) displayed in a rolling buffer.
 *
 * Data sources:
 *   - `getHealth()` → { ok: boolean, components: { server, redis, graphdb } }
 *   - `deriveToolStatus(health)` → "tool_on" | "checking" | "tool_off"
 *   - WebSocket root namespace → sets `wsStatus` ("connected" | "disconnected")
 *   - WebSocket "/logs" namespace → pushes structured log entries
 *
 * UX:
 *   - A prominent main card shows the consolidated tool status with a progress bar tint.
 *   - A grid of `StatusCard` components visualizes per-component states.
 *   - A real-time log panel tails the most recent ~80 events from API/worker.
 *
 * Lifecycle:
 *   - Poll `/health` every 5s (and whenever WS status flips) to keep the UI fresh.
 *   - Open two socket connections on mount (root + /logs); close them on unmount.
 */
export default function ToolStatus() {
  /** Last `/health` payload; `null` if unreachable. */
  const [health, setHealth] = useState(null);

  /** Root WebSocket connectivity ('connected' | 'disconnected'). */
  const [wsStatus, setWsStatus] = useState('disconnected');

  /** Consolidated status label derived from `health`. */
  const [toolStatus, setToolStatus] = useState('');

  /** Rolling log buffer rendered in the "Real-Time Logs" section. */
  const [logs, setLogs] = useState([]);

  /**
   * Poll the REST health endpoint:
   * - Update `health` with per-component states.
   * - Compute the high-level `toolStatus` badge for the header.
   * Falls back to "tool_off" on errors or unreachable API.
   */
  useEffect(() => {
    async function fetchHealth() {
      try {
        const h = await getHealth();
        setHealth(h);
        const st = deriveToolStatus(h);
        setToolStatus(st);
      } catch (error) {
        setHealth(null);
        setToolStatus('tool_off');
      }
    }

    fetchHealth();
    // Refresh every 5s; re-create when `wsStatus` flips to catch transient phases.
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [wsStatus]);

  /**
   * Open the root WebSocket to observe connectivity.
   * Only used to paint the "WebSocket" status and to trigger health repolls.
   */
  useEffect(() => {
    const socket = io(import.meta.env.VITE_LOGS_WS_URL || 'http://localhost:8081', {
      transports: ['websocket'],
    });

    socket.on('connect', () => setWsStatus('connected'));
    socket.on('disconnect', () => setWsStatus('disconnected'));

    return () => socket.disconnect();
  }, []);

  /**
   * Subscribe to the "/logs" namespace and stream structured log lines.
   * Keeps a compact buffer (last ~80) for performance and readability.
   */
  useEffect(() => {
    const logSocket = io(import.meta.env.VITE_LOGS_WS_URL_LOGS || 'http://localhost:8081/logs', {
      transports: ['websocket'],
    });

    logSocket.on('log', (entry) => {
      // Keep only the tail of the buffer to avoid unbounded growth.
      setLogs((prev) => [...prev.slice(-80), entry]);
    });

    return () => logSocket.disconnect();
  }, []);

  /** Convenience alias; empty object when health is null. */
  const components = health?.components || {};

  /** CSS modifier applied to the main status card based on `toolStatus`. */
  const statusCardModifier =
    toolStatus === 'tool_on'
      ? 'toolstatus-main-card--on'
      : toolStatus === 'checking'
      ? 'toolstatus-main-card--checking'
      : 'toolstatus-main-card--off';

  return (
    <Box className="toolstatus-root">
      {/* ===================== MAIN STATUS CARD ===================== */}
      <Card className={`toolstatus-main-card ${statusCardModifier}`}>
        <CardContent>
          <Typography variant="h4" fontWeight="bold" className="toolstatus-main-title">
            Tool Status: {toolStatus}
          </Typography>

          {/* Local clock render; not tied to server time. */}
          <Typography className="toolstatus-main-updated" fontSize={14}>
            Ultimo aggiornamento: {new Date().toLocaleTimeString()}
          </Typography>

          {/* Progress bar tint mirrors the current consolidated state. */}
          <Box className="toolstatus-main-progress">
            {toolStatus === 'tool_on' && <LinearProgress color="success" />}
            {toolStatus === 'checking' && <LinearProgress color="warning" />}
            {toolStatus === 'tool_off' && <LinearProgress color="error" />}
          </Box>
        </CardContent>
      </Card>

      {/* ===================== COMPONENT STATUS GRID ===================== */}
      <Divider className="toolstatus-divider">Component Status</Divider>

      <Grid container spacing={3} className="toolstatus-components-grid">
        {/* REST API reachability and readiness */}
        <Grid item xs={12} md={6}>
          <StatusCard name="API Server" status={components.server} />
        </Grid>

        {/* Redis connection / availability */}
        <Grid item xs={12} md={6}>
          <StatusCard name="Redis" status={components.redis} />
        </Grid>

        {/* GraphDB connection / availability */}
        <Grid item xs={12} md={6}>
          <StatusCard name="GraphDB" status={components.graphdb} />
        </Grid>

        {/* Client-side WebSocket transport status */}
        <Grid item xs={12} md={6}>
          <StatusCard name="WebSocket" status={wsStatus} />
        </Grid>
      </Grid>

      {/* ===================== REAL-TIME LOGS ===================== */}
      <Card className="toolstatus-logs-card">
        <CardContent>
          <Typography variant="h6" mb={1} color="primary" className="toolstatus-logs-title">
            Real-Time Logs
          </Typography>

          <Box className="toolstatus-logs-container">
            <Paper className="toolstatus-logs-paper" color="primary">
              {logs.map((l, i) => (
                <div key={i} className="toolstatus-log-row">
                  {/* Timestamp */}
                  <Typography color="secondary" className="toolstatus-log-part">
                    {l.ts}
                  </Typography>

                  {/* Severity label with contextual color */}
                  <Typography
                    className="toolstatus-log-part"
                    color={
                      l.level === 'error' ? 'error' : l.level === 'warn' ? 'warning' : 'success'
                    }
                  >
                    [{l.level}]
                  </Typography>

                  {/* Logger namespace */}
                  <Typography color="info" className="toolstatus-log-part">
                    ({l.ns})
                  </Typography>

                  {/* Message payload (stringified if object) */}
                  <Typography color="primary" className="toolstatus-log-message">
                    {typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}
                  </Typography>
                </div>
              ))}
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
