import httpClient from "../../services/httpClient";

export async function getHealth() {
  const res = await httpClient.get("/health");
  return res.data;
}

export function deriveToolStatus(health, wsStatus) {
  if (!health) return "tool_off";

  const components = health.components || {};
  const values = Object.values(components);

  const allUp = values.length > 0 && values.every((v) => v === "up");
  const anyUp = values.some((v) => v === "up");

  // Consider websocket as part of full health
  const wsOk = wsStatus === "connected";

  if (allUp && health.ok && wsOk) return "tool_on";
  if (anyUp || wsOk) return "checking";
  return "tool_off";
}