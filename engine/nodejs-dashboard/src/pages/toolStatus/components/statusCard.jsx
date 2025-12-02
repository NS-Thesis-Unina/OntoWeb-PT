import { Card, CardContent, Typography, Box } from "@mui/material";
import "./statusCard.css";

export default function StatusCard({ name, status }) {
  const normalized = status || "down";

  const statusClassMap = {
    up: "statuscard-indicator--green",
    connected: "statuscard-indicator--green",
    connecting: "statuscard-indicator--yellow",
    down: "statuscard-indicator--red",
    disconnected: "statuscard-indicator--red",
  };

  const indicatorModifier =
    statusClassMap[normalized] || "statuscard-indicator--red";

  return (
    <Card className="statuscard-root">
      <CardContent className="statuscard-content">
        <Box className="statuscard-header">
          <Typography
            variant="h6"
            color="primary"
            className="statuscard-title"
          >
            {name}
          </Typography>

          <Box
            className={`statuscard-indicator ${indicatorModifier}`}
          />
        </Box>

        <Typography
          className="statuscard-status-text"
          color="primary"
        >
          {normalized}
        </Typography>
      </CardContent>
    </Card>
  );
}
