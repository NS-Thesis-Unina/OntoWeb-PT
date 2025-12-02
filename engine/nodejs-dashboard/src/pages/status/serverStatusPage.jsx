import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Grid,
  Chip,
  LinearProgress
} from "@mui/material";
import { io } from "socket.io-client";

import StatusCard from "./components/statusCard";
import { getHealth, deriveToolStatus } from "./healthService";

export default function ServerStatusPage() {
  const [health, setHealth] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [toolStatus, setToolStatus] = useState("tool_off");

  // 🔵 AGGIUNTA: stato per i log realtime
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const h = await getHealth();
        setHealth(h);
        const st = deriveToolStatus(h, wsStatus);
        console.log("Derived tool status:", st);
        console.log("Websocket:", wsStatus);
        setToolStatus(st);
      } catch {
        setHealth(null);
        setToolStatus("tool_off");
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [wsStatus]);

  // Socket principale (già esistente)
  useEffect(() => {
    const socket = io("http://localhost:8081", {
      transports: ["websocket"],
    });

    socket.on("connect", () => setWsStatus("connected"));
    socket.on("disconnect", () => setWsStatus("disconnected"));

    return () => socket.disconnect();
  }, []);

  // 🔵 AGGIUNTA: socket dedicato ai LOG realtime
  useEffect(() => {
    const logSocket = io("http://localhost:8081/logs", {
      transports: ["websocket"],
    });

    logSocket.on("log", (entry) => {
      setLogs((prev) => [...prev.slice(-80), entry]); // max 80 log
    });

    return () => logSocket.disconnect();
  }, []);

  const components = health?.components || {};

  return (
    <Box
      maxWidth={1100}
      mx="auto"
      mt={4}
      sx={{ pb: 8, color: "#fff",padding: "30px",margin: "0 auto",marginTop: "32px" }}
    >

      <Card
        sx={{
          mb: 4,
          borderRadius: 3,
          background:
            toolStatus === "tool_on"
              ? "linear-gradient(90deg, #00c853, #64dd17)"
              : toolStatus === "checking"
              ? "linear-gradient(90deg, #fbc02d, #ffeb3b)"
              : "linear-gradient(90deg, #d50000, #ff1744)",
          color: "white",
        }}
      >
        <CardContent>
          <Typography variant="h4" fontWeight="bold">
            Tool Status: {toolStatus}
          </Typography>

          <Typography mt={1} fontSize={14}>
            Ultimo aggiornamento: {new Date().toLocaleTimeString()}
          </Typography>

          <Box mt={3}>
            {toolStatus === "tool_on" && <LinearProgress color="success" />}
            {toolStatus === "checking" && <LinearProgress color="warning" />}
            {toolStatus === "tool_off" && <LinearProgress color="error" />}
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3, background: "none" }}>
        Component Status
      </Divider>

      <Grid container spacing={3} sx={{justifyContent:"space-between"}}>

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

      {/* 🔵 AGGIUNTA: pannello log realtime */}
      <Card
        sx={{
          mt: 5,
          borderRadius: 3,
          background: "rgba(20,20,20,0.9)",
          color: "#fff"
        }}
      >
        <CardContent>
          <Typography variant="h6" mb={1}>
            Real-Time Logs
          </Typography>

          <Box
            sx={{
              maxHeight: 250,
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              pr: 1
            }}
          >
            {logs.map((l, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: "#999" }}>{l.ts}</span>{" "}
                <span
                  style={{
                    color:
                      l.level === "error"
                        ? "#ff5252"
                        : l.level === "warn"
                        ? "#ffb74d"
                        : "#81c784",
                  }}
                >
                  [{l.level}]
                </span>{" "}
                <span style={{ color: "#fff" }}>
                  {typeof l.msg === "string" ? l.msg : JSON.stringify(l.msg)}
                </span>
              </div>
            ))}
          </Box>
        </CardContent>
      </Card>

    </Box>
  );
}
