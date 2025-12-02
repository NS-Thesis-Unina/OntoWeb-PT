import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  Paper,
} from "@mui/material";
import { io } from "socket.io-client";

import StatusCard from "./components/statusCard";
import { getHealth, deriveToolStatus } from "../../services/healthService";
import "./toolStatus.css";

export default function ToolStatus() {
  const [health, setHealth] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [toolStatus, setToolStatus] = useState("");

  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const h = await getHealth();
        setHealth(h);
        const st = deriveToolStatus(h);
        setToolStatus(st);
      } catch (error) {
        setHealth(null);
        setToolStatus("tool_off");
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [wsStatus]);

  useEffect(() => {
    const socket = io(
      import.meta.env.VITE_LOGS_WS_URL || "http://localhost:8081",
      {
        transports: ["websocket"],
      }
    );

    socket.on("connect", () => setWsStatus("connected"));
    socket.on("disconnect", () => setWsStatus("disconnected"));

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const logSocket = io(
      import.meta.env.VITE_LOGS_WS_URL_LOGS ||
        "http://localhost:8081/logs",
      {
        transports: ["websocket"],
      }
    );

    logSocket.on("log", (entry) => {
      setLogs((prev) => [...prev.slice(-80), entry]);
    });

    return () => logSocket.disconnect();
  }, []);

  const components = health?.components || {};

  const statusCardModifier =
    toolStatus === "tool_on"
      ? "toolstatus-main-card--on"
      : toolStatus === "checking"
      ? "toolstatus-main-card--checking"
      : "toolstatus-main-card--off";

  return (
    <Box className="toolstatus-root">
      {/* MAIN STATUS CARD */}
      <Card className={`toolstatus-main-card ${statusCardModifier}`}>
        <CardContent>
          <Typography
            variant="h4"
            fontWeight="bold"
            className="toolstatus-main-title"
          >
            Tool Status: {toolStatus}
          </Typography>

          <Typography
            className="toolstatus-main-updated"
            fontSize={14}
          >
            Ultimo aggiornamento: {new Date().toLocaleTimeString()}
          </Typography>

          <Box className="toolstatus-main-progress">
            {toolStatus === "tool_on" && (
              <LinearProgress color="success" />
            )}
            {toolStatus === "checking" && (
              <LinearProgress color="warning" />
            )}
            {toolStatus === "tool_off" && (
              <LinearProgress color="error" />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* COMPONENT STATUS */}
      <Divider className="toolstatus-divider">
        Component Status
      </Divider>

      <Grid
        container
        spacing={3}
        className="toolstatus-components-grid"
      >
        <Grid item xs={12} md={6}>
          <StatusCard name="API Server" status={components.server} />
        </Grid>

        <Grid item xs={12} md={6}>
          <StatusCard name="Redis" status={components.redis} />
        </Grid>

        <Grid item xs={12} md={6}>
          <StatusCard name="GraphDB" status={components.graphdb} />
        </Grid>

        <Grid item xs={12} md={6}>
          <StatusCard name="WebSocket" status={wsStatus} />
        </Grid>
      </Grid>

      {/* LOGS */}
      <Card className="toolstatus-logs-card">
        <CardContent>
          <Typography
            variant="h6"
            mb={1}
            color="primary"
            className="toolstatus-logs-title"
          >
            Real-Time Logs
          </Typography>

          <Box className="toolstatus-logs-container">
            <Paper className="toolstatus-logs-paper" color="primary">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className="toolstatus-log-row"
                >
                  <Typography color="secondary" className="toolstatus-log-part">
                    {l.ts}
                  </Typography>
                  <Typography
                    className="toolstatus-log-part"
                    color={
                      l.level === "error"
                        ? "error"
                        : l.level === "warn"
                        ? "warning"
                        : "success"
                    }
                  >
                    [{l.level}]
                  </Typography>
                  <Typography color="info" className="toolstatus-log-part">
                    ({l.ns})
                  </Typography>
                  <Typography
                    color="primary"
                    className="toolstatus-log-message"
                  >
                    {typeof l.msg === "string"
                      ? l.msg
                      : JSON.stringify(l.msg)}
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
