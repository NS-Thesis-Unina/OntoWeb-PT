import './statusCard.css';
import { Card, CardContent, Typography, Box } from '@mui/material';

/**
 * **Component: StatusCard**
 *
 * Purpose:
 *   Small presentational card used in the Tool Status page to display the state
 *   of an individual subsystem (API, Redis, GraphDB, or WebSocket).
 *
 * Visuals:
 *   - Title on the left.
 *   - A colored circular indicator on the right (green/yellow/red).
 *   - A textual status label below the header.
 *
 * Accepted `status` values (normalized internally):
 *   "up" | "down" | "connected" | "connecting" | "disconnected"
 *
 * @param {Object} props
 * @param {string} props.name    Human-readable component name.
 * @param {string} props.status  Raw status string from health/ws.
 * @returns {JSX.Element}
 */
export default function StatusCard({ name, status }) {
  // Normalize falsy/unknown to "down" for a conservative default.
  const normalized = status || 'down';

  // Map normalized states to CSS modifier classes controlling the dot color.
  const statusClassMap = {
    up: 'statuscard-indicator--green',
    connected: 'statuscard-indicator--green',
    connecting: 'statuscard-indicator--yellow',
    down: 'statuscard-indicator--red',
    disconnected: 'statuscard-indicator--red',
  };

  const indicatorModifier = statusClassMap[normalized] || 'statuscard-indicator--red';

  return (
    <Card className="statuscard-root">
      <CardContent className="statuscard-content">
        {/* Header: name + colored indicator */}
        <Box className="statuscard-header">
          <Typography variant="h6" color="primary" className="statuscard-title">
            {name}
          </Typography>

          <Box className={`statuscard-indicator ${indicatorModifier}`} />
        </Box>

        {/* Lower caption: the normalized status string */}
        <Typography className="statuscard-status-text" color="primary">
          {normalized}
        </Typography>
      </CardContent>
    </Card>
  );
}
