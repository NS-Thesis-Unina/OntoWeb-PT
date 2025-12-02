import { Card, CardContent, Typography, Box } from "@mui/material";
import { connect } from "socket.io-client";

export default function StatusCard({ name, status }) {
  const colorMap = {
    up: "#00c853",
    connected: "#00c853",
    connecting: "#ffeb3b",
    down: "#d50000",
    disconnected: "#d50000",
  };

  const normalized = status || "down";

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: 3,
        background: "rgba(30,30,30,0.9)",
        color: "#fff",
        minHeight: 120, 
        display: "flex",
        alignItems: "center"
      }}
    >
      <CardContent sx={{ width: "100%",minWidth:"150px" }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{name}</Typography>

          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: colorMap[normalized],
              boxShadow: `0 0 12px ${colorMap[normalized]}`,
              animation:
                normalized === "up" || normalized === "connected"
                  ? "pulseGreen 1.5s infinite"
                  : normalized === "connecting"
                  ? "pulseYellow 1.5s infinite"
                  : "pulseRed 1.5s infinite",
            }}
          />
        </Box>

        <Typography mt={1} color="rgba(255,255,255,0.6)">
          {normalized}
        </Typography>
      </CardContent>
    </Card>
  );
}
